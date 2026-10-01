"use client";

/**
 * The post composer's text field (D-294): a live count against the 250
 * characters, member suggestions after "@" and the member's communities after
 * "ps/". A chosen community is not kept in the text: it shows as "ps/slug"
 * above the field and travels in the hidden `communityId`, which the server
 * checks again (membership, not archived) before the post is stored.
 *
 * The suggestions are a listbox driven from the textarea, so the keyboard
 * never leaves it: arrows move, Enter or Tab picks, Escape closes.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { MAX_POST_LENGTH, tokenAtCaret, type ComposerToken } from "@/lib/post-text";
import { cn } from "@/lib/utils";
import { suggestCommunitiesAction, suggestMentionsAction } from "@/app/social/actions";
import { Field, Textarea } from "./ui";

type Community = { id: string; slug: string; name?: string };
type Suggestion = { key: string; label: string; detail?: string; apply: () => void };

export function PostComposerField({
  id,
  label,
  hint,
  initialCommunity = null,
  allowCommunity = true,
}: {
  id: string;
  label: string;
  hint: string;
  /** Chosen already when sharing from inside a community. */
  initialCommunity?: Community | null;
  /** A reply belongs to its thread, so it offers no community. */
  allowCommunity?: boolean;
}) {
  const [text, setText] = useState("");
  const [community, setCommunity] = useState<Community | null>(initialCommunity);
  const [token, setToken] = useState<ComposerToken | null>(null);
  // Suggestions are kept with the token they answer, so a stale answer never shows
  const [results, setResults] = useState<{ for: string; items: Suggestion[] }>({ for: "", items: [] });
  const [active, setActive] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const listId = useId();

  // Only a token worth asking about: a community where one may be chosen, a member after two letters (D-186)
  const askable =
    token && (token.kind === "mention" ? token.query.length >= 2 : allowCommunity) ? token : null;
  const tokenKey = askable ? `${askable.kind}:${askable.start}:${askable.query}` : "";
  const items = askable && results.for === tokenKey ? results.items : [];

  function close() {
    setToken(null);
    setResults({ for: "", items: [] });
  }

  function replaceToken(at: ComposerToken, insert: string) {
    const current = area.current?.value ?? "";
    const next = (current.slice(0, at.start) + insert + current.slice(at.end)).slice(0, MAX_POST_LENGTH);
    setText(next);
    close();
    const caret = Math.min(at.start + insert.length, next.length);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(caret, caret);
    });
  }

  // The form clears itself after a successful post; follow it, back to the page's community
  useEffect(() => {
    const form = area.current?.form;
    if (!form) return;
    const onReset = () => {
      setText("");
      setCommunity(initialCommunity);
      setToken(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [initialCommunity]);

  // Ask the server for suggestions shortly after typing stops
  useEffect(() => {
    if (!askable) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      let found: Suggestion[];
      if (askable.kind === "mention") {
        const members = await suggestMentionsAction(askable.query);
        found = members.map((member) => ({
          key: member.username,
          label: `@${member.username}`,
          apply: () => replaceToken(askable, `@${member.username} `),
        }));
      } else {
        const choices = await suggestCommunitiesAction(askable.query);
        found = choices.map((choice) => ({
          key: choice.id,
          label: `ps/${choice.slug}`,
          detail: choice.name,
          apply: () => {
            replaceToken(askable, "");
            setCommunity(choice);
          },
        }));
      }
      if (cancelled) return;
      setResults({ for: tokenKey, items: found });
      setActive(0);
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // The key names the token completely; the token object itself changes on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenKey]);

  function readToken(value: string, caret: number) {
    setToken(tokenAtCaret(value, caret));
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      items[active]?.apply();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  const left = MAX_POST_LENGTH - text.length;
  const open = items.length > 0;
  const needsMore = token?.kind === "mention" && token.query.length < 2;

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      {community && <input type="hidden" name="communityId" value={community.id} />}
      {allowCommunity && community && (
        <p className="flex items-center gap-1.5 text-xs">
          <span className="text-muted">Topluluk:</span>
          <span className="font-medium text-accent">ps/{community.slug}</span>
          <button
            type="button"
            onClick={() => setCommunity(null)}
            className="rounded p-0.5 text-muted hover:text-ink"
            aria-label={`ps/${community.slug} topluluğunu kaldır`}
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </p>
      )}
      <div className="relative">
        <Textarea
          ref={area}
          id={id}
          name="body"
          required
          maxLength={MAX_POST_LENGTH}
          rows={3}
          className="min-h-20 font-sans"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            readToken(event.target.value, event.target.selectionStart);
          }}
          onClick={(event) => readToken(event.currentTarget.value, event.currentTarget.selectionStart)}
          onKeyUp={(event) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
              readToken(event.currentTarget.value, event.currentTarget.selectionStart);
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(close, 150)}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-line bg-surface py-1 text-sm shadow-lg"
          >
            {items.map((item, index) => (
              <li
                key={item.key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // mousedown, not click: the textarea's blur must not close the list first
                onMouseDown={(event) => {
                  event.preventDefault();
                  item.apply();
                }}
                onMouseEnter={() => setActive(index)}
                className={cn("cursor-pointer px-3 py-1.5", index === active && "bg-accent-soft text-accent")}
              >
                <span className="font-medium">{item.label}</span>
                {item.detail && <span className="ml-2 text-xs text-muted">{item.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="flex justify-between text-xs" aria-live="polite">
        <span className="text-muted">
          {needsMore
            ? "Kişi önerisi için en az 2 harf yazın."
            : allowCommunity
              ? "@ ile kişi, ps/ ile topluluk seçebilirsiniz."
              : "@ ile kişi seçebilirsiniz."}
        </span>
        <span className={cn("tabular-nums", left <= 20 ? "text-danger" : "text-muted")}>
          {text.length}/{MAX_POST_LENGTH}
        </span>
      </p>
    </Field>
  );
}
