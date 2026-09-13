/**
 * The private message screens' pieces (D-091): the conversation list and the
 * message thread. Messages are plain text, never rendered as HTML.
 *
 * There are no read receipts on purpose: when someone read a message is a fact
 * about their day, not the sender's to see.
 */
import Link from "next/link";
import { cn, formatDateTime } from "@/lib/utils";
import { Avatar } from "./social";
import type { ConversationMessage, ConversationSummary } from "@/services/direct-messages";

export function ConversationList({
  conversations,
  activeUsername,
}: {
  conversations: ConversationSummary[];
  activeUsername?: string;
}) {
  if (conversations.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted">Henüz konuşma yok.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {conversations.map((conversation) => {
        const { username, penName } = conversation.other;
        const last = conversation.lastMessage;
        const content = (
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar username={username ?? "?"} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">
                  {username ? (penName ?? username) : "Silinmiş kullanıcı"}
                </span>
                <span className="shrink-0 text-xs text-muted">{formatDateTime(last.createdAt)}</span>
              </p>
              <p className="flex items-center justify-between gap-2 text-xs text-muted">
                <span className="truncate">
                  {last.isOwn ? "Siz: " : ""}
                  {last.body}
                </span>
                {conversation.unread > 0 && (
                  <span className="rounded-full bg-accent px-1.5 text-[11px] leading-5 font-semibold text-white">
                    {conversation.unread}
                  </span>
                )}
              </p>
            </div>
          </div>
        );

        return (
          <li
            key={conversation.conversationId}
            className={cn(username !== null && username === activeUsername && "bg-paper")}
          >
            {username ? (
              <Link href={`/social/messages/${username}`} className="block hover:bg-paper">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MessageThread({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">Henüz mesaj yok.</p>;
  }

  return (
    <ol className="space-y-3">
      {messages.map((message) => (
        <li key={message.id} className={cn("flex", message.isOwn ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
              message.isOwn
                ? "rounded-br-sm bg-accent text-white"
                : "rounded-bl-sm border border-line bg-surface",
            )}
          >
            <p className="break-words whitespace-pre-wrap">{message.body}</p>
            <p
              className={cn(
                "mt-1 flex items-center gap-2 text-[11px]",
                message.isOwn ? "justify-end text-white/70" : "text-muted",
              )}
            >
              <span>{formatDateTime(message.createdAt)}</span>
              {!message.isOwn && (
                <Link
                  href={`/social/report?type=direct_message&id=${message.id}`}
                  className="hover:text-danger"
                >
                  Bildir
                </Link>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
