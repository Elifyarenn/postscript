/**
 * The private message screens' pieces (D-091), laid out as in the "dm" design
 * since D-113: the conversation column, the list and the message thread.
 * Messages are plain text, never rendered as HTML.
 *
 * The sender's own messages carry a tick: one when sent, two once the other
 * member has opened the conversation (D-184, reversing D-091 at the owner's
 * request). Only that it was read is shown, never when. There is still no
 * "online" dot: being on the site is a fact about someone's day.
 */
import Link from "next/link";
import { Check, CheckCheck } from "lucide-react";
import { formatClockTime, formatDayLabel, formatRelativeTime } from "@/lib/relative-time";
import { cn, formatDateTime } from "@/lib/utils";
import { Avatar } from "./social";
import { Sparkle } from "./site-ui";
import type { ConversationMessage, ConversationSummary } from "@/services/direct-messages";
import type { MemberListItem } from "@/services/social";

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
        const { username } = conversation.other;
        const last = conversation.lastMessage;
        const content = (
          <>
            <Avatar username={username ?? "?"} size="md" imageUrl={conversation.other.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="dm-conversation-row">
                <span className="dm-name">{username ?? "Silinmiş kullanıcı"}</span>
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

/**
 * The members who follow the reader and are followed back (D-143): the people
 * a conversation can be started with, without knowing their handle by heart.
 * Anyone already in the conversation list above is left out.
 */
function MutualFollows({
  members,
  activeUsername,
}: {
  members: MemberListItem[];
  activeUsername?: string;
}) {
  if (members.length === 0) return null;

  return (
    <section className="dm-mutuals" aria-labelledby="dm-mutuals-title">
      <h2 id="dm-mutuals-title" className="dm-mutuals-title">
        Takipleştikleriniz
      </h2>
      <ul>
        {members.map((member) => (
          <li key={member.username} className={cn(member.username === activeUsername && "is-active")}>
            <Link href={`/social/messages/${member.username}`} className="dm-conversation">
              <Avatar username={member.username} size="md" imageUrl={member.avatarUrl} />
              <span className="dm-name">{member.username}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The left column: the title, the conversations and the mutual follows. A new
 * conversation starts from someone's profile or from the mutual follows; the
 * search box of D-147 was taken out (D-183).
 */
export function ConversationColumn({
  conversations,
  mutualFollows = [],
  activeUsername,
}: {
  conversations: ConversationSummary[];
  /** Members to offer a new conversation with (D-143). */
  mutualFollows?: MemberListItem[];
  activeUsername?: string;
}) {
  return (
    <section className="dm-column" aria-labelledby="dm-title">
      <h1 id="dm-title" className="dm-title">
        Mesajlar <Sparkle className="dm-title-star" />
      </h1>

      <ConversationList conversations={conversations} activeUsername={activeUsername} />

      <MutualFollows members={mutualFollows} activeUsername={activeUsername} />
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
            {message.isOwn ? (
              message.readByOther ? (
                <span className="dm-tick is-read" role="img" aria-label="Okundu" title="Okundu">
                  <CheckCheck aria-hidden className="size-4" />
                </span>
              ) : (
                <span className="dm-tick" role="img" aria-label="Gönderildi" title="Gönderildi">
                  <Check aria-hidden className="size-4" />
                </span>
              )
            ) : (
              <Link href={`/social/report?type=direct_message&id=${message.id}`}>Bildir</Link>
            )}
          </p>
        </div>
      </li>,
    );
  }

  return <ol className="dm-thread">{items}</ol>;
}
