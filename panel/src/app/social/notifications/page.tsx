import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { cn, formatDateTime } from "@/lib/utils";
import { listNotifications } from "@/services/notifications";
import { ActionButton } from "@/components/form";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { markNotificationsReadAction } from "../actions";

export const metadata = { title: "Bildirimler" };

export default async function NotificationsPage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const items = await listNotifications({ ...user });
  const hasUnread = items.some((item) => item.readAt === null);

  return (
    <>
      <PageHeader
        title="Bildirimler"
        actions={
          hasUnread ? (
            <ActionButton
              action={markNotificationsReadAction}
              csrfToken={csrfToken}
              label="Tümünü okundu işaretle"
            />
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState>Henüz bildirim yok.</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="py-3">
                <p className={cn("text-sm", item.readAt === null && "font-semibold")}>
                  {/* Only in-site paths become links; a stored href is never trusted as external */}
                  {item.href?.startsWith("/") ? (
                    <Link href={item.href} className="hover:text-accent">
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </p>
                {item.body && <p className="mt-0.5 text-sm text-muted">{item.body}</p>}
                <p className="mt-1 text-xs text-muted">{formatDateTime(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
