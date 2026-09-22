"use client";

/**
 * Drawing the clickable areas on a page (D-236).
 *
 * The picture is the page; this is where a rectangle is put on it and told
 * what to do. Every rectangle is kept in fractions of the picture, measured
 * against the picture element itself, so it lands on the same part of the
 * design at any size and on any screen — the frame around the picture is not
 * part of the picture.
 *
 * The mouse is the quick way, not the only way: the list beside the picture
 * selects, renames and nudges an area to the tenth of a percent, so this page
 * can be used from the keyboard alone.
 *
 * Nothing is written until it is saved, and the page says so out loud rather
 * than letting a stray reload throw the work away.
 */
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Eye,
  MousePointerSquareDashed,
  Pencil,
  Plus,
  Smartphone,
  Monitor,
  Trash2,
  X,
} from "lucide-react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitRow } from "@/components/form";
import type { ActionState } from "@/lib/action";
import {
  HOTSPOT_KINDS,
  HOTSPOT_KIND_LABELS,
  MIN_SIDE,
  asPercent,
  clampRect,
  hotspotProblem,
  overlappingPairs,
  safeExternalUrl,
  type HotspotKind,
  type ReaderHotspot,
} from "@/lib/issue-hotspots";
import type { ReaderQuiz } from "@/lib/issue-quiz";
import type { ReaderPage } from "@/lib/issue-reader";
import { IssuePageImage } from "@/components/issue-page-image";
import { IssueQuizPlayer } from "@/components/issue-quiz-player";
import { saveHotspotsAction } from "../actions";

type Draft = {
  key: string;
  id?: string;
  kind: HotspotKind;
  name: string;
  ariaLabel: string;
  showMarker: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  openInNewTab: boolean;
  targetPageId: string;
  infoTitle: string;
  infoBody: string;
  quizId: string;
};

export type Sibling = { id: string; position: number; label: string; imageUrl: string | null };

let counter = 0;
const nextKey = () => `area-${(counter += 1)}`;

function toDraft(area: ReaderHotspot): Draft {
  return {
    key: nextKey(),
    id: area.id,
    kind: area.kind,
    name: area.name ?? "",
    ariaLabel: area.ariaLabel ?? "",
    showMarker: area.showMarker,
    x: area.x,
    y: area.y,
    w: area.w,
    h: area.h,
    url: area.url ?? "",
    openInNewTab: area.openInNewTab,
    targetPageId: area.targetPageId ?? "",
    infoTitle: area.infoTitle ?? "",
    infoBody: area.infoBody ?? "",
    quizId: area.quizId ?? "",
  };
}

/** What the service is sent: empty strings mean "nothing", not an empty value. */
function toInput(draft: Draft) {
  const blank = (value: string) => (value.trim() === "" ? null : value.trim());
  return {
    ...(draft.id ? { id: draft.id } : {}),
    kind: draft.kind,
    name: blank(draft.name),
    ariaLabel: blank(draft.ariaLabel),
    showMarker: draft.showMarker,
    x: draft.x,
    y: draft.y,
    w: draft.w,
    h: draft.h,
    url: draft.kind === "link" ? blank(draft.url) : null,
    openInNewTab: draft.openInNewTab,
    targetPageId: draft.kind === "page" ? blank(draft.targetPageId) : null,
    infoTitle: draft.kind === "info" ? blank(draft.infoTitle) : null,
    infoBody: draft.kind === "info" ? blank(draft.infoBody) : null,
    quizId: draft.kind === "quiz" ? blank(draft.quizId) : null,
  };
}

/** The reader's shape of a draft, so the preview runs the real component. */
function toReader(draft: Draft): ReaderHotspot {
  return {
    id: draft.key,
    kind: draft.kind,
    name: draft.name || null,
    ariaLabel: draft.ariaLabel || null,
    showMarker: draft.showMarker,
    x: draft.x,
    y: draft.y,
    w: draft.w,
    h: draft.h,
    url: draft.kind === "link" ? safeExternalUrl(draft.url) : null,
    openInNewTab: draft.openInNewTab,
    targetPageId: draft.kind === "page" ? draft.targetPageId || null : null,
    infoTitle: draft.infoTitle || null,
    infoBody: draft.infoBody || null,
    infoImageUrl: null,
    quizId: draft.kind === "quiz" ? draft.quizId || null : null,
  };
}

type Gesture =
  | { mode: "draw"; startX: number; startY: number }
  | { mode: "move"; key: string; grabX: number; grabY: number }
  | { mode: "resize"; key: string; corner: string; anchorX: number; anchorY: number };

export function HotspotEditor({
  issueId,
  page,
  siblings,
  quizzes,
  csrfToken,
}: {
  issueId: string;
  page: ReaderPage;
  siblings: Sibling[];
  quizzes: ReaderQuiz[];
  csrfToken: string;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => page.hotspots.map(toDraft));
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [previewInfo, setPreviewInfo] = useState<ReaderHotspot | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<string | null>(null);
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const gestureRef = useRef<Gesture | null>(null);

  /**
   * Whether there is anything unsaved, worked out rather than tracked: the
   * areas as they stand, against the last set the server actually accepted.
   *
   * The action state carries that set along with the outcome, so a refused
   * save leaves the work marked unsaved — which is what it is — and a
   * successful one makes exactly what was sent the new baseline.
   */
  const [saved, formAction] = useActionState<{ state: ActionState; payload: string | null }, FormData>(
    async (previous, formData) => {
      const state = await saveHotspotsAction(previous.state, formData);
      const sent = formData.get("areas");
      return {
        state,
        payload: state?.success && typeof sent === "string" ? sent : previous.payload,
      };
    },
    { state: null, payload: null },
  );
  const state = saved.state;

  const payload = useMemo(() => JSON.stringify(drafts.map(toInput)), [drafts]);
  const arrivedWith = useMemo(
    () => JSON.stringify(page.hotspots.map(toDraft).map(toInput)),
    [page.hotspots],
  );
  const dirty = payload !== (saved.payload ?? arrivedWith);

  // The browser's own warning is the only one that can stop a navigation the
  // page did not start — a tab being closed, or an address typed over it
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = useCallback((key: string, patch: Partial<Draft>) => {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)),
    );
  }, []);

  /** Where a pointer is, in fractions of the picture itself. */
  const pointAt = useCallback((event: { clientX: number; clientY: number }) => {
    const box = imageRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return {
      x: Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1),
      y: Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1),
    };
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    if (preview) return;
    const point = pointAt(event);
    if (!point) return;
    const target = event.target as HTMLElement;
    const handle = target.dataset.handle;
    const areaKey = target.dataset.area;

    if (handle && areaKey) {
      const draft = drafts.find((entry) => entry.key === areaKey);
      if (!draft) return;
      // The opposite corner stays where it is while this one is dragged
      gestureRef.current = {
        mode: "resize",
        key: areaKey,
        corner: handle,
        anchorX: handle.includes("w") ? draft.x + draft.w : draft.x,
        anchorY: handle.includes("n") ? draft.y + draft.h : draft.y,
      };
      setSelected(areaKey);
    } else if (areaKey) {
      const draft = drafts.find((entry) => entry.key === areaKey);
      if (!draft) return;
      gestureRef.current = { mode: "move", key: areaKey, grabX: point.x - draft.x, grabY: point.y - draft.y };
      setSelected(areaKey);
    } else {
      gestureRef.current = { mode: "draw", startX: point.x, startY: point.y };
      setSelected(null);
      setDrawn({ x: point.x, y: point.y, w: 0, h: 0 });
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const point = pointAt(event);
    if (!point) return;

    if (gesture.mode === "draw") {
      setDrawn({
        x: Math.min(gesture.startX, point.x),
        y: Math.min(gesture.startY, point.y),
        w: Math.abs(point.x - gesture.startX),
        h: Math.abs(point.y - gesture.startY),
      });
      return;
    }
    if (gesture.mode === "move") {
      const draft = drafts.find((entry) => entry.key === gesture.key);
      if (!draft) return;
      change(gesture.key, clampRect({ x: point.x - gesture.grabX, y: point.y - gesture.grabY, w: draft.w, h: draft.h }));
      return;
    }
    change(
      gesture.key,
      clampRect({
        x: Math.min(gesture.anchorX, point.x),
        y: Math.min(gesture.anchorY, point.y),
        w: Math.abs(point.x - gesture.anchorX),
        h: Math.abs(point.y - gesture.anchorY),
      }),
    );
  };

  const onPointerUp = () => {
    const gesture = gestureRef.current;
    gestureRef.current = null;

    if (gesture?.mode === "draw" && drawn) {
      // A click rather than a drag makes a small area at that point, so a
      // single press is never lost
      const rect = clampRect({
        x: drawn.x,
        y: drawn.y,
        w: Math.max(drawn.w, MIN_SIDE * 4),
        h: Math.max(drawn.h, MIN_SIDE * 4),
      });
      const draft: Draft = {
        key: nextKey(),
        kind: "link",
        name: `Alan ${drafts.length + 1}`,
        ariaLabel: "",
        showMarker: false,
        ...rect,
        url: "",
        openInNewTab: true,
        targetPageId: "",
        infoTitle: "",
        infoBody: "",
        quizId: "",
      };
      setDrafts((current) => [...current, draft]);
      setSelected(draft.key);
    }
    setDrawn(null);
  };

  const remove = (key: string) => {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
    if (selected === key) setSelected(null);
  };

  const duplicate = (key: string) => {
    const source = drafts.find((draft) => draft.key === key);
    if (!source) return;
    const copy: Draft = {
      ...source,
      key: nextKey(),
      // A copy is a new area, not the same one twice
      id: undefined,
      name: `${source.name || "Alan"} (kopya)`,
      ...clampRect({ x: source.x + 0.02, y: source.y + 0.02, w: source.w, h: source.h }),
    };
    setDrafts((current) => [...current, copy]);
    setSelected(copy.key);
  };

  const overlaps = useMemo(() => overlappingPairs(drafts), [drafts]);
  const overlapping = useMemo(() => {
    const keys = new Set<string>();
    for (const [a, b] of overlaps) {
      if (drafts[a]) keys.add(drafts[a]!.key);
      if (drafts[b]) keys.add(drafts[b]!.key);
    }
    return keys;
  }, [drafts, overlaps]);

  const active = drafts.find((draft) => draft.key === selected) ?? null;
  const previewPage: ReaderPage = {
    ...page,
    hotspots: drafts
      .map(toReader)
      .filter((area) => hotspotProblem({ ...area, url: area.url }) === null),
  };
  const openQuiz = quizzes.find((quiz) => quiz.id === previewQuiz) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={preview ? "secondary" : "primary"}
          className="px-3 py-1.5 text-xs"
          onClick={() => setPreview(false)}
        >
          <Pencil className="mr-1.5 inline size-3.5" aria-hidden /> Düzenle
        </Button>
        <Button
          type="button"
          variant={preview ? "primary" : "secondary"}
          className="px-3 py-1.5 text-xs"
          onClick={() => setPreview(true)}
        >
          <Eye className="mr-1.5 inline size-3.5" aria-hidden /> Okur önizlemesi
        </Button>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <Button
          type="button"
          variant={narrow ? "secondary" : "primary"}
          className="px-3 py-1.5 text-xs"
          onClick={() => setNarrow(false)}
        >
          <Monitor className="mr-1.5 inline size-3.5" aria-hidden /> Masaüstü
        </Button>
        <Button
          type="button"
          variant={narrow ? "primary" : "secondary"}
          className="px-3 py-1.5 text-xs"
          onClick={() => setNarrow(true)}
        >
          <Smartphone className="mr-1.5 inline size-3.5" aria-hidden /> Mobil
        </Button>
      </div>

      {dirty && (
        <Alert tone="warning">
          Kaydedilmemiş değişiklikler var. Sayfadan ayrılmadan önce kaydedin.
        </Alert>
      )}
      {overlaps.length > 0 && (
        <Alert tone="warning" title="Çakışan alanlar">
          {overlaps.length} alan çifti üst üste biniyor. Okur, listede sonra gelen alana basmış
          olur.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ---------------------------------------------------------- */}
        {/* The picture                                                 */}
        {/* ---------------------------------------------------------- */}
        <div>
          <div
            className="mx-auto bg-paper p-2"
            style={narrow ? { maxWidth: "24rem" } : undefined}
          >
            {preview ? (
              <div className="ps-site">
                <IssuePageImage
                  page={previewPage}
                  showAllAreas
                  onHotspot={(area) => {
                    if (area.kind === "info") return setPreviewInfo(area);
                    if (area.kind === "quiz" && area.quizId) return setPreviewQuiz(area.quizId);
                    if (area.kind === "page") {
                      const target = siblings.find((entry) => entry.id === area.targetPageId);
                      setPreviewNote(
                        target
                          ? `Okur ${target.position}. sayfaya giderdi: ${target.label}`
                          : "Hedef sayfa seçilmemiş.",
                      );
                    }
                  }}
                />
              </div>
            ) : (
              <div
                className="relative touch-none select-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {page.imageUrl ? (
                  <img
                    ref={imageRef}
                    src={page.imageUrl}
                    alt={page.imageAlt ?? ""}
                    className="block w-full"
                    draggable={false}
                  />
                ) : (
                  <div
                    ref={imageRef as unknown as React.RefObject<HTMLImageElement>}
                    className="flex aspect-[3/4] w-full items-center justify-center border border-dashed border-line text-sm text-muted"
                  >
                    Bu sayfanın görseli yok.
                  </div>
                )}

                {drafts.map((draft) => (
                  <div
                    key={draft.key}
                    data-area={draft.key}
                    className="absolute cursor-move border-2"
                    style={{
                      left: `${draft.x * 100}%`,
                      top: `${draft.y * 100}%`,
                      width: `${draft.w * 100}%`,
                      height: `${draft.h * 100}%`,
                      borderColor:
                        selected === draft.key
                          ? "var(--color-accent, #7b1f2b)"
                          : overlapping.has(draft.key)
                            ? "#b45309"
                            : "rgba(23,23,23,0.55)",
                      background:
                        selected === draft.key ? "rgba(123,31,43,0.14)" : "rgba(23,23,23,0.06)",
                    }}
                  >
                    <span
                      data-area={draft.key}
                      className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap bg-ink/80 px-1 text-[10px] text-white"
                    >
                      {draft.name || HOTSPOT_KIND_LABELS[draft.kind]}
                    </span>
                    {["nw", "ne", "sw", "se"].map((corner) => (
                      <span
                        key={corner}
                        data-area={draft.key}
                        data-handle={corner}
                        className="absolute size-3 border border-white bg-ink"
                        style={{
                          left: corner.includes("w") ? -6 : undefined,
                          right: corner.includes("e") ? -6 : undefined,
                          top: corner.includes("n") ? -6 : undefined,
                          bottom: corner.includes("s") ? -6 : undefined,
                          cursor: `${corner}-resize`,
                        }}
                      />
                    ))}
                  </div>
                ))}

                {drawn && (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-accent bg-accent/10"
                    style={{
                      left: `${drawn.x * 100}%`,
                      top: `${drawn.y * 100}%`,
                      width: `${drawn.w * 100}%`,
                      height: `${drawn.h * 100}%`,
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {!preview && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <MousePointerSquareDashed className="size-3.5" aria-hidden />
              Görselin üzerine sürükleyerek alan çizin; köşelerden boyutlandırın, içinden tutup
              taşıyın.
            </p>
          )}
          {previewNote && (
            <p className="mt-2 rounded-md border border-line p-2 text-xs">{previewNote}</p>
          )}
        </div>

        {/* ---------------------------------------------------------- */}
        {/* The list and the fields                                     */}
        {/* ---------------------------------------------------------- */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg">Etkileşimler ({drafts.length})</h2>
            <Button
              type="button"
              variant="secondary"
              className="px-2.5 py-1 text-xs"
              onClick={() => {
                const draft: Draft = {
                  key: nextKey(),
                  kind: "link",
                  name: `Alan ${drafts.length + 1}`,
                  ariaLabel: "",
                  showMarker: false,
                  x: 0.35,
                  y: 0.4,
                  w: 0.3,
                  h: 0.12,
                  url: "",
                  openInNewTab: true,
                  targetPageId: "",
                  infoTitle: "",
                  infoBody: "",
                  quizId: "",
                };
                setDrafts((current) => [...current, draft]);
                setSelected(draft.key);
              }}
            >
              <Plus className="mr-1 inline size-3.5" aria-hidden /> Alan ekle
            </Button>
          </div>

          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {drafts.length === 0 && <li className="text-sm text-muted">Henüz alan yok.</li>}
            {drafts.map((draft) => {
              const problem = hotspotProblem({
                kind: draft.kind,
                url: draft.url,
                targetPageId: draft.targetPageId,
                infoTitle: draft.infoTitle,
                infoBody: draft.infoBody,
                quizId: draft.quizId,
              });
              return (
                <li key={draft.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(draft.key)}
                    className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-xs ${
                      selected === draft.key ? "border-accent bg-accent/5" : "border-line"
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {draft.name || "Adsız alan"}
                      <span className="ml-1.5 text-muted">{HOTSPOT_KIND_LABELS[draft.kind]}</span>
                    </span>
                    {problem && <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>

          {active ? (
            <div className="space-y-3 rounded-md border border-line p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Seçili alan</h3>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => duplicate(active.key)}
                    aria-label="Alanı çoğalt"
                  >
                    <Copy className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="px-2 py-1 text-xs"
                    onClick={() => remove(active.key)}
                    aria-label="Alanı sil"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>

              <Field label="Alan adı">
                <Input
                  value={active.name}
                  onChange={(event) => change(active.key, { name: event.target.value })}
                  maxLength={120}
                />
              </Field>

              <Field label="Erişilebilir etiket" hint="Ekran okuyucunun söyleyeceği söz.">
                <Input
                  value={active.ariaLabel}
                  onChange={(event) => change(active.key, { ariaLabel: event.target.value })}
                  maxLength={200}
                />
              </Field>

              <Field label="Etkileşim türü">
                <Select
                  value={active.kind}
                  onChange={(event) => change(active.key, { kind: event.target.value as HotspotKind })}
                >
                  {HOTSPOT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {HOTSPOT_KIND_LABELS[kind]}
                    </option>
                  ))}
                </Select>
              </Field>

              {active.kind === "link" && (
                <>
                  <Field label="Adres" hint="http veya https ile başlamalı.">
                    <Input
                      value={active.url}
                      onChange={(event) => change(active.key, { url: event.target.value })}
                      placeholder="https://open.spotify.com/…"
                      maxLength={2000}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={active.openInNewTab}
                      onChange={(event) => change(active.key, { openInNewTab: event.target.checked })}
                    />
                    Yeni sekmede aç
                  </label>
                </>
              )}

              {active.kind === "page" && (
                <Field label="Gidilecek sayfa" hint="Sıralama değişse de doğru sayfaya gider.">
                  <Select
                    value={active.targetPageId}
                    onChange={(event) => change(active.key, { targetPageId: event.target.value })}
                  >
                    <option value="">— seçin —</option>
                    {siblings
                      .filter((entry) => entry.id !== page.id)
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.position}. {entry.label}
                        </option>
                      ))}
                  </Select>
                </Field>
              )}

              {active.kind === "info" && (
                <>
                  <Field label="Kutu başlığı">
                    <Input
                      value={active.infoTitle}
                      onChange={(event) => change(active.key, { infoTitle: event.target.value })}
                      maxLength={200}
                    />
                  </Field>
                  <Field label="Açıklama">
                    <Textarea
                      rows={4}
                      value={active.infoBody}
                      onChange={(event) => change(active.key, { infoBody: event.target.value })}
                      maxLength={4000}
                    />
                  </Field>
                </>
              )}

              {active.kind === "quiz" && (
                <Field label="Test" hint="Aynı test birden çok alandan bağlanabilir.">
                  <Select
                    value={active.quizId}
                    onChange={(event) => change(active.key, { quizId: event.target.value })}
                  >
                    <option value="">— seçin —</option>
                    {quizzes.map((quiz) => (
                      <option key={quiz.id} value={quiz.id}>
                        {quiz.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={active.showMarker}
                  onChange={(event) => change(active.key, { showMarker: event.target.checked })}
                />
                Okurda ince bir işaret göster
              </label>

              <div className="grid grid-cols-4 gap-2">
                {(["x", "y", "w", "h"] as const).map((axis) => (
                  <label key={axis} className="text-xs">
                    <span className="mb-1 block uppercase text-muted">{axis} %</span>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={asPercent(active[axis])}
                      onChange={(event) => {
                        const value = Number(event.target.value) / 100;
                        if (Number.isNaN(value)) return;
                        change(
                          active.key,
                          clampRect({ x: active.x, y: active.y, w: active.w, h: active.h, [axis]: value }),
                        );
                      }}
                    />
                  </label>
                ))}
              </div>

              {hotspotProblem({
                kind: active.kind,
                url: active.url,
                targetPageId: active.targetPageId,
                infoTitle: active.infoTitle,
                infoBody: active.infoBody,
                quizId: active.quizId,
              }) && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  {hotspotProblem({
                    kind: active.kind,
                    url: active.url,
                    targetPageId: active.targetPageId,
                    infoTitle: active.infoTitle,
                    infoBody: active.infoBody,
                    quizId: active.quizId,
                  })}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-line p-3 text-sm text-muted">
              Bir alan seçin ya da görselin üzerine yeni bir alan çizin.
            </p>
          )}

          <form action={formAction} className="space-y-3">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="issueId" value={issueId} />
            <input type="hidden" name="areas" value={payload} />
            <SubmitRow state={state} label="Etkileşimleri kaydet" />
          </form>
        </div>
      </div>

      {previewInfo && (
        <div className="reader-overlay" role="dialog" aria-modal="true">
          <div className="reader-panel">
            <header className="reader-panel-head">
              <h2>{previewInfo.infoTitle ?? "Bilgi"}</h2>
              <button
                type="button"
                className="reader-icon"
                onClick={() => setPreviewInfo(null)}
                aria-label="Kapat"
              >
                <X aria-hidden />
              </button>
            </header>
            {previewInfo.infoBody && <p className="reader-panel-body">{previewInfo.infoBody}</p>}
          </div>
        </div>
      )}

      {openQuiz && <IssueQuizPlayer quiz={openQuiz} onClose={() => setPreviewQuiz(null)} />}
    </div>
  );
}
