/**
 * Key/value settings (DECISIONS.md D-008).
 *
 * Currently holds the default field values for new rights grant forms, which
 * §7.2 calls the "form template". Values are validated on read, so a hand-edited
 * row cannot put the form into an impossible state.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageAgreements, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden } from "@/lib/errors";
import type { RequestMeta } from "./auth";

export const RIGHTS_TEMPLATE_KEY = "rights_grant_template";

export const rightsTemplateSchema = z.strictObject({
  grantType: z.enum(["assignment", "exclusive_license", "non_exclusive_license"]),
  rightAdaptation: z.boolean(),
  rightReproduction: z.boolean(),
  rightDistribution: z.boolean(),
  rightCommunicationToPublic: z.boolean(),
  channels: z.array(z.enum(["web", "pdf_issue", "social", "newsletter", "future_channels"])),
  exclusivityMonths: z.number().int().min(0).max(600).nullable(),
  territory: z.string().min(2).max(80),
  commercialUseIncluded: z.boolean(),
});

export type RightsTemplate = z.infer<typeof rightsTemplateSchema>;

/** The defaults named in §7.2, used until an admin saves something else. */
export const DEFAULT_RIGHTS_TEMPLATE: RightsTemplate = {
  grantType: "exclusive_license",
  rightAdaptation: true,
  rightReproduction: true,
  rightDistribution: true,
  rightCommunicationToPublic: true,
  channels: ["web", "pdf_issue", "social", "newsletter"],
  exclusivityMonths: 12,
  territory: "worldwide",
  commercialUseIncluded: false,
};

export async function getRightsTemplate(): Promise<RightsTemplate> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, RIGHTS_TEMPLATE_KEY))
    .limit(1);

  const parsed = rightsTemplateSchema.safeParse(rows[0]?.value);
  // A malformed stored value falls back to the conservative default
  return parsed.success ? parsed.data : DEFAULT_RIGHTS_TEMPLATE;
}

export async function setRightsTemplate(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<RightsTemplate> {
  if (!canManageAgreements(actor)) throw forbidden();

  const parsed = rightsTemplateSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Form şablonu geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const previous = await getRightsTemplate();

  await db
    .insert(settings)
    .values({ key: RIGHTS_TEMPLATE_KEY, value: parsed.data, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: parsed.data, updatedBy: actor.id, updatedAt: new Date() },
    });

  await writeAudit({
    actorId: actor.id,
    action: "settings.rights_template_updated",
    entityType: "settings",
    entityId: null,
    before: previous,
    after: parsed.data,
    ip: meta.ip,
  });

  return parsed.data;
}

/** Generic reader for the other settings the admin screen exposes. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return (rows[0]?.value as T) ?? fallback;
}

export async function setSetting(
  actor: Actor,
  key: string,
  value: unknown,
  meta: RequestMeta,
): Promise<void> {
  if (!canManageAgreements(actor)) throw forbidden();

  await db
    .insert(settings)
    .values({ key, value: value as object, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as object, updatedBy: actor.id, updatedAt: new Date() },
    });

  await writeAudit({
    actorId: actor.id,
    action: "settings.updated",
    entityType: "settings",
    entityId: null,
    after: { key },
    ip: meta.ip,
  });
}
