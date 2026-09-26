"use client";

/**
 * One page's editing form, with a live preview beside it (D-234).
 *
 * The layout decides which fields are offered, so the form never asks for a
 * byline on a full-bleed picture. Whatever was typed is kept even if the
 * layout changes later, so trying one costs nothing.
 *
 * Blocks are edited as a small list and travel in one hidden field; the server
 * validates them again before anything is stored.
 */
import { useState } from "react";
import { BLOCK_KINDS, blockLabel, type PageBlock } from "@/lib/issue-blocks";
import { PAGE_TEMPLATES, templateAsks, templateOf, type PageField } from "@/lib/issue-templates";
import type { ReaderPage } from "@/lib/issue-reader";
import type { ActionState } from "@/lib/action";
import { IssuePageSheet } from "@/components/issue-page-sheet";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm, SubmitRow, useActionForm } from "@/components/form";

export type EditablePage = {
  id: string | null;
  position: number;
  template: string;
  tocTitle: string;
  inContents: boolean;
  heading: string;
  standfirst: string;
  byline: string;
  body: string;
  caption: string;
  section: string;
  imageMediaId: string;
  articleId: string;
  blocks: PageBlock[];
};

type Option = { id: string; label: string };

function emptyBlock(kind: string): PageBlock {
  switch (kind) {
    case "zoom":
      return { kind: "zoom", mediaId: null, caption: "" };
    case "gallery":
      return { kind: "gallery", mediaIds: [], caption: "" };
    case "aside":
      return { kind: "aside", title: "", body: "" };
    case "quote":
      return { kind: "quote", text: "", source: "" };
    case "related":
      return { kind: "related", articleId: null };
    case "media":
      return { kind: "media", url: "", media: "audio", title: "" };
    case "playlist":
      return { kind: "playlist" };
    default:
      return { kind: "quiz", question: "", options: [], answer: null, explanation: "" };
  }
}

export function IssuePageEditor({
  issueId,
  page,
  csrfToken,
  action,
  covers,
  articles,
  sections,
  submitLabel,
  preview,
}: {
  issueId: string;
  page: EditablePage;
  csrfToken: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  covers: Option[];
  articles: Option[];
  sections: string[];
  submitLabel: string;
  /** The reader's shape for the live preview beside the form. */
  preview: ReaderPage;
}) {
  // The uncontrolled fields (contents title, article) survive a refused save
  const form = useActionForm(action);
  const { state } = form;
  const [template, setTemplate] = useState(page.template);
  const [blocks, setBlocks] = useState<PageBlock[]>(page.blocks);
  const [draft, setDraft] = useState(page);
  const [wide, setWide] = useState(true);

  const asks = (field: PageField) => templateAsks(template, field);
  const set = (key: keyof EditablePage, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const patch = (index: number, changes: Record<string, unknown>) =>
    setBlocks((current) =>
      current.map((block, position) => (position === index ? ({ ...block, ...changes } as PageBlock) : block)),
    );

  // What the preview shows: the layout and words as they stand in the form
  const previewPage: ReaderPage = {
    ...preview,
    template,
    templateLabel: templateOf(template).label,
    bleed: templateOf(template).bleed ?? false,
    heading: draft.heading || null,
    standfirst: draft.standfirst || null,
    byline: draft.byline || null,
    // The body is shown as typed; the stored page renders it as markdown
    bodyHtml: draft.body ? `<p>${draft.body.replace(/</g, "&lt;").replace(/\n{2,}/g, "</p><p>")}</p>` : null,
    caption: draft.caption || null,
    section: draft.section || null,
    imageUrl: draft.imageMediaId ? `/api/media/${draft.imageMediaId}` : null,
    blocks,
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <ActionForm form={form} className="space-y-3">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="issueId" value={issueId} />
        {page.id && <input type="hidden" name="pageId" value={page.id} />}
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

        <Field label="Şablon" htmlFor={`template-${page.id ?? "new"}`} hint={templateOf(template).hint}>
          <Select
            id={`template-${page.id ?? "new"}`}
            name="template"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
          >
            {PAGE_TEMPLATES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="İçindekiler başlığı" htmlFor={`toc-${page.id ?? "new"}`} hint="Boş bırakılırsa sayfanın başlığı kullanılır.">
          <Input
            id={`toc-${page.id ?? "new"}`}
            name="tocTitle"
            defaultValue={page.tocTitle}
            maxLength={200}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="inContents" value="1" defaultChecked={page.inContents} className="h-4 w-4" />
          İçindekilerde görünsün
        </label>

        {asks("section") && (
          <Field label="Bölüm" htmlFor={`section-${page.id ?? "new"}`}>
            <Select
              id={`section-${page.id ?? "new"}`}
              name="section"
              value={draft.section}
              onChange={(event) => set("section", event.target.value)}
            >
              <option value="">—</option>
              {sections.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {asks("heading") && (
          <Field label="Başlık" htmlFor={`heading-${page.id ?? "new"}`}>
            <Input
              id={`heading-${page.id ?? "new"}`}
              name="heading"
              value={draft.heading}
              onChange={(event) => set("heading", event.target.value)}
              maxLength={300}
            />
          </Field>
        )}

        {asks("standfirst") && (
          <Field label="Spot" htmlFor={`standfirst-${page.id ?? "new"}`}>
            <Textarea
              id={`standfirst-${page.id ?? "new"}`}
              name="standfirst"
              value={draft.standfirst}
              onChange={(event) => set("standfirst", event.target.value)}
              maxLength={600}
              className="min-h-16 font-sans"
            />
          </Field>
        )}

        {asks("byline") && (
          <Field label="İmza" htmlFor={`byline-${page.id ?? "new"}`}>
            <Input
              id={`byline-${page.id ?? "new"}`}
              name="byline"
              value={draft.byline}
              onChange={(event) => set("byline", event.target.value)}
              maxLength={200}
            />
          </Field>
        )}

        {asks("article") && (
          <Field
            label="Bağlı yazı"
            htmlFor={`article-${page.id ?? "new"}`}
            hint="Yazının metnini ve durumunu değiştirmez; sayfa yalnızca ona bağlanır."
          >
            <Select
              id={`article-${page.id ?? "new"}`}
              name="articleId"
              defaultValue={page.articleId}
            >
              <option value="">—</option>
              {articles.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {asks("body") && (
          <Field label="Metin" htmlFor={`body-${page.id ?? "new"}`} hint="Markdown yazabilirsiniz.">
            <Textarea
              id={`body-${page.id ?? "new"}`}
              name="body"
              value={draft.body}
              onChange={(event) => set("body", event.target.value)}
              maxLength={20000}
              className="min-h-40"
            />
          </Field>
        )}

        {asks("image") && (
          <Field label="Görsel" htmlFor={`image-${page.id ?? "new"}`}>
            <Select
              id={`image-${page.id ?? "new"}`}
              name="imageMediaId"
              value={draft.imageMediaId}
              onChange={(event) => set("imageMediaId", event.target.value)}
            >
              <option value="">—</option>
              {covers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {asks("caption") && (
          <Field label="Görsel açıklaması" htmlFor={`caption-${page.id ?? "new"}`}>
            <Input
              id={`caption-${page.id ?? "new"}`}
              name="caption"
              value={draft.caption}
              onChange={(event) => set("caption", event.target.value)}
              maxLength={400}
            />
          </Field>
        )}

        {/* Blocks */}
        <fieldset className="rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-medium">Etkileşim blokları</legend>

          {blocks.length === 0 ? (
            <p className="text-xs text-muted">Bu sayfada blok yok.</p>
          ) : (
            <ul className="space-y-3">
              {blocks.map((block, index) => (
                <li key={index} className="rounded-md border border-line bg-paper p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{blockLabel(block.kind)}</span>
                    <button
                      type="button"
                      className="text-xs text-danger underline"
                      onClick={() => setBlocks((current) => current.filter((_, at) => at !== index))}
                    >
                      Kaldır
                    </button>
                  </div>

                  {block.kind === "quote" && (
                    <div className="space-y-2">
                      <Textarea
                        aria-label="Alıntı"
                        value={block.text}
                        onChange={(event) => patch(index, { text: event.target.value })}
                        className="min-h-16 font-sans"
                      />
                      <Input
                        aria-label="Kaynak"
                        placeholder="Kaynak"
                        value={block.source}
                        onChange={(event) => patch(index, { source: event.target.value })}
                      />
                    </div>
                  )}

                  {block.kind === "aside" && (
                    <div className="space-y-2">
                      <Input
                        aria-label="Kenar notu başlığı"
                        placeholder="Başlık"
                        value={block.title}
                        onChange={(event) => patch(index, { title: event.target.value })}
                      />
                      <Textarea
                        aria-label="Kenar notu metni"
                        value={block.body}
                        onChange={(event) => patch(index, { body: event.target.value })}
                        className="min-h-20 font-sans"
                      />
                    </div>
                  )}

                  {block.kind === "zoom" && (
                    <div className="space-y-2">
                      <Select
                        aria-label="Görsel"
                        value={block.mediaId ?? ""}
                        onChange={(event) => patch(index, { mediaId: event.target.value || null })}
                      >
                        <option value="">—</option>
                        {covers.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        aria-label="Açıklama"
                        placeholder="Açıklama"
                        value={block.caption}
                        onChange={(event) => patch(index, { caption: event.target.value })}
                      />
                    </div>
                  )}

                  {block.kind === "gallery" && (
                    <div className="space-y-2">
                      <Select
                        aria-label="Galeriye görsel ekle"
                        value=""
                        onChange={(event) => {
                          const id = event.target.value;
                          if (id) patch(index, { mediaIds: [...block.mediaIds, id] });
                        }}
                      >
                        <option value="">Görsel ekle…</option>
                        {covers.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-muted">{block.mediaIds.length} görsel</p>
                      {block.mediaIds.length > 0 && (
                        <button
                          type="button"
                          className="text-xs underline"
                          onClick={() => patch(index, { mediaIds: block.mediaIds.slice(0, -1) })}
                        >
                          Sonuncuyu çıkar
                        </button>
                      )}
                    </div>
                  )}

                  {block.kind === "related" && (
                    <Select
                      aria-label="İlgili yazı"
                      value={block.articleId ?? ""}
                      onChange={(event) => patch(index, { articleId: event.target.value || null })}
                    >
                      <option value="">—</option>
                      {articles.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.label}
                        </option>
                      ))}
                    </Select>
                  )}

                  {block.kind === "media" && (
                    <div className="space-y-2">
                      <Select
                        aria-label="Tür"
                        value={block.media}
                        onChange={(event) => patch(index, { media: event.target.value })}
                      >
                        <option value="audio">Ses</option>
                        <option value="video">Video</option>
                      </Select>
                      <Input
                        aria-label="Adres"
                        placeholder="https://…"
                        value={block.url}
                        onChange={(event) => patch(index, { url: event.target.value })}
                      />
                      <Input
                        aria-label="Başlık"
                        placeholder="Düğme yazısı"
                        value={block.title}
                        onChange={(event) => patch(index, { title: event.target.value })}
                      />
                    </div>
                  )}

                  {block.kind === "quiz" && (
                    <div className="space-y-2">
                      <Input
                        aria-label="Soru"
                        placeholder="Soru"
                        value={block.question}
                        onChange={(event) => patch(index, { question: event.target.value })}
                      />
                      <Textarea
                        aria-label="Şıklar"
                        placeholder="Her satıra bir şık"
                        value={block.options.join("\n")}
                        onChange={(event) =>
                          patch(index, {
                            options: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 6),
                          })
                        }
                        className="min-h-20 font-sans"
                      />
                      <Input
                        aria-label="Doğru şıkkın sırası"
                        type="number"
                        min={1}
                        max={6}
                        placeholder="Doğru şık (1, 2, 3…)"
                        value={block.answer === null ? "" : block.answer + 1}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          patch(index, { answer: Number.isInteger(value) && value > 0 ? value - 1 : null });
                        }}
                      />
                      <Input
                        aria-label="Açıklama"
                        placeholder="Yanıt açıklaması"
                        value={block.explanation}
                        onChange={(event) => patch(index, { explanation: event.target.value })}
                      />
                    </div>
                  )}

                  {block.kind === "playlist" && (
                    <p className="text-xs text-muted">Sayının kendi çalma listesini gösterir; ayrıca alan yok.</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            <Select
              aria-label="Blok ekle"
              value=""
              onChange={(event) => {
                if (event.target.value) setBlocks((current) => [...current, emptyBlock(event.target.value)]);
              }}
            >
              <option value="">Blok ekle…</option>
              {BLOCK_KINDS.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label} — {kind.hint}
                </option>
              ))}
            </Select>
          </div>
        </fieldset>

        <SubmitRow state={state} label={submitLabel} />
      </ActionForm>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-sm font-medium">Önizleme</p>
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs ${wide ? "border-accent text-accent" : "border-line text-muted"}`}
            onClick={() => setWide(true)}
            aria-pressed={wide}
          >
            Masaüstü
          </button>
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs ${wide ? "border-line text-muted" : "border-accent text-accent"}`}
            onClick={() => setWide(false)}
            aria-pressed={!wide}
          >
            Mobil
          </button>
        </div>

        <div className="ps-site overflow-hidden rounded-md border border-line bg-[var(--site-wine)] p-2">
          <div style={{ width: wide ? "100%" : "20rem", margin: "0 auto" }}>
            <IssuePageSheet page={previewPage} preview />
          </div>
        </div>
      </div>
    </div>
  );
}
