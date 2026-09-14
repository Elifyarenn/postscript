/**
 * The private message screens' pieces (D-091), laid out as in the "dm" design
 * since D-113: the conversation column, the list and the message thread.
 * Messages are plain text, never rendered as HTML.
 *
 * There are no read receipts and no "online" dot on purpose: when someone read
 * a message, or is on the site, is a fact about their day, not the sender's to
 * see.
 */
import Link from "next/link";
import { Search, SquarePen } from "lucide-react";
import { formatClockTime, formatDayLabel, formatRelativeTime } from "@/lib/relative-time";
import { cn, formatDateTime } from "@/lib/utils";
import { Avatar } from "./social";
import { Sparkle } from "./site-ui";
import type { ConversationMessage, ConversationSummary } from "@/services/direct-messages";

export function ConversationList({
  conversations,
  activeUsername,
}: {
  conversations: ConversationSummary[];
  activeUsername?: string;
}) {
  if (conversations.length === 0) {
    return <p className="dm-empty">Henüz konuşma yok.</p>;
  }

  return (
    <ul className="dm-conversations">
      {conversations.map((conversation) => {
        const { username, penName } = conversation.other;
        const last = conversation.lastMessage;
        const content = (
          <>
            <Avatar username={username ?? "?"} size="md" />
            <div className="min-w-0 flex-1">
              <p className="dm-conversation-row">
                <span className="dm-name">{username ? (penName ?? username) : "Silinmiş kullanıcı"}</span>
                <span className="dm-time">{formatRelativeTime(last.createdAt)}</span>
              </p>
              <p className="dm-conversation-row">
                <span className="dm-snippet">
                  {last.isOwn ? "Siz: " : ""}
                  {last.body}
                </span>
                {conversation.unread > 0 && <span className="dm-unread">{conversation.unread}</span>}
              </p>
            </div>
          </>
        );

        return (
          <li
            key={conversation.conversationId}
            className={cn(username !== null && username === activeUsername && "is-active")}
          >
            {username ? (
              <Link href={`/social/messages/${username}`} className="dm-conversation">
                {content}
              </Link>
            ) : (
              <div className="dm-conversation">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The left column: the title, the "new conversation" box and the list. */
export function ConversationColumn({
  conversations,
  activeUsername,
}: {
  conversations: ConversationSummary[];
  activeUsername?: string;
}) {
  return (
    <section className="dm-column" aria-labelledby="dm-title">
      <h1 id="dm-title" className="dm-title">
        Mesajlar <Sparkle className="dm-title-star" />
      </h1>

      {/* A plain GET form: opening a conversation changes nothing */}
      <form method="get" action="/social/messages" className="dm-search">
        <Search aria-hidden className="size-4 shrink-0" />
        <label htmlFor="dm-to" className="sr-only">
          Yeni konuşma için kullanıcı adı
        </label>
        <input
          id="dm-to"
          name="to"
          placeholder="@kullanıcıadı ile yeni konuşma"
          required
          maxLength={21}
          autoComplete="off"
        />
        <button type="submit" aria-label="Konuşmayı aç" title="Konuşmayı aç">
          <SquarePen aria-hidden className="size-4" />
        </button>
      </form>

      <ConversationList conversations={conversations} activeUsername={activeUsername} />
    </section>
  );
}

export function MessageThread({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">Henüz mesaj yok.</p>;
  }

  // A day chip opens every new day of the conversation, as in the design
  const items = [];
  let previousDay = "";
  for (const message of messages) {
    const day = formatDayLabel(message.createdAt);
    if (day !== previousDay) {
      items.push(
        <li key={`day-${day}`} className="dm-day">
          <span>{day}</span>
        </li>,
      );
      previousDay = day;
    }
    items.push(
      <li key={message.id} className={cn("dm-message", message.isOwn ? "is-own" : "is-other")}>
        <div className="dm-bubble">
          <p className="dm-text">{message.body}</p>
          <p className="dm-meta">
            <time dateTime={message.createdAt.toISOString()} title={formatDateTime(message.createdAt)}>
              {formatClockTime(message.createdAt)}
            </time>
            {!message.isOwn && (
              <Link href={`/social/report?type=direct_message&id=${message.id}`}>Bildir</Link>
            )}
          </p>
        </div>
      </li>,
    );
  }

  return <ol className="dm-thread">{items}</ol>;
}
