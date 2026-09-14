import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ban, X } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { getMemberSettings } from "@/services/social";
import {
  listConversations,
  MAX_DIRECT_MESSAGE_LENGTH,
  openConversation,
} from "@/services/direct-messages";
import { ActionButton, PanelForm } from "@/components/form";
import { Alert, StatusBadge, Textarea } from "@/components/ui";
import { Avatar, memberName } from "@/components/social";
import { ConversationColumn, MessageThread } from "@/components/messages";
import { AutoRefresh } from "@/components/auto-refresh";
import { blockAction, clearConversationAction, sendDirectMessageAction, unblockAction } from "../../actions";

export const metadata = { title: "Mesajlar" };

/** How often an open conversation looks for new messages. */
const REFRESH_MS = 5000;

/** One conversation in the design's three columns: list, thread, the other member (D-113). */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { username: rawUsername } = await params;

  const { username } = await getMemberSettings({ ...user });
  if (!username) redirect("/social/messages");

  // Opened first: opening marks the conversation read, and the list below
  // should already show it that way
  const view = await openConversation({ ...user }, decodeURIComponent(rawUsername)).catch(
    (error: unknown) => {
      if (isAppError(error) && (error.status === 404 || error.status === 400)) notFound();
      throw error;
    },
  );
  const conversations = await listConversations({ ...user });
  const other = view.other;
  const fields = { username: other.username };

  return (
    <>
      <AutoRefresh intervalMs={REFRESH_MS} />

      <div className="dm-layout has-info">
        <ConversationColumn conversations={conversations} activeUsername={other.username} />

        <section className="dm-chat" aria-label={`@${other.username} ile konuşma`}>
          <header className="dm-chat-head">
            <Avatar username={other.username} size="md" />
            <div className="min-w-0">
              <Link href={`/social/u/${other.username}`} className="dm-chat-name">
                {memberName(other)}
              </Link>
              <p className="dm-chat-handle">@{other.username}</p>
            </div>
            <Link href="/social/messages" className="dm-back">
              ← Mesajlar
            </Link>
          </header>

          <div className="dm-chat-body">
            <MessageThread messages={view.messages} />
          </div>

          <div className="dm-composer">
            {view.canSend ? (
              <PanelForm
                action={sendDirectMessageAction}
                csrfToken={csrfToken}
                submitLabel="Gönder"
                submitClassName="dm-send"
              >
                <input type="hidden" name="username" value={other.username} />
                <label htmlFor="dmBody" className="sr-only">
                  Mesajınız
                </label>
                <Textarea
                  id="dmBody"
                  name="body"
                  required
                  maxLength={MAX_DIRECT_MESSAGE_LENGTH}
                  rows={2}
                  placeholder="Bir mesaj yazın…"
                  className="dm-input"
                />
              </PanelForm>
            ) : (
              <Alert tone="warning">{view.problem}</Alert>
            )}
          </div>
        </section>

        <aside className="dm-info" aria-label={`@${other.username} hakkında`}>
          <div className="dm-info-card">
            <Avatar username={other.username} size="lg" />
            <p className="mt-3 font-serif text-lg">{memberName(other)}</p>
            <p className="text-sm text-muted">@{other.username}</p>
            {other.role !== "user" && (
              <span className="mt-1">
                <StatusBadge status={other.role} />
              </span>
            )}
            {other.bio && <p className="mt-3 text-sm whitespace-pre-wrap">{other.bio}</p>}
            <Link href={`/social/u/${other.username}`} className="mt-3 text-sm text-accent underline">
              Profili gör
            </Link>
          </div>

          <p className="border-t border-line pt-4 text-xs text-muted">
            Özel mesajları yöneticiler okuyamaz. Bir mesajı bildirirseniz yalnızca o mesajın metni
            incelemeye gönderilir.
          </p>

          <h2>Hızlı işlemler</h2>
          <div className="dm-actions">
            {view.iBlocked ? (
              <ActionButton action={unblockAction} csrfToken={csrfToken} label="Engeli kaldır" fields={fields} />
            ) : (
              <ActionButton
                action={blockAction}
                csrfToken={csrfToken}
                label="Engelle"
                variant="ghost"
                fields={fields}
                className="dm-action"
                confirmMessage={`@${other.username} engellensin mi? Birbirinize mesaj gönderemezsiniz.`}
                display={
                  <>
                    <Ban aria-hidden className="size-4" />
                    Engelle
                  </>
                }
              />
            )}
            {view.conversationId && (
              <ActionButton
                action={clearConversationAction}
                csrfToken={csrfToken}
                label="Konuşmayı sil"
                variant="ghost"
                fields={fields}
                className="dm-action"
                confirmMessage="Konuşma yalnızca sizin görünümünüzden silinir. Devam edilsin mi?"
                display={
                  <>
                    <X aria-hidden className="size-4" />
                    Konuşmayı sil
                  </>
                }
              />
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
