"use client";

/**
 * The live chat room, WhatsApp/Discord style.
 *
 * Own messages sit right in pastel bubbles, everyone else's left; the sender
 * name and role badge crown each bubble and the time hangs off its bottom
 * right corner. The input bar is a sticky footer that never scrolls away,
 * quoting previews above it, and admins can remove any message inline. New
 * messages arrive by polling; nothing here reloads the page.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Textarea } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  authorId: string | null;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorRole: string | null;
  quotedMessageId: string | null;
  quotedBody: string | null;
  quotedAuthorName: string | null;
};

const POLL_MS = 4000;

/** Compact chat clock: time when today, short date otherwise. */
function chatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return time;
  }
  const day = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit" }).format(date);
  return `${day} ${time}`;
}

/** "Alıntılanan: Ad - özet…" */
function quoteLabel(message: ChatMessage): string {
  const body = message.body.replace(/\s+/g, " ").trim();
  return `Alıntılanan: ${message.authorName ?? "Silinmiş kullanıcı"} - ${
    body.length > 60 ? `${body.slice(0, 60)}…` : body
  }`;
}

export function ChatRoom({
  csrfToken,
  currentUserId,
  isAdmin,
  initialMessages,
}: {
  csrfToken: string;
  currentUserId: string;
  isAdmin: boolean;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [quote, setQuote] = useState<ChatMessage | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // First paint lands at the bottom
  useEffect(() => {
    scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow new arrivals when they are posted or polled in
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  // Poll for new messages
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const after = messagesRef.current.at(-1)?.createdAt;
        const response = await fetch(
          `/api/community/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { messages?: ChatMessage[] };
        const fresh = data.messages ?? [];
        if (fresh.length > 0 && !cancelled) {
          setMessages((current) => {
            const known = new Set(current.map((m) => m.id));
            return [...current, ...fresh.filter((m) => !known.has(m.id))];
          });
        }
      } catch {
        // A failed poll must never break the room; the next tick retries
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!body.trim()) return;

    setSending(true);
    try {
      const response = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ body, quotedMessageId: quote?.id ?? null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error ?? "Mesaj gönderilemedi.");
        return;
      }
      const created = (data as { message?: ChatMessage }).message;
      if (created) setMessages((current) => [...current, created]);
      setBody("");
      setQuote(null);
      setSuccess("Mesajınız gönderildi.");
    } catch {
      setError("Bağlantı hatası, tekrar deneyin.");
    } finally {
      setSending(false);
    }
  }

  async function removeMessage(message: ChatMessage) {
    if (!window.confirm("Bu mesajı sohbetten kaldırmak istiyor musunuz?")) return;
    setError(null);
    try {
      const response = await fetch(`/api/community/messages/${message.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Mesaj kaldırılamadı.");
        return;
      }
      setMessages((current) => current.filter((m) => m.id !== message.id));
      if (quote?.id === message.id) setQuote(null);
    } catch {
      setError("Bağlantı hatası, tekrar deneyin.");
    }
  }

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-line bg-paper"
      style={{ height: "calc(100dvh - 235px)", minHeight: "26rem" }}
    >
      {/* The stream */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-surface p-3 sm:p-4"
      >
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">
            Henüz mesaj yok. İlk mesajı siz yazın!
          </p>
        ) : (
          messages.map((message) => {
            const own = message.authorId === currentUserId;
            return (
              <div
                key={message.id}
                className={cn("flex w-full", own ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "group max-w-[85%] rounded-2xl border px-3 py-2 sm:max-w-[70%]",
                    own
                      ? "rounded-br-md border-accent/25 bg-accent-soft"
                      : "rounded-bl-md border-line bg-paper",
                  )}
                >
                  {/* Sender + role badge */}
                  <div className="mb-0.5 flex items-center gap-1.5 text-[11px] leading-tight">
                    <span className={cn("font-semibold", own ? "text-accent" : "text-ink/80")}>
                      {own ? "Sen" : (message.authorName ?? "Silinmiş kullanıcı")}
                    </span>
                    {message.authorRole && <StatusBadge status={message.authorRole} />}
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuote(message)}
                        className="rounded px-1 text-[10px] text-muted underline opacity-100 hover:text-ink md:opacity-0 md:group-hover:opacity-100"
                      >
                        Alıntıla
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => removeMessage(message)}
                          title="Mesajı kaldır"
                          className="rounded px-1 text-[10px] text-danger underline opacity-100 hover:text-danger/80 md:opacity-0 md:group-hover:opacity-100"
                        >
                          Sil
                        </button>
                      )}
                    </span>
                  </div>

                  {/* Quoted block inside the bubble */}
                  {message.quotedMessageId && (
                    <blockquote className="mb-1 rounded-md border-l-2 border-line bg-surface px-2 py-1 text-xs text-muted">
                      {message.quotedAuthorName && (
                        <span className="mr-1 font-medium">{message.quotedAuthorName}:</span>
                      )}
                      {message.quotedBody ?? "(silinmiş mesaj)"}
                    </blockquote>
                  )}

                  <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>

                  {/* Time, bottom right */}
                  <p
                    className={cn(
                      "mt-0.5 text-right text-[10px] leading-none",
                      own ? "text-accent/60" : "text-muted/70",
                    )}
                  >
                    {chatTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky input bar */}
      <div className="border-t border-line bg-surface p-3">
        {success && <div className="mb-2"><Alert tone="success">{success}</Alert></div>}
        {error && <div className="mb-2"><Alert tone="danger">{error}</Alert></div>}

        {quote && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-line bg-paper px-3 py-1.5 text-xs">
            <span className="truncate text-muted">
              <span className="font-medium text-ink">{quoteLabel(quote)}</span>
            </span>
            <button
              type="button"
              onClick={() => setQuote(null)}
              className="shrink-0 text-muted underline hover:text-ink"
            >
              Bırak
            </button>
          </div>
        )}

        <form onSubmit={submit} className="flex items-end gap-2">
          <Textarea
            aria-label="Mesaj"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1000}
            rows={1}
            placeholder="Mesajınızı yazın…"
            required
            className="max-h-32 min-w-0 flex-1 resize-none"
          />
          <Button type="submit" disabled={sending || !body.trim()} className="shrink-0">
            {sending ? "…" : "Gönder"}
          </Button>
        </form>
      </div>
    </div>
  );
}