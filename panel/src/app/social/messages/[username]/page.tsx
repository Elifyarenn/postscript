import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ban, Ellipsis, FaceSlightlySmiling, Flag, Info, Paperclip, Phone, Send, X } from "lucide-react";
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

/**
 * One conversation in the design's three columns: list, thread, the other
 * member (D-113). The design's call, "more", attachment and emoji buttons are
 * drawn but disabled until those exist (D-116). Its "online" line and read
 * ticks are left out on purpose (D-091).
 */
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
            <Avatar username={other.username} size="md" imageUrl={other.avatarUrl} />
            <div className="min-w-0">
              <Link href={`/social/u/${other.username}`} className="dm-chat-name">
                {memberName(other)}
              </Link>
              <p className="dm-chat-handle">@{other.username}</p>
            </div>
            <Link href="/social/messages" className="dm-back">
              ← Mesajlar
            </Link>
            <div className="dm-head-actions">
              <button type="button" disabled className="dm-icon" title="Sesli arama yakında" aria-label="Sesli arama (yakında)">
                <Phone aria-hidden />
              </button>
              <Link href={`/social/u/${other.username}`} className="dm-icon" title="Profili gör" aria-label="Profili gör">
                <Info aria-hidden />
              </Link>
              <button type="button" disabled className="dm-icon" title="Diğer işlemler yakında" aria-label="Diğer işlemler (yakında)">
                <Ellipsis aria-hidden />
              </button>
            </div>
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
                submitContent={<Send aria-hidden className="size-5" />}
              >
                <input type="hidden" name="username" value={other.username} />
                <div className="dm-compose-row">
                  <button type="button" disabled className="dm-icon" title="Dosya ekleme yakında" aria-label="Dosya ekle (yakında)">
                    <Paperclip aria-hidden />
                  </button>
                  <label htmlFor="dmBody" className="sr-only">
                    Mesajınız
                  </label>
                  <Textarea
                    id="dmBody"
                    name="body"
                    required
                    maxLength={MAX_DIRECT_MESSAGE_LENGTH}
                    rows={1}
                    placeholder="Bir mesaj yazın…"
                    className="dm-input"
                  />
                  <button type="button" disabled className="dm-icon" title="Emoji yakında" aria-label="Emoji (yakında)">
                    <FaceSlightlySmiling aria-hidden />
                  </button>
                </div>
              </PanelForm>
            ) : (
              <Alert tone="warning">{view.problem}</Alert>
            )}
          </div>
        </section>

        <aside className="dm-info" aria-label={`@${other.username} hakkında`}>
          <div className="dm-info-card">
            <Avatar username={other.username} size="lg" imageUrl={other.avatarUrl} />
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

          {/* Messages carry no attachments yet, so both lists wait empty (D-116) */}
          <section className="dm-info-section" aria-labelledby="dm-media-title">
            <h2 id="dm-media-title">Paylaşılan medya</h2>
            <div className="dm-media-grid" aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="dm-info-empty">Henüz paylaşılan medya yok.</p>
          </section>

          <section className="dm-info-section" aria-labelledby="dm-files-title">
            <h2 id="dm-files-title">Dosyalar</h2>
            <p className="dm-info-empty">Henüz dosya yok.</p>
          </section>

          <section className="dm-info-section" aria-labelledby="dm-actions-title">
            <h2 id="dm-actions-title">Hızlı işlemler</h2>
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
              {/* The design's third quick action; reporting is where it already lives (D-084) */}
              <Link
                href={`/social/report?type=member&id=${other.id}`}
                className="dm-action dm-report"
              >
                <Flag aria-hidden className="size-4" />
                Bildir
              </Link>
            </div>
            <p className="dm-info-empty mt-3">
              Özel mesajları yöneticiler okuyamaz. Bir mesajı bildirirseniz yalnızca o mesajın metni
              incelemeye gönderilir.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
