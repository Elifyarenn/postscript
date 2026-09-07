/**
 * The site entry mode: `open` (default) or `closed`. While closed, the auth
 * services refuse registration and non-admin logins, and sessions of
 * non-admins stop resolving. Admins toggle it from the System screen.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageUsers, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden } from "@/lib/errors";
import { parseAccessMode, type AccessMode } from "@/lib/access-mode";
import type { RequestMeta } from "./auth";

export const ACCESS_MODE_KEY = "access_mode";

export async function getAccessMode(): Promise<AccessMode> {
  const rows = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, ACCESS_MODE_KEY))
    .limit(1);
  return parseAccessMode(rows[0]?.value);
}

export const accessModeSchema = z.strictObject({
  mode: z.enum(["open", "closed"]),
});

export async function setAccessMode(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<AccessMode> {
  if (!canManageUsers(actor)) throw forbidden();

  const parsed = accessModeSchema.safeParse(rawInput);
  if (!parsed.success) throw badRequest("Erişim modu geçersiz.");

  const now = new Date();
  await db
    .insert(siteSettings)
    .values({ key: ACCESS_MODE_KEY, value: parsed.data.mode, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: parsed.data.mode, updatedBy: actor.id, updatedAt: now },
    });

  await writeAudit({
    actorId: actor.id,
    action: "site.access_mode_changed",
    entityType: "site_settings",
    entityId: null,
    after: { mode: parsed.data.mode },
    ip: meta.ip,
  });

  return parsed.data.mode;
}