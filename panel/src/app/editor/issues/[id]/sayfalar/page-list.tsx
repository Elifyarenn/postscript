"use client";

/**
 * The issue's pages, in order (D-236).
 *
 * Dragging is the quick way and the arrows are the sure way: both write the
 * same order, and a keyboard alone is enough. The order on screen is not the
 * order in the issue until it is saved, and the page says so rather than
 * letting a reload quietly undo the work.
 *
 * Relationships are held by page id, never by page number, so moving a page
 * cannot send a jump somewhere else.
 */
import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, GripVertical, ImageUp, Link2, Loader2 } from "lucide-react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionButton, SubmitRow } from "@/components/form";
import type { ActionState } from "@/lib/action";
import {
  duplicateIssuePageAction,
  moveIssuePageAction,
  removeIssuePageAction,
  reorderIssuePagesAction,
  updatePageMetaAction,
} from "./actions";

export type ListedPage = {
  id: string;
  position: number;
  template: string;
  label: string | null;
  tocTitle: string | null;
  inContents: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  transcript: string | null;
  hotspotCount: number;
  unfinishedCount: number;
};

const ROLES = [
  { id: "full_bleed", label: "Sayfa" },
  { id: "cover", label: "Kapak" },
  { id: "back_cover", label: "Arka kapak" },
];

/** Replaces one page's picture, keeping the areas drawn on it. */
function ReplaceImage({
  issueId,
  pageId,
  csrfToken,
}: {
  issueId: string;
  pageId: string;
  csrfToken: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "bad"; text: string } | null>(null);

  const pick = async (file: File) => {
    setBusy(true);
    setNote(null);
    const form = new FormData();
    form.append("csrfToken", csrfToken);
    form.append("pageId", pageId);
    form.append("file", file);

    try {
      const response = await fetch(`/api/editor/issues/${issueId}/pages`, {
        method: "POST",
        body: form,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body && typeof body === "object" && "error" in body
            ? ((body as { error?: { message?: string } }).error?.message ?? null)
            : null;
        setNote({ tone: "bad", text: message ?? "Görsel değiştirilemedi." });
        return;
      }
      const changed =
        body && typeof body === "object" && (body as { aspectChanged?: boolean }).aspectChanged;
      setNote(
        changed
          ? {
              tone: "warn",
              text: "Yeni görselin oranı farklı. Etkileşim alanlarını yeniden kontrol edin.",
            }
          : { tone: "ok", text: "Görsel değiştirildi. Alanlar korundu." },
      );
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs">
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ImageUp className="size-3.5" aria-hidden />}
        Görseli değiştir
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void pick(file);
          }}
        />
      </label>
      {note && (
        <p
          className={`text-xs ${
            note.tone === "bad" ? "text-danger" : note.tone === "warn" ? "text-warning" : "text-accent"
          }`}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}

/** The fields the list edits about one page. */
function PageMetaForm({
  issueId,
  page,
  csrfToken,
}: {
  issueId: string;
  page: ListedPage;
  csrfToken: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(updatePageMetaAction, null);

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="pageId" value={page.id} />
      <input type="hidden" name="issueId" value={issueId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sayfa etiketi" hint="Yalnızca panelde görünür.">
          <Input name="label" defaultValue={page.label ?? ""} maxLength={120} />
        </Field>
        <Field label="Bu sayfa ne?">
          <Select name="template" defaultValue={page.template}>
            {ROLES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Erişilebilir açıklama"
        hint="Ekran okuyucunun sayfa yerine okuyacağı cümle."
      >
        <Input name="imageAlt" defaultValue={page.imageAlt ?? ""} maxLength={400} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="İçindekiler başlığı" hint="Boş bırakılırsa içindekilerde görünmez.">
          <Input name="tocTitle" defaultValue={page.tocTitle ?? ""} maxLength={200} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="inContents" value="1" defaultChecked={page.inContents} />
          İçindekilerde göster
        </label>
      </div>

      <Field
        label="Metin dökümü (isteğe bağlı)"
        hint="Sayfadaki yazıların düz metni. Sayfanın yüklenmesi buna bağlı değildir."
      >
        <Textarea name="transcript" rows={4} defaultValue={page.transcript ?? ""} maxLength={20000} />
      </Field>

      <SubmitRow state={state} label="Sayfa bilgilerini kaydet" />
    </form>
  );
}

export function IssuePageList({
  issueId,
  csrfToken,
  pages,
}: {
  issueId: string;
  csrfToken: string;
  pages: ListedPage[];
}) {
  const saved = pages.map((page) => page.id);
  const [order, setOrder] = useState<string[]>(saved);
  const [dragging, setDragging] = useState<string | null>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(reorderIssuePagesAction, null);

  // The list can arrive re-ordered from the server after a save or a move;
  // comparing against what was rendered keeps the warning honest
  const savedKey = saved.join(",");
  const orderKey = order.filter((id) => saved.includes(id)).join(",");
  const known = new Set(order);
  const current = saved.every((id) => known.has(id)) && order.length === saved.length ? order : saved;
  const moved = orderKey !== savedKey && current === order;

  const byId = new Map(pages.map((page) => [page.id, page]));

  const dropOn = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const next = [...current];
    const from = next.indexOf(dragging);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) return;
    next.splice(to, 0, ...next.splice(from, 1));
    setOrder(next);
  };

  return (
    <div className="space-y-4">
      {/* Its own form, beside the list rather than around it: a form inside a
          form is not allowed, and every page row carries forms of its own */}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="issueId" value={issueId} />
        <input type="hidden" name="order" value={current.join(",")} />
        {state?.error && <Alert tone="danger">{state.error}</Alert>}
        {state?.success && <Alert tone="success">{state.success}</Alert>}
        {moved && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
            <span>Sıralama değişti; kaydedilmedi.</span>
            <Button type="submit" variant="primary" className="px-3 py-1 text-xs">
              Sıralamayı kaydet
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1 text-xs"
              onClick={() => setOrder(saved)}
            >
              Geri al
            </Button>
          </div>
        )}
      </form>

      <ul className="space-y-3">
        {current.map((id, index) => {
          const page = byId.get(id);
          if (!page) return null;
          return (
            <li
              key={page.id}
              className="rounded-md border border-line bg-surface p-3"
              draggable
              onDragStart={() => setDragging(page.id)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOn(page.id)}
              data-dragging={dragging === page.id ? "" : undefined}
            >
              <div className="flex flex-wrap items-start gap-3">
                <GripVertical className="mt-1 size-4 shrink-0 cursor-grab text-muted" aria-hidden />

                <div className="w-28 shrink-0">
                  {page.imageUrl ? (
                    <img
                      src={page.imageUrl}
                      alt=""
                      className="w-full border border-line object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center border border-dashed border-line text-xs text-muted">
                      Şablon
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-serif text-base">
                    {index + 1}. {page.label ?? ROLES.find((role) => role.id === page.template)?.label ?? "Sayfa"}
                  </p>
                  <p className="text-xs text-muted">
                    {page.imageWidth ? `${page.imageWidth}×${page.imageHeight}` : "Görsel yok"}
                    {page.hotspotCount > 0 ? ` · ${page.hotspotCount} etkileşim alanı` : " · alan yok"}
                    {page.tocTitle ? ` · içindekiler: ${page.tocTitle}` : ""}
                  </p>
                  {page.unfinishedCount > 0 && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-warning">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      {page.unfinishedCount} alanın hedefi eksik; okura gösterilmiyor.
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/editor/issues/${issueId}/sayfalar/${page.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-accent px-2.5 py-1 text-xs text-accent"
                    >
                      <Link2 className="size-3.5" aria-hidden /> Etkileşim alanları
                    </Link>
                    <ReplaceImage issueId={issueId} pageId={page.id} csrfToken={csrfToken} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    action={moveIssuePageAction}
                    csrfToken={csrfToken}
                    label="Yukarı taşı"
                    variant="ghost"
                    display="↑"
                    fields={{ pageId: page.id, issueId, direction: "up" }}
                  />
                  <ActionButton
                    action={moveIssuePageAction}
                    csrfToken={csrfToken}
                    label="Aşağı taşı"
                    variant="ghost"
                    display="↓"
                    fields={{ pageId: page.id, issueId, direction: "down" }}
                  />
                  <ActionButton
                    action={duplicateIssuePageAction}
                    csrfToken={csrfToken}
                    label="Çoğalt"
                    fields={{ pageId: page.id, issueId }}
                  />
                  <ActionButton
                    action={removeIssuePageAction}
                    csrfToken={csrfToken}
                    label="Kaldır"
                    variant="danger"
                    fields={{ pageId: page.id, issueId }}
                    confirmMessage={`${index + 1}. sayfa kaldırılsın mı? Üzerindeki etkileşim alanları da silinir.`}
                  />
                </div>
              </div>

              <details>
                <summary className="mt-2 cursor-pointer text-sm text-muted">Sayfa bilgileri</summary>
                <PageMetaForm issueId={issueId} page={page} csrfToken={csrfToken} />
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
