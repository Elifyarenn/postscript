/**
 * User management and the writer promotion flow (§6).
 *
 * Only an admin can change a role, the prerequisites are checked here on the
 * server, and no role ever changes without a `role_changes` row.
 */
import "server-only";
import { and, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { media, users, type Role, type User } from "@/db/schema";
import { isAdult, MINIMUM_WRITER_AGE, parseIsoDate } from "@/lib/age";
import { recordRoleChange, writeAudit } from "@/lib/audit";
import { canManageUsers, canViewIdentityDocuments, type Actor } from "@/lib/auth/rbac";
import { revokeAllSessions } from "@/lib/auth/session";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail/transport";
import { slugify } from "@/lib/slug";
import * as templates from "@emails/templates";
import type { RequestMeta } from "./auth";

/* ------------------------------------------------------------------ */
/* Writer eligibility (§6)                                             */
/* ------------------------------------------------------------------ */

export type EligibilityProblem =
  | "email_not_verified"
  | "birth_date_missing"
  | "under_age"
  | "identity_not_verified"
  | "kvkk_consent_missing"
  | "banned";

const PROBLEM_LABELS: Record<EligibilityProblem, string> = {
  email_not_verified: "E-posta adresi doğrulanmamış.",
  birth_date_missing: "Doğum tarihi girilmemiş.",
  under_age: `Kullanıcı ${MINIMUM_WRITER_AGE} yaşından küçük.`,
  identity_not_verified: "Kimlik doğrulaması yapılmamış.",
  kvkk_consent_missing: "KVKK onayı alınmamış.",
  banned: "Kullanıcı yasaklı.",
};

export type Eligibility = {
  eligible: boolean;
  problems: EligibilityProblem[];
  /** Human readable version of the same list, for the admin screen. */
  messages: string[];
};

/**
 * The five preconditions from §6, evaluated in one place so the UI and the
 * mutation cannot drift apart. `at` is injectable so the age rule is testable.
 */
export function checkWriterEligibility(user: User, at: Date = new Date()): Eligibility {
  const problems: EligibilityProblem[] = [];

  if (!user.emailVerifiedAt) problems.push("email_not_verified");

  if (!user.birthDate) {
    problems.push("birth_date_missing");
  } else if (!isAdult(user.birthDate, at)) {
    problems.push("under_age");
  }

  if (!user.identityVerifiedAt) problems.push("identity_not_verified");
  if (!user.kvkkConsentAt) problems.push("kvkk_consent_missing");
  if (user.isBanned) problems.push("banned");

  return {
    eligible: problems.length === 0,
    problems,
    messages: problems.map((problem) => PROBLEM_LABELS[problem]),
  };
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export async function findUserById(userId: string): Promise<User> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  const user = rows[0];
  if (!user) throw notFound("Kullanıcı bulunamadı.");
  return user;
}

export type UserListFilters = {
  query?: string;
  role?: Role;
  limit?: number;
  offset?: number;
};

export async function listUsers(actor: Actor, filters: UserListFilters = {}) {
  if (!canManageUsers(actor)) throw forbidden();

  const conditions: SQL[] = [isNull(users.deletedAt)];
  if (filters.role) conditions.push(eq(users.role, filters.role));
  if (filters.query) {
    const pattern = `%${filters.query.trim()}%`;
    const match = or(
      ilike(users.email, pattern),
      ilike(users.displayName, pattern),
      ilike(users.penName, pattern),
    );
    if (match) conditions.push(match);
  }

  return db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      penName: users.penName,
      role: users.role,
      writerStatus: users.writerStatus,
      emailVerifiedAt: users.emailVerifiedAt,
      identityVerifiedAt: users.identityVerifiedAt,
      birthDate: users.birthDate,
      isBanned: users.isBanned,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);
}

/* ------------------------------------------------------------------ */
/* Promotion and demotion (§6)                                         */
/* ------------------------------------------------------------------ */

export async function promoteToWriter(
  actor: Actor,
  targetUserId: string,
  meta: RequestMeta,
  note?: string,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden("Rol değiştirme yalnızca admin yetkisidir.");

  const target = await findUserById(targetUserId);
  if (target.role !== "user") throw conflict("Bu kullanıcı zaten yazar veya üzeri bir role sahip.");

  const eligibility = checkWriterEligibility(target);
  if (!eligibility.eligible) {
    // The admin screen shows exactly what is missing rather than a bare refusal
    throw conflict("Yazar terfisi için ön koşullar sağlanmıyor.", {
      requirements: eligibility.messages,
    });
  }

  const [updated] = await db
    .update(users)
    .set({ role: "writer", writerStatus: "pending_agreement", updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await recordRoleChange({
    userId: target.id,
    oldRole: target.role,
    newRole: "writer",
    changedBy: actor.id,
    note: note ?? null,
    ip: meta.ip,
  });

  const url = `${env().APP_URL}/writer/agreement`;
  const message = templates.promotedToWriter({ displayName: target.displayName, url });
  await sendMail({ to: target.email, subject: message.subject, text: message.text });

  return updated!;
}

/** Any role change other than the writer promotion, including making an admin. */
export async function changeRole(
  actor: Actor,
  targetUserId: string,
  newRole: Role,
  meta: RequestMeta,
  note?: string,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden("Rol değiştirme yalnızca admin yetkisidir.");
  if (actor.id === targetUserId) throw badRequest("Kendi rolünüzü değiştiremezsiniz.");

  const target = await findUserById(targetUserId);
  if (target.role === newRole) throw conflict("Kullanıcı zaten bu role sahip.");

  // Anything at or above writer must clear the same bar as a writer promotion
  if (newRole !== "user") {
    const eligibility = checkWriterEligibility(target);
    if (!eligibility.eligible) {
      throw conflict("Bu rol için ön koşullar sağlanmıyor.", {
        requirements: eligibility.messages,
      });
    }
  }

  const writerStatus =
    newRole === "user"
      ? null
      : newRole === "writer"
        ? (target.writerStatus ?? "pending_agreement")
        : target.writerStatus;

  const [updated] = await db
    .update(users)
    .set({ role: newRole, writerStatus, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await recordRoleChange({
    userId: target.id,
    oldRole: target.role,
    newRole,
    changedBy: actor.id,
    note: note ?? null,
    ip: meta.ip,
  });

  // Dropping privileges must take effect now, not when the session expires
  if (newRole === "user") await revokeAllSessions(target.id);

  return updated!;
}

/** Suspends a writer: the panel closes, signed rights grants stay untouched (§6). */
export async function setWriterStatus(
  actor: Actor,
  targetUserId: string,
  status: "active" | "suspended" | "pending_agreement",
  meta: RequestMeta,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden();

  const target = await findUserById(targetUserId);
  if (target.role === "user") throw conflict("Bu kullanıcı yazar değil.");

  const [updated] = await db
    .update(users)
    .set({ writerStatus: status, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "user.writer_status_changed",
    entityType: "users",
    entityId: target.id,
    before: { writerStatus: target.writerStatus },
    after: { writerStatus: status },
    ip: meta.ip,
  });

  return updated!;
}

/* ------------------------------------------------------------------ */
/* Bans and identity verification                                      */
/* ------------------------------------------------------------------ */

export async function setBanned(
  actor: Actor,
  targetUserId: string,
  banned: boolean,
  reason: string | null,
  meta: RequestMeta,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden();
  if (actor.id === targetUserId) throw badRequest("Kendi hesabınızı yasaklayamazsınız.");
  if (banned && !reason?.trim()) throw badRequest("Yasaklama gerekçesi zorunludur.");

  const target = await findUserById(targetUserId);

  const [updated] = await db
    .update(users)
    .set({ isBanned: banned, bannedReason: banned ? reason : null, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  if (banned) await revokeAllSessions(target.id);

  await writeAudit({
    actorId: actor.id,
    action: banned ? "user.banned" : "user.unbanned",
    entityType: "users",
    entityId: target.id,
    before: { isBanned: target.isBanned },
    after: { isBanned: banned, reason },
    ip: meta.ip,
  });

  return updated!;
}

/**
 * The admin marks identity as verified after looking at the uploaded document.
 * The document itself is deleted after 90 days; this timestamp is what remains.
 */
export async function markIdentityVerified(
  actor: Actor,
  targetUserId: string,
  meta: RequestMeta,
): Promise<User> {
  if (!canViewIdentityDocuments(actor)) throw forbidden();

  const target = await findUserById(targetUserId);

  const [updated] = await db
    .update(users)
    .set({ identityVerifiedAt: new Date(), identityVerifiedBy: actor.id, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "user.identity_verified",
    entityType: "users",
    entityId: target.id,
    ip: meta.ip,
  });

  return updated!;
}

/** Lists identity documents for one user. Admin only, and never linked publicly. */
export async function listIdentityDocuments(actor: Actor, targetUserId: string) {
  if (!canViewIdentityDocuments(actor)) throw forbidden();

  return db
    .select({
      id: media.id,
      storageKey: media.storageKey,
      mime: media.mime,
      createdAt: media.createdAt,
      autoDeleteAt: media.autoDeleteAt,
      purgedAt: media.purgedAt,
    })
    .from(media)
    .where(
      and(
        eq(media.uploadedBy, targetUserId),
        eq(media.isIdentityDocument, true),
        isNull(media.deletedAt),
      ),
    )
    .orderBy(desc(media.createdAt));
}

/* ------------------------------------------------------------------ */
/* Profile (§5.4)                                                      */
/* ------------------------------------------------------------------ */

export const profileSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(80),
  penName: z.string().trim().max(80).optional().nullable(),
  bio: z.string().trim().max(2000).optional().nullable(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı.")
    .optional()
    .nullable(),
  socialLinks: z
    .strictObject({
      website: z.url().optional(),
      x: z.url().optional(),
      instagram: z.url().optional(),
      linkedin: z.url().optional(),
      mastodon: z.url().optional(),
    })
    .optional(),
});

export async function updateProfile(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<User> {
  const parsed = profileSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Profil bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;
  const current = await findUserById(actor.id);

  // §5.4: once a birth date exists only an admin may change it
  let birthDate = current.birthDate;
  if (input.birthDate !== undefined && input.birthDate !== null) {
    if (current.birthDate && current.birthDate !== input.birthDate) {
      throw forbidden("Doğum tarihi kaydedildikten sonra yalnızca yönetici değiştirebilir.");
    }
    if (!parseIsoDate(input.birthDate)) throw badRequest("Doğum tarihi geçersiz.");
    birthDate = input.birthDate;
  }

  const penName = input.penName?.trim() || null;

  const [updated] = await db
    .update(users)
    .set({
      displayName: input.displayName,
      penName,
      penNameSlug: penName ? slugify(penName) : null,
      bio: input.bio ?? null,
      birthDate,
      socialLinks: input.socialLinks ?? current.socialLinks,
      updatedAt: new Date(),
    })
    .where(eq(users.id, actor.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "user.profile_updated",
    entityType: "users",
    entityId: actor.id,
    before: { displayName: current.displayName, penName: current.penName },
    after: { displayName: input.displayName, penName },
    ip: meta.ip,
  });

  return updated!;
}

/** An admin correcting a birth date, which the user is not allowed to touch. */
export async function setBirthDateAsAdmin(
  actor: Actor,
  targetUserId: string,
  birthDate: string,
  meta: RequestMeta,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden();
  if (!parseIsoDate(birthDate)) throw badRequest("Doğum tarihi geçersiz.");

  const target = await findUserById(targetUserId);
  const [updated] = await db
    .update(users)
    .set({ birthDate, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "user.birth_date_changed",
    entityType: "users",
    entityId: target.id,
    before: { birthDate: target.birthDate },
    after: { birthDate },
    ip: meta.ip,
  });

  return updated!;
}

/* ------------------------------------------------------------------ */
/* Account deletion (§5.4)                                             */
/* ------------------------------------------------------------------ */

export async function requestAccountDeletion(actor: Actor, meta: RequestMeta): Promise<void> {
  await db
    .update(users)
    .set({ deletionRequestedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, actor.id));

  await writeAudit({
    actorId: actor.id,
    action: "user.deletion_requested",
    entityType: "users",
    entityId: actor.id,
    ip: meta.ip,
  });
}

export async function cancelAccountDeletion(actor: Actor): Promise<void> {
  await db
    .update(users)
    .set({ deletionRequestedAt: null, updatedAt: new Date() })
    .where(eq(users.id, actor.id));
}

/**
 * Runs 30 days after the request (cron). Personal data is replaced, but signed
 * rights grants and their signature evidence are kept: they are the proof that
 * the magazine may publish the work, and that is a lawful basis to retain.
 */
export async function anonymiseUser(userId: string): Promise<void> {
  const user = await findUserById(userId);

  await db
    .update(users)
    .set({
      email: `deleted+${user.id}@invalid.local`,
      displayName: "Silinmiş kullanıcı",
      penName: user.penName, // the pen name stays on published work
      bio: null,
      socialLinks: null,
      birthDate: null,
      avatarMediaId: null,
      passwordHash: "disabled",
      anonymizedAt: new Date(),
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await revokeAllSessions(userId);

  await writeAudit({
    actorId: null,
    action: "user.anonymised",
    entityType: "users",
    entityId: userId,
    ip: null,
  });
}

/** KVKK data portability: everything the panel holds about one user, as JSON. */
export async function exportUserData(actor: Actor, targetUserId: string) {
  if (!canManageUsers(actor) && actor.id !== targetUserId) throw forbidden();

  const user = await findUserById(targetUserId);
  const rows = await db.execute(sql`
    select 'agreement_acceptances' as source, row_to_json(a) as data
      from agreement_acceptances a where a.user_id = ${targetUserId}
    union all
    select 'rights_grants', row_to_json(g) from rights_grants g where g.grantor_id = ${targetUserId}
    union all
    select 'articles', row_to_json(x) from articles x where x.author_id = ${targetUserId}
    union all
    select 'role_changes', row_to_json(r) from role_changes r where r.user_id = ${targetUserId}
  `);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      penName: user.penName,
      bio: user.bio,
      birthDate: user.birthDate,
      role: user.role,
      writerStatus: user.writerStatus,
      kvkkConsentAt: user.kvkkConsentAt,
      kvkkConsentVersion: user.kvkkConsentVersion,
      createdAt: user.createdAt,
    },
    related: rows,
  };
}
