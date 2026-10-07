"use client";

/**
 * The article body field: a markdown textarea that keeps Word's paragraphs
 * when text is pasted into it (D-251) and counts its words as they are typed
 * (D-330). It also warns past 500 words and shows the category's 1600-word
 * total in the issue as the text and the category change (D-331); the server
 * enforces the total, this only shows it.
 */
import { useEffect, useRef, useState, type ClipboardEvent, type ComponentProps } from "react";
import { ARTICLE_WORD_WARNING, CATEGORY_WORD_LIMIT, checkCategoryBudget } from "@/lib/category-budget";
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

export type CategoryBudgetProps = {
  /** Words per category in the issue, this article left out. */
  totals: Record<string, number>;
  /** The form's category field (select or input), read live. */
  categoryFieldId: string;
  issueNumber: number;
  /** This article's stored count and category, so an edit is judged like the server does. */
  stored?: { words: number; category: string | null };
};

function readField(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  return el?.value.trim() ?? "";
}

export function ArticleBodyTextarea({
  onInput,
  budget,
  ...props
}: ComponentProps<"textarea"> & { budget?: CategoryBudgetProps }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [category, setCategory] = useState(budget?.stored?.category ?? "");

  // The category is another field of the same form; follow it as it changes
  useEffect(() => {
    if (!budget) return;
    const el = document.getElementById(budget.categoryFieldId);
    const sync = () => setCategory(readField(budget.categoryFieldId));
    sync();
    el?.addEventListener("input", sync);
    el?.addEventListener("change", sync);
    return () => {
      el?.removeEventListener("input", sync);
      el?.removeEventListener("change", sync);
    };
  }, [budget]);
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
      {/* A warning only: saving and sending stay open (D-331) */}
      {words > ARTICLE_WORD_WARNING && (
        <p role="status" className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
          Yazı {formatWordCount(words)}; önerilen üst sınır {ARTICLE_WORD_WARNING} kelime. Kaydedebilir ve
          gönderebilirsiniz; bağlayıcı olan, kategorinin bu sayıdaki toplam {CATEGORY_WORD_LIMIT.toLocaleString("tr-TR")} kelimelik sınırıdır.
        </p>
      )}
      {budget && <BudgetLine budget={budget} category={category} words={words} />}
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

/** The category's total in the issue, what is left, and why a save would be refused. */
function BudgetLine({ budget, category, words }: { budget: CategoryBudgetProps; category: string; words: number }) {
  if (!category) {
    return <p className="text-xs text-muted">Kategori seçilince bu sayıdaki kategori toplamı burada görünür.</p>;
  }
  const others = budget.totals[category] ?? 0;
  const sameBucket = budget.stored !== undefined && budget.stored.category === category;
  const check = checkCategoryBudget({ others, before: sameBucket ? budget.stored!.words : 0, after: words });
  const tr = (n: number) => n.toLocaleString("tr-TR");
  return (
    <p
      aria-live="polite"
      data-testid="category-budget"
      className={
        check.ok
          ? "text-xs text-muted"
          : "rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
      }
    >
      {category} · Sayı {budget.issueNumber} kategori toplamı: {tr(check.total)} / {tr(CATEGORY_WORD_LIMIT)} kelime
      {" · "}
      {check.remaining >= 0 ? `kalan hak ${tr(check.remaining)} kelime` : `${tr(-check.remaining)} kelime fazla`}
      {!check.ok &&
        `. Bu hâliyle kaydedilemez: diğer yazılar ${tr(others)} kelime kullanıyor, bu yazıya en fazla ${tr(Math.max(0, CATEGORY_WORD_LIMIT - others))} kelime kalıyor.`}
    </p>
  );
}
