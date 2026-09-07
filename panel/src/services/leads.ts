/**
 * Writer leads and category quotas (module 5).
 *
 * A lead is someone who filled the public interest form; it is not the
 * contract pipeline (`writer_applications`). Rules live here, once:
 *  - a lead picks 1..3 categories
 *  - only active categories are pickable
 *  - a category is full when its `max_quota` approved leads are reached, and
 *    a full category rejects both new applications and further approvals
 */
import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  categories,
  writerLeadCategories,
  writerLeads,
  type Category,
  type LeadStatus,
  type WriterLead,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canModerateCommunity, type Actor } from "@/lib/auth/rbac";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { parseIsoDate } from "@/lib/age";
import type { RequestMeta } from "./auth";

export const MAX_LEAD_CATEGORIES = 1;
export const DEFAULT_QUOTA = 3;

/* ------------------------------------------------------------------ */
/* Quota                                                               */
/* ------------------------------------------------------------------ */

export type CategoryWithQuota = {
  id: string;
  name: string;
  /** The subheadings as the editor wrote them; shown when the card opens. */
  description: string | null;
  maxQuota: number;
  isActive: boolean;
  /** Number of approved leads linked to this category. */
  currentCount: number;
  full: boolean;
};

/**
 * The categories an applicant can pick from, each with its live quota.
 * `includeInactive` is for the admin screen; the public form only ever sees
 * active, non-deleted categories. The count always means approved leads, so a
 * category with no approvals correctly reads 0.
 */
export async function listCategoriesWithQuota(
  includeInactive = false,
): Promise<CategoryWithQuota[]> {
  const categoryRows = await db
    .select()
    .from(categories)
    .where(
      and(
        isNull(categories.deletedAt),
        includeInactive ? undefined : eq(categories.isActive, true),
      ),
    )
    // Category names carry a leading number ("1. …", "10. …"); sort numerically
    // so 10 and 11 come after 9, not after 1. Numberless names go last.
    .orderBy(
      sql`(regexp_match(${categories.name}::text, '^\\d+'))[1]::int nulls last, ${categories.name}`,
    );

  const counts = await db
    .select({
      categoryId: writerLeadCategories.categoryId,
      approvedCount: count(writerLeadCategories.leadId),
    })
    .from(writerLeadCategories)
    .innerJoin(writerLeads, eq(writerLeadCategories.leadId, writerLeads.id))
    .where(and(eq(writerLeads.status, "approved"), isNull(writerLeads.deletedAt)))
    .groupBy(writerLeadCategories.categoryId);

  const countByCategory = new Map(counts.map((row) => [row.categoryId, Number(row.approvedCount)]));

  return categoryRows.map((category) => {
    const currentCount = countByCategory.get(category.id) ?? 0;
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      maxQuota: category.maxQuota,
      isActive: category.isActive,
      currentCount,
      full: currentCount >= category.maxQuota,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Pure selection validation                                           */
/* ------------------------------------------------------------------ */

/**
 * The selection rules, pure so they can be unit tested. A lead picks exactly
 * one category; the resolved category must exist, be active and have room.
 * Returns Turkish messages; an empty array means the selection is fine.
 */
export function leadSelectionIssues(
  categoryId: string | null,
  categories: { id: string; name: string; maxQuota: number; currentCount: number; isActive: boolean }[],
): string[] {
  if (!categoryId) return ["Bir kategori seçmelisiniz."];

  const category = categories.find((c) => c.id === categoryId);
  if (!category) return ["Seçilen kategori artık mevcut değil."];

  const issues: string[] = [];
  if (!category.isActive) issues.push(`"${category.name}" kategorisi şu anda kapalı.`);
  if (category.currentCount >= category.maxQuota) {
    issues.push(`"${category.name}" kategorisinin kontenjanı dolu.`);
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Public: the interest form                                           */
/* ------------------------------------------------------------------ */

export const leadApplySchema = z.strictObject({
  fullName: z.string().trim().min(2, "Ad Soyad en az 2 karakter olmalı.").max(80),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı."),
  phone: z
    .string()
    .trim()
    .min(7, "Telefon numarası geçersiz.")
    .max(20, "Telefon numarası geçersiz.")
    .regex(/^\+?[0-9\s()-]+$/, "Telefon numarası yalnızca rakam içerebilir."),
  email: z.email("Geçerli bir e-posta adresi girin.").max(254),
  categoryId: z.uuid("Geçerli bir kategori seçin."),
});

/** Normalises a phone number to a compact, comparable form. */
export function normalisePhone(raw: string): string {
  return raw.replace(/[\s()-]/g, "");
}

export async function applyAsWriterLead(
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ id: string; status: LeadStatus }> {
  const parsed = leadApplySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Başvuru bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;

  if (!parseIsoDate(input.birthDate)) throw badRequest("Doğum tarihi geçersiz.");
  if (new Date(input.birthDate).getTime() >= Date.now()) {
    throw badRequest("Doğum tarihi gelecekte olamaz.");
  }

  // The chosen category must exist, be active and have room right now
  const quota = await listCategoriesWithQuota(false);
  const issues = leadSelectionIssues(input.categoryId, quota);
  if (issues.length > 0) {
    throw badRequest("Seçim geçersiz.", { categories: issues });
  }

  const email = input.email.trim().toLowerCase();
  const phone = normalisePhone(input.phone);

  const existing = await db
    .select({ id: writerLeads.id })
    .from(writerLeads)
    .where(and(eq(writerLeads.email, email), isNull(writerLeads.deletedAt)))
    .limit(1);
  if (existing[0]) throw conflict("Bu e-posta adresiyle zaten başvuru alınmış.");

  const [lead] = await db
    .insert(writerLeads)
    .values({
      fullName: input.fullName,
      birthDate: input.birthDate,
      phone,
      email,
      status: "pending",
    })
    .returning();

  await db.insert(writerLeadCategories).values({ leadId: lead!.id, categoryId: input.categoryId });

  await writeAudit({
    actorId: null,
    action: "lead.applied",
    entityType: "writer_leads",
    entityId: lead!.id,
    after: { fullName: input.fullName, categoryId: input.categoryId },
    ip: meta.ip,
  });

  return { id: lead!.id, status: lead!.status };
}

/* ------------------------------------------------------------------ */
/* Admin: categories                                                   */
/* ------------------------------------------------------------------ */

export const categorySchema = z.strictObject({
  name: z.string().trim().min(2, "Kategori adı en az 2 karakter olmalı.").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  maxQuota: z.coerce.number().int().min(1, "Kontenjan en az 1 olmalı.").max(100).default(DEFAULT_QUOTA),
  isActive: z.boolean().default(true),
});

export async function createCategory(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<Category> {
  if (!canModerateCommunity(actor)) throw forbidden();
  const parsed = categorySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Kategori bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;

  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(ilike(categories.name, input.name), isNull(categories.deletedAt)))
    .limit(1);
  if (existing[0]) throw conflict("Bu isimde bir kategori zaten var.");

  const [row] = await db
    .insert(categories)
    .values({
      name: input.name,
      description: input.description ?? null,
      maxQuota: input.maxQuota,
      isActive: input.isActive,
    })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "category.created",
    entityType: "categories",
    entityId: row!.id,
    after: { name: row!.name, maxQuota: row!.maxQuota },
    ip: meta.ip,
  });

  return row!;
}

export async function updateCategory(
  actor: Actor,
  categoryId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<Category> {
  if (!canModerateCommunity(actor)) throw forbidden();
  const parsed = categorySchema.partial().safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Kategori bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const current = await findCategory(categoryId);
  const [row] = await db
    .update(categories)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.maxQuota !== undefined ? { maxQuota: parsed.data.maxQuota } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, categoryId))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "category.updated",
    entityType: "categories",
    entityId: categoryId,
    before: { name: current.name, maxQuota: current.maxQuota, isActive: current.isActive },
    after: row!,
    ip: meta.ip,
  });

  return row!;
}

/** Soft delete: keeps quota history intact and the name reusable later. */
export async function deleteCategory(
  actor: Actor,
  categoryId: string,
  meta: RequestMeta,
): Promise<void> {
  if (!canModerateCommunity(actor)) throw forbidden();
  const current = await findCategory(categoryId);

  await db
    .update(categories)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(categories.id, categoryId));

  await writeAudit({
    actorId: actor.id,
    action: "category.deleted",
    entityType: "categories",
    entityId: categoryId,
    before: { name: current.name },
    ip: meta.ip,
  });
}

async function findCategory(categoryId: string): Promise<Category> {
  const rows = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), isNull(categories.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound("Kategori bulunamadı.");
  return row;
}

/* ------------------------------------------------------------------ */
/* Admin: leads                                                        */
/* ------------------------------------------------------------------ */

export type LeadListItem = WriterLead & {
  categories: { id: string; name: string }[];
};

/** All leads, newest first, each with its chosen categories. */
export async function listLeads(actor: Actor, limit = 200): Promise<LeadListItem[]> {
  if (!canModerateCommunity(actor)) throw forbidden();

  const rows = await db
    .select({
      lead: writerLeads,
      categoryId: writerLeadCategories.categoryId,
      categoryName: categories.name,
    })
    .from(writerLeads)
    .leftJoin(writerLeadCategories, eq(writerLeadCategories.leadId, writerLeads.id))
    .leftJoin(categories, eq(writerLeadCategories.categoryId, categories.id))
    .where(isNull(writerLeads.deletedAt))
    .orderBy(desc(writerLeads.createdAt))
    .limit(limit);

  const byLead = new Map<string, LeadListItem>();
  for (const row of rows) {
    const lead = row.lead;
    let item = byLead.get(lead.id);
    if (!item) {
      item = { ...lead, categories: [] };
      byLead.set(lead.id, item);
    }
    if (row.categoryId && row.categoryName) {
      item.categories.push({ id: row.categoryId, name: row.categoryName });
    }
  }
  return [...byLead.values()];
}

export const leadUpdateSchema = z.strictObject({
  fullName: z.string().trim().min(2).max(80).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  phone: z.string().trim().min(7).max(20).regex(/^\+?[0-9\s()-]+$/).optional(),
  email: z.email().max(254).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  categoryId: z.uuid().optional(),
});

/**
 * Admin edits a lead. Approving a lead counts it against the category quotas,
 * so it is refused when any chosen category would overflow. Moving a lead away
 * from approved frees the quota again.
 */
export async function updateLead(
  actor: Actor,
  leadId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<LeadListItem> {
  if (!canModerateCommunity(actor)) throw forbidden();
  const parsed = leadUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Başvuru bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;

  const current = await db
    .select()
    .from(writerLeads)
    .where(and(eq(writerLeads.id, leadId), isNull(writerLeads.deletedAt)))
    .limit(1);
  const lead = current[0];
  if (!lead) throw notFound("Başvuru bulunamadı.");

  const categoryId = input.categoryId ?? ((await leadCategoryIds(leadId))[0] ?? null);
  const nextStatus = input.status ?? lead.status;

  // The selection rules matter when the category changes or when the lead is
  // approved into it. A pure status change away from approval (rejecting or
  // holding) must never be blocked by a category the lead already holds.
  if (input.categoryId !== undefined || nextStatus === "approved") {
    const quota = await listCategoriesWithQuota(false);
    const issues = leadSelectionIssues(categoryId, quota);
    if (issues.length > 0) {
      throw badRequest("Seçim geçersiz.", { categories: issues });
    }
  }

  // Approving fills quota: the chosen category must still have room once this
  // lead is counted in, ignoring the lead's own current approval state
  if (nextStatus === "approved" && categoryId) {
    const quota = await listCategoriesWithQuota(false);
    const approved = await db
      .select({ n: count(writerLeadCategories.leadId) })
      .from(writerLeadCategories)
      .innerJoin(writerLeads, eq(writerLeadCategories.leadId, writerLeads.id))
      .where(
        and(
          eq(writerLeadCategories.categoryId, categoryId),
          eq(writerLeads.status, "approved"),
          isNull(writerLeads.deletedAt),
          ne(writerLeadCategories.leadId, leadId),
        ),
      );
    const taken = Number(approved[0]?.n ?? 0);
    const target = quota.find((c) => c.id === categoryId);
    if (target && taken >= target.maxQuota) {
      throw conflict(`"${target.name}" kategorisinin kontenjanı doldu.`);
    }
  }

  const [updated] = await db
    .update(writerLeads)
    .set({
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.birthDate !== undefined ? { birthDate: input.birthDate } : {}),
      ...(input.phone !== undefined ? { phone: normalisePhone(input.phone) } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(writerLeads.id, leadId))
    .returning();

  if (input.categoryId) {
    await db.delete(writerLeadCategories).where(eq(writerLeadCategories.leadId, leadId));
    await db.insert(writerLeadCategories).values({ leadId, categoryId: input.categoryId });
  }

  await writeAudit({
    actorId: actor.id,
    action: "lead.updated",
    entityType: "writer_leads",
    entityId: leadId,
    before: { status: lead.status, categoryId: (await leadCategoryIds(leadId))[0] ?? null },
    after: { status: updated!.status, ...(input.categoryId ? { categoryId: input.categoryId } : {}) },
    ip: meta.ip,
  });

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(writerLeadCategories)
    .innerJoin(categories, eq(writerLeadCategories.categoryId, categories.id))
    .where(eq(writerLeadCategories.leadId, leadId));

  return { ...updated!, categories: categoryRows };
}

async function leadCategoryIds(leadId: string): Promise<string[]> {
  const rows = await db
    .select({ categoryId: writerLeadCategories.categoryId })
    .from(writerLeadCategories)
    .where(eq(writerLeadCategories.leadId, leadId));
  return rows.map((row) => row.categoryId);
}