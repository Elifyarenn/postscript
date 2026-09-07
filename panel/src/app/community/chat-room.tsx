"use client";

/**
 * The live chat room. The server renders the first page of messages; this
 * component polls `/api/community/messages?after=…` every few seconds and
 * appends whatever is new, posts through the same endpoint and keeps the
 * quote interaction in memory — no page reloads anywhere in the room.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorRole: string | null;
  quotedMessageId: string | null;
  quotedBody: string | null;
  quotedAuthorName: string | null;
};

const POLL_MS = 4000;

export function ChatRoom({
  csrfToken,
  initialMessages,
}: {
  csrfToken: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [quote, setQuote] = useState<ChatMessage | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Always-current snapshot of the list for the polling interval's closure
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, messages]);

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
        body: JSON.stringify({
          body,
          quotedMessageId: quote?.id ?? null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error ?? "Mesaj gönderilemedi.");
        return;
      }
      const created = (data as { message?: ChatMessage }).message;
      if (created) {
        setMessages((current) => [...current, created]);
      }
      setBody("");
      setQuote(null);
      setSuccess("Mesajınız gönderildi.");
    } catch {
      setError("Bağlantı hatası, tekrar deneyin.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-line bg-surface">
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Henüz mesaj yok. İlk mesajı siz yazın!
            </p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="rounded-md border border-line bg-paper p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">{message.authorName ?? "Silinmiş kullanıcı"}</span>
                  {message.authorRole && <StatusBadge status={message.authorRole} />}
                  <span className="text-muted">{formatDateTime(message.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => setQuote(message)}
                    className="ml-auto text-muted underline hover:text-ink"
                  >
                    Alıntıla
                  </button>
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
              </div>
            ))
          )}
          <div ref={bottomRef} aria-hidden className="h-px" />
        </div>
      </div>

      <div className="rounded-md border border-line bg-surface p-4">
        {success && <div className="mb-3"><Alert tone="success">{success}</Alert></div>}
        {error && <div className="mb-3"><Alert tone="danger">{error}</Alert></div>}

        {quote && (
          <div className="mb-3 rounded-md border border-line bg-paper p-3 text-sm">
            <p className="mb-1 text-xs text-muted">Alıntılanıyor — {quote.authorName}</p>
            <blockquote className="border-l-2 border-line pl-3 text-muted">{quote.body}</blockquote>
            <button
              type="button"
              onClick={() => setQuote(null)}
              className="mt-1 text-xs text-muted underline"
            >
              Alıntıyı bırak
            </button>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <Field label="Mesaj" htmlFor="chatBody">
            <Textarea
              id="chatBody"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1000}
              rows={2}
              required
            />
          </Field>
          <Button type="submit" disabled={sending || !body.trim()}>
            {sending ? "Gönderiliyor…" : "Gönder"}
          </Button>
        </form>
      </div>
    </div>
  );
}