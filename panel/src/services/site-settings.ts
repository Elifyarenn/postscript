/**
 * Publisher details the contract template needs (§3).
 *
 * A key/value table rather than columns on a singleton row: the set of
 * placeholders is expected to grow with the contract, and adding a key should
 * not mean a migration.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageUsers, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden } from "@/lib/errors";
import type { RequestMeta } from "./auth";

/** Keys the contract render reads. All of them are required to publish. */
export const SITE_SETTING_KEYS = [
  "publisher_partner_1",
  "publisher_partner_2",
  "publisher_address",
  "publisher_email",
  "public_domain",
  "jurisdiction_city",
] as const;

export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number];

/** Which placeholder each key feeds, so a refusal can name it (§6.1). */
export const PLACEHOLDER_BY_KEY: Record<SiteSettingKey, string> = {
  publisher_partner_1: "dergi.ortak_1",
  publisher_partner_2: "dergi.ortak_2",
  publisher_address: "dergi.adres",
  publisher_email: "dergi.eposta",
  public_domain: "dergi.domain",
  jurisdiction_city: "dergi.sehir",
};

export const SETTING_LABELS: Record<SiteSettingKey, string> = {
  publisher_partner_1: "Ortak 1 (ad soyad)",
  publisher_partner_2: "Ortak 2 (ad soyad)",
  publisher_address: "Tebligat adresi",
  publisher_email: "Dergi e-posta adresi",
  public_domain: "Yayın alan adı",
  jurisdiction_city: "Yetkili mahkeme şehri",
};

export type SiteSettings = Record<SiteSettingKey, string | null>;

export const siteSettingsSchema = z.strictObject({
  publisher_partner_1: z.string().trim().max(200),
  publisher_partner_2: z.string().trim().max(200),
  publisher_address: z.string().trim().max(400),
  publisher_email: z.string().trim().max(200),
  public_domain: z.string().trim().max(200),
  jurisdiction_city: z.string().trim().max(100),
});

/** Every key, with null where nothing has been saved yet. */
export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await db.select().from(siteSettings);
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  return Object.fromEntries(
    SITE_SETTING_KEYS.map((key) => [key, byKey.get(key)?.trim() || null]),
  ) as SiteSettings;
}

export async function saveSiteSettings(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<SiteSettings> {
  if (!canManageUsers(actor)) throw forbidden();

  const parsed = siteSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Yayıncı bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const before = await getSiteSettings();
  const now = new Date();

  for (const key of SITE_SETTING_KEYS) {
    const value = parsed.data[key];
    await db
      .insert(siteSettings)
      .values({ key, value, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value, updatedBy: actor.id, updatedAt: now },
      });
  }

  const after = await getSiteSettings();

  await writeAudit({
    actorId: actor.id,
    action: "site_settings.updated",
    entityType: "site_settings",
    entityId: null,
    before,
    after,
    ip: meta.ip,
  });

  return after;
}

/** Removes a single key, used only by tests and by the seed's reset path. */
export async function clearSiteSetting(key: SiteSettingKey): Promise<void> {
  await db.delete(siteSettings).where(eq(siteSettings.key, key));
}
