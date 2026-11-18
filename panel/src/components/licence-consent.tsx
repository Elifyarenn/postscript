"use client";

/**
 * The licence box above a submit button (D-387). Ticking it opens the work's
 * licence form; "Okudum, onaylıyorum" stays shut until the form has been
 * scrolled to its end, and the submit button stays shut until it is pressed.
 *
 * What it writes into the form is only the form number and the hash of the
 * text shown. The server draws the form again from what is actually sent and
 * refuses the submit if the two differ, so this box is a convenience for the
 * reader, never the check itself.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { previewArticleLicenceAction } from "@/app/writer/actions";
import { previewDrawingLicenceAction } from "@/app/cizer/actions";
import type { LicencePreviewResult } from "@/lib/licence-preview";
import { Button } from "./ui";
import { useSubmitGate } from "./form";

type Loaded = Extract<LicencePreviewResult, { ok: true }>;

/** Closer than this to the bottom counts as read; a fraction of a line. */
const END_SLACK_PX = 8;

function LicenceConsent({
  load,
  watch,
  label,
}: {
  load: (form: HTMLFormElement) => Promise<LicencePreviewResult>;
  /** Fields whose change makes the accepted form stale. */
  watch: readonly string[];
  label: string;
}) {
  const gate = useSubmitGate();
  const setGateOpen = gate?.setOpen;
  const checkboxRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [acceptance, setAcceptance] = useState<{ form: Loaded; at: unknown } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [stale, setStale] = useState(false);

  // Every submit spends or refuses the form number, so an acceptance holds only
  // until the form's next result and the next submit starts over
  const result = gate?.result ?? null;
  const accepted = acceptance && acceptance.at === result ? acceptance.form : null;
  const setAccepted = useCallback((form: Loaded | null) => setAcceptance(form ? { form, at: result } : null), [result]);

  const acceptedRef = useRef<Loaded | null>(null);
  useEffect(() => {
    acceptedRef.current = accepted;
    setGateOpen?.(accepted !== null);
  }, [accepted, setGateOpen]);

  // An edit to the work after accepting means the accepted text is not the one sent
  useEffect(() => {
    const form = checkboxRef.current?.form;
    if (!form) return;
    const onEdit = (event: Event) => {
      const name = (event.target as HTMLInputElement | null)?.name;
      if (!name || !watch.includes(name)) return;
      if (acceptedRef.current) setStale(true);
      setAcceptance(null);
    };
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
    return () => {
      form.removeEventListener("input", onEdit);
      form.removeEventListener("change", onEdit);
    };
  }, [watch]);

  const checkEnd = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return;
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - END_SLACK_PX) setReachedEnd(true);
  }, []);

  // A form short enough to fit is read as soon as it is shown
  useEffect(() => {
    if (loaded) requestAnimationFrame(checkEnd);
  }, [loaded, checkEnd]);

  async function open() {
    const form = checkboxRef.current?.form;
    if (!form) return;
    setLoaded(null);
    setError(null);
    setReachedEnd(false);
    setLoading(true);
    dialogRef.current?.showModal();
    try {
      const preview = await load(form);
      if (preview.ok) setLoaded(preview);
      else setError(preview.error);
    } catch {
      setError("Ruhsat formu açılamadı. Bağlantınızı kontrol edip yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    dialogRef.current?.close();
  }

  function accept() {
    if (!loaded || !reachedEnd) return;
    setAccepted(loaded);
    setStale(false);
    close();
  }

  return (
    <div className="space-y-2 rounded-md border border-line p-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          ref={checkboxRef}
          type="checkbox"
          className="mt-1"
          checked={accepted !== null}
          onChange={(event) => {
            if (event.currentTarget.checked) void open();
            else setAccepted(null);
          }}
        />
        <span>
          {label}{" "}
          <button type="button" className="text-accent underline" onClick={() => void open()}>
            Formu aç
          </button>
        </span>
      </label>

      {accepted && (
        <p className="text-sm text-muted">
          Form no {accepted.formId.slice(0, 8)} okundu ve onaylandı. Gönderdiğinizde onay kaydedilir; PDF kopyası
          e-postanıza gelir.
        </p>
      )}
      {stale && !accepted && (
        <p role="alert" className="text-sm text-danger">
          Eser onaydan sonra değişti. Göndermek için ruhsat formunu yeniden açıp onaylayın.
        </p>
      )}

      {accepted && (
        <>
          <input type="hidden" name="licenceFormId" value={accepted.formId} />
          <input type="hidden" name="licenceTextHash" value={accepted.textHash} />
          {accepted.illustrationId && <input type="hidden" name="illustrationId" value={accepted.illustrationId} />}
        </>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
      >
        <div className="flex max-h-[85vh] flex-col">
          <header className="border-b border-line px-4 py-3">
            <h2 id={titleId} className="font-serif text-lg">
              Eser Bazlı Kullanım Ruhsatı Formu
            </h2>
            <p className="text-sm text-muted">
              Onaylamak için formu sonuna kadar okuyun; düğme son satıra gelince açılır.
            </p>
          </header>

          <div ref={scrollRef} onScroll={checkEnd} className="flex-1 overflow-y-auto px-4 py-3" tabIndex={0}>
            {loading && <p className="text-sm text-muted">Form hazırlanıyor…</p>}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            {loaded && (
              // Sanitised on the server by renderMarkdown (rehype-sanitize)
              <div className="prose-panel text-sm" dangerouslySetInnerHTML={{ __html: loaded.html }} />
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-4 py-3">
            {loaded && !reachedEnd && <span className="mr-auto text-sm text-muted">Son sayfaya kadar kaydırın.</span>}
            <Button type="button" variant="secondary" onClick={close}>
              Vazgeç
            </Button>
            <Button type="button" onClick={accept} disabled={!loaded || !reachedEnd}>
              Okudum, onaylıyorum
            </Button>
          </footer>
        </div>
      </dialog>
    </div>
  );
}

const ARTICLE_FIELDS = ["title", "bodyMarkdown"] as const;

/** On the writer's edit form: the form for the title and text on screen. */
export function ArticleLicenceConsent({ csrfToken, articleId }: { csrfToken: string; articleId: string }) {
  const load = useCallback(
    (form: HTMLFormElement) => {
      const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";
      return previewArticleLicenceAction({ csrfToken, articleId, title: value("title"), bodyMarkdown: value("bodyMarkdown") });
    },
    [csrfToken, articleId],
  );
  return (
    <LicenceConsent
      load={load}
      watch={ARTICLE_FIELDS}
      label="Bu yazı için Eser Bazlı Kullanım Ruhsatı Formu'nu okudum ve onaylıyorum."
    />
  );
}

const DRAWING_FIELDS = ["file"] as const;

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** On the çizer's upload form: the form names the chosen file by its own hash. */
export function DrawingLicenceConsent({ csrfToken }: { csrfToken: string }) {
  const load = useCallback(
    async (form: HTMLFormElement): Promise<LicencePreviewResult> => {
      const input = form.elements.namedItem("file") as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) return { ok: false, error: "Önce çizim dosyasını seçin; form o dosya için hazırlanır." };
      const sha256 = hex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
      return previewDrawingLicenceAction({ csrfToken, sha256, mime: file.type, size: file.size });
    },
    [csrfToken],
  );
  return (
    <LicenceConsent
      load={load}
      watch={DRAWING_FIELDS}
      label="Bu çizim için Eser Bazlı Kullanım Ruhsatı Formu'nu (çizim) okudum ve onaylıyorum."
    />
  );
}
