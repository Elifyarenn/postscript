import { guardPanel } from "@/lib/auth/guard";
import { listAnnouncementsFor, markRead } from "@/services/announcements";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { formatDate } from "@/lib/utils";
import { acknowledgeAnnouncementAction } from "../actions";

export const metadata = { title: "Duyurular" };

export default async function WriterAnnouncementsPage() {
  const { user } = await guardPanel("writer");
  const csrfToken = (await readCsrfToken()) ?? "";

  const announcements = await listAnnouncementsFor({ ...user });

  // Opening the page is what counts as reading them (§9.2 read report)
  await Promise.all(announcements.map((row) => markRead({ ...user }, row.id)));

  // Anything still needing acknowledgement is shown first (§9.1)
  const ordered = [
    ...announcements.filter((row) => row.requiresAcknowledgement && !row.acknowledgedAt),
    ...announcements.filter((row) => !(row.requiresAcknowledgement && !row.acknowledgedAt)),
  ];

  const bodies = await Promise.all(ordered.map((row) => renderMarkdown(row.bodyMarkdown)));

  return (
    <>
      <PageHeader title="Duyurular" description="Yazı işlerinden gelen bildirimler." />

      {ordered.length === 0 ? (
        <EmptyState>Henüz duyuru yok.</EmptyState>
      ) : (
        <div className="space-y-5">
          {ordered.map((row, index) => {
            const needsAcknowledgement = row.requiresAcknowledgement && !row.acknowledgedAt;

            return (
              <Card key={row.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {row.pinned && (
                    <span className="rounded bg-paper px-2 py-0.5 text-xs text-muted">
                      Sabitlenmiş
                    </span>
                  )}
                  <StatusBadge status={row.severity} />
                  <h2 className="font-serif text-lg">{row.title}</h2>
                </div>
                <p className="mb-3 text-xs text-muted">{formatDate(row.publishedAt)}</p>

                <div
                  className="prose-panel text-sm"
                  // Markdown is rendered server side and sanitised by rehype-sanitize
                  dangerouslySetInnerHTML={{ __html: bodies[index]! }}
                />

                {needsAcknowledgement && (
                  <div className="mt-5 border-t border-line pt-4">
                    <Alert tone="warning">
                      Bu duyuruyu onaylamadan diğer yazar sayfalarına erişemezsiniz.
                    </Alert>
                    <div className="mt-3">
                      <PanelForm
                        action={acknowledgeAnnouncementAction}
                        csrfToken={csrfToken}
                        submitLabel="Okudum, onaylıyorum"
                      >
                        <input type="hidden" name="announcementId" value={row.id} />
                      </PanelForm>
                    </div>
                  </div>
                )}

                {row.acknowledgedAt && (
                  <p className="mt-4 text-xs text-accent">
                    {formatDate(row.acknowledgedAt)} tarihinde onayladınız.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
