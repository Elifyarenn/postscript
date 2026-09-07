import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { communityMessages } from "@/db/schema";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { navForRole, PanelShell } from "@/components/shell";
import { PanelForm } from "@/components/form";
import { Alert, Card, EmptyState, Field, Input, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { listChatMessages } from "@/services/community";
import { addChatMessageAction } from "./actions";

export const metadata = { title: "Topluluk sohbeti" };

/**
 * The community chat. Messages carry the author's role badge, may quote an
 * earlier message, and are masked against the banned word list on the way in.
 */
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string }>;
}) {
  const context = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { quote } = await searchParams;

  const nav = navForRole(context.user.role);
  const messages = await listChatMessages();

  let quotedPreview: { body: string; authorName: string | null } | null = null;
  if (quote) {
    const rows = await db
      .select({ body: communityMessages.body })
      .from(communityMessages)
      .where(eq(communityMessages.id, quote))
      .limit(1);
    const row = rows[0];
    if (row) quotedPreview = { body: row.body, authorName: null };
  }

  return (
    <PanelShell user={context.user} area={nav.area} items={nav.items}>
      <PageHeader
        title="Topluluk sohbeti"
        description="Herkese açık sohbet. Küfür ve hakaret içeren mesajlar otomatik yıldızlanır; yönetim kaldırabilir."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Mesajlar</h2>

          {messages.length === 0 ? (
            <EmptyState>Henüz mesaj yok. İlk mesajı siz yazın!</EmptyState>
          ) : (
            <ul className="space-y-4">
              {messages.map((message) => (
                <li key={message.id} className="rounded-md border border-line bg-paper p-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">{message.authorName ?? "Silinmiş kullanıcı"}</span>
                    {message.authorRole && <StatusBadge status={message.authorRole} />}
                    <span className="text-muted">{formatDateTime(message.createdAt)}</span>
                    <a
                      href={`/community?quote=${message.id}`}
                      className="ml-auto text-muted underline hover:text-ink"
                    >
                      Alıntıla
                    </a>
                  </div>

                  {message.quotedMessageId && (
                    <blockquote className="mb-2 border-l-2 border-line pl-3 text-sm text-muted">
                      {message.quotedAuthorName && (
                        <span className="mr-1 font-medium">{message.quotedAuthorName}:</span>
                      )}
                      {message.quotedBody ?? "(silinmiş mesaj)"}
                    </blockquote>
                  )}

                  <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Mesaj gönder</h2>

          {quotedPreview && (
            <div className="mb-4 rounded-md border border-line bg-surface p-3 text-sm">
              <p className="mb-1 text-xs text-muted">Alıntılanıyor:</p>
              <blockquote className="border-l-2 border-line pl-3 text-muted">
                {quotedPreview.body}
              </blockquote>
              <a href="/community" className="mt-1 inline-block text-xs text-muted underline">
                Alıntıyı bırak
              </a>
            </div>
          )}

          <PanelForm action={addChatMessageAction} csrfToken={csrfToken} submitLabel="Gönder">
            {quotedPreview && (
              <input type="hidden" name="quotedMessageId" value={quote} />
            )}
            <Field label="Mesaj" htmlFor="body">
              <Textarea id="body" name="body" required maxLength={1000} rows={3} />
            </Field>
          </PanelForm>
        </Card>
      </div>
    </PanelShell>
  );
}