/**
 * The community chat's activity mode (`site_settings.community_chat_enabled`).
 * While `disabled` the chat is passive: it stays readable but no one — not even
 * the admin — can post, until an admin flips the switch back on. Admins toggle
 * it from the System screen and every change lands in the audit log.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageUsers, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden } from "@/lib/errors";
import { parseChatMode, type ChatMode } from "@/lib/chat-mode";
import type { RequestMeta } from "./auth";

export const CHAT_MODE_KEY = "community_chat_enabled";

export async function getChatMode(): Promise<ChatMode> {
  const rows = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, CHAT_MODE_KEY))
    .limit(1);
  return parseChatMode(rows[0]?.value);
}

export const chatModeSchema = z.strictObject({
  mode: z.enum(["enabled", "disabled"]),
});

export async function setChatMode(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<ChatMode> {
  if (!canManageUsers(actor)) throw forbidden();

  const parsed = chatModeSchema.safeParse(rawInput);
  if (!parsed.success) throw badRequest("Sohbet durumu geçersiz.");

  const now = new Date();
  await db
    .insert(siteSettings)
    .values({ key: CHAT_MODE_KEY, value: parsed.data.mode, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: parsed.data.mode, updatedBy: actor.id, updatedAt: now },
    });

  await writeAudit({
    actorId: actor.id,
    action: "community.chat_mode_changed",
    entityType: "site_settings",
    entityId: null,
    after: { mode: parsed.data.mode },
    ip: meta.ip,
  });

  return parsed.data.mode;
}
