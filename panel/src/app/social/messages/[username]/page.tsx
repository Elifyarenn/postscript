import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { Alert, Card, Field, StatusBadge, Textarea } from "@/components/ui";
import { Avatar, memberName } from "@/components/social";
import { ConversationList, MessageThread } from "@/components/messages";
import { AutoRefresh } from "@/components/auto-refresh";
import { blockAction, clearConversationAction, sendDirectMessageAction, unblockAction } from "../../actions";

export const metadata = { title: "Mesajlar" };

/** How often an open conversation looks for new messages. */
const REFRESH_MS = 5000;

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

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr_15rem]">
        <Card className="hidden h-fit p-0 lg:block">
          <h2 className="border-b border-line px-4 py-3 font-serif text-lg">
            <Link href="/social/messages" className="hover:text-accent">
              Mesajlar
            </Link>
          </h2>
          <ConversationList conversations={conversations} activeUsername={other.username} />
        </Card>

        <Card className="flex min-h-[28rem] flex-col p-0">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Avatar username={other.username} size="sm" />
            <div>
              <Link href={`/social/u/${other.username}`} className="font-medium hover:text-accent">
                {memberName(other)}
              </Link>
              <p className="text-xs text-muted">@{other.username}</p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <MessageThread messages={view.messages} />
          </div>

          <div className="border-t border-line px-4 py-3">
            {view.canSend ? (
              <PanelForm action={sendDirectMessageAction} csrfToken={csrfToken} submitLabel="Gönder">
                <input type="hidden" name="username" value={other.username} />
                <Field label="Mesajınız" htmlFor="dmBody">
                  <Textarea
                    id="dmBody"
                    name="body"
                    required
                    maxLength={MAX_DIRECT_MESSAGE_LENGTH}
                    rows={2}
                    className="min-h-16 font-sans"
                  />
                </Field>
              </PanelForm>
            ) : (
              <Alert tone="warning">{view.problem}</Alert>
            )}
          </div>
        </Card>

        <Card className="h-fit">
          <div className="flex flex-col items-center text-center">
            <Avatar username={other.username} size="lg" />
            <p className="mt-3 font-serif text-lg">{memberName(other)}</p>
            <p className="text-sm text-muted">@{other.username}</p>
            {other.role !== "user" && (
              <span className="mt-1">
                <StatusBadge status={other.role} />
              </span>
            )}
            {other.bio && <p className="mt-3 text-sm whitespace-pre-wrap">{other.bio}</p>}
            <Link href={`/social/u/${other.username}`} className="mt-3 text-sm text-accent">
              Profili gör
            </Link>
          </div>

          <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
            Özel mesajları yöneticiler okuyamaz. Bir mesajı bildirirseniz yalnızca o mesajın metni
            incelemeye gönderilir.
          </p>

          <div className="mt-4 flex flex-col items-start gap-2">
            {view.iBlocked ? (
              <ActionButton action={unblockAction} csrfToken={csrfToken} label="Engeli kaldır" fields={fields} />
            ) : (
              <ActionButton
                action={blockAction}
                csrfToken={csrfToken}
                label="Engelle"
                variant="ghost"
                fields={fields}
                confirmMessage={`@${other.username} engellensin mi? Birbirinize mesaj gönderemezsiniz.`}
              />
            )}
            {view.conversationId && (
              <ActionButton
                action={clearConversationAction}
                csrfToken={csrfToken}
                label="Konuşmayı sil"
                variant="ghost"
                fields={fields}
                confirmMessage="Konuşma yalnızca sizin görünümünüzden silinir. Devam edilsin mi?"
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
