"use client";

/**
 * The article body field: a markdown textarea that keeps Word's paragraphs
 * when text is pasted into it (D-251) and counts its words as they are typed
 * (D-330).
 */
import { useRef, useState, type ClipboardEvent, type ComponentProps } from "react";
import { splitIntoParagraphs } from "@/lib/pasted-paragraphs";
import { countWords, formatWordCount } from "@/lib/word-count";
import { Button, Textarea } from "./ui";

/** Replaces a range through the editing commands so Ctrl+Z still undoes it. */
function replaceRange(el: HTMLTextAreaElement, start: number, end: number, text: string) {
  el.focus();
  el.setSelectionRange(start, end);
  // Deprecated but still the only way to keep the browser's undo history
  if (!document.execCommand("insertText", false, text)) {
    el.setRangeText(text, start, end, "end");
  }
}

export function ArticleBodyTextarea({ onInput, ...props }: ComponentProps<"textarea">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [words, setWords] = useState(() =>
    countWords(typeof props.defaultValue === "string" ? props.defaultValue : String(props.value ?? "")),
  );

  function recount() {
    if (ref.current) setWords(countWords(ref.current.value));
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData("text/plain");
    // Only rich sources (Word, Google Docs) put HTML on the clipboard; text
    // copied from a plain editor may be markdown on purpose and stays as it is
    if (!event.clipboardData.types.includes("text/html") || !text.includes("\n")) return;

    event.preventDefault();
    const el = event.currentTarget;
    replaceRange(el, el.selectionStart, el.selectionEnd, splitIntoParagraphs(text));
    // setRangeText, the fallback, fires no input event
    recount();
  }

  function splitAll() {
    const el = ref.current;
    if (!el) return;
    const fixed = splitIntoParagraphs(el.value);
    if (fixed !== el.value) replaceRange(el, 0, el.value.length, fixed);
    recount();
  }

  return (
    <div className="space-y-2">
      <Textarea
        ref={ref}
        onPaste={handlePaste}
        onInput={(event) => {
          recount();
          onInput?.(event);
        }}
        {...props}
      />
      <p className="text-xs text-muted" aria-live="polite" data-testid="word-count">
        {formatWordCount(words)}
      </p>
      {/* For bodies pasted before D-251, which are stored as a single block */}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={splitAll}>
          Satır sonlarını paragrafa çevir
        </Button>
        <p className="text-xs text-muted">
          Word’den yapıştırılan metin paragraflarına kendiliğinden ayrılır. Daha
          önce tek parça yapışmış bir yazıda bu düğmeyi kullanın.
        </p>
      </div>
    </div>
  );
}
