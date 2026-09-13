/**
 * In-panel notifications (`notifications`).
 *
 * The editorial flow already wrote rows here but nothing showed them; the
 * community screens are their first reader (D-089). A notification never
 * carries the content itself, only a pointer to where it can be read, so a
 * removed post does not live on in someone's inbox.
 */
import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import type { Executor } from "@/lib/audit";
import type { Actor } from "@/lib/auth/rbac";

export type NotificationInput = {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
};

export async function notify(input: NotificationInput, executor: Executor = db): Promise<void> {
  await executor.insert(notifications).values({
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
  });
}

export async function listNotifications(actor: Actor, limit = 100) {
  return db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, actor.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadNotificationCount(actor: Actor): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt)));
  return row?.value ?? 0;
}

export async function markAllNotificationsRead(actor: Actor): Promise<void> {
  const now = new Date();
  await db
    .update(notifications)
    .set({ readAt: now, updatedAt: now })
    .where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt)));
}
