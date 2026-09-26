"use client";

/**
 * Taking delivered pages into an issue (D-240).
 *
 * Several files at once, each with its own progress, its own success and its
 * own failure: a batch where one file is refused must not look like a batch
 * that worked. Nothing is reported as added until the server has said so.
 *
 * A picture that is clearly a double page — much wider than it is tall — is
 * offered a cut down the middle, with the line adjustable and shown. It is
 * never cut on its own: the halves are made here in the browser, from the
 * original, and uploaded as two pages.
 */
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, AlertTriangle, Upload, X } from "lucide-react";
import { MAX_PAGE_IMAGE_BYTES, MAX_PAGE_IMAGE_MB, PAGE_IMAGE_TOO_LARGE } from "@/lib/page-image";

type Picked = {
  key: string;
  file: File;
  width: number;
  height: number;
  /** A data URL for the preview; released when the list is cleared. */
  preview: string;
  split: boolean;
  /** Where the cut goes, as a fraction of the width. */
  cut: number;
  state: "waiting" | "sending" | "done" | "failed";
  progress: number;
  error: string | null;
};

/** Landscape enough that it is a spread rather than a page. */
const SPREAD_RATIO = 1.25;

function readSize(file: File): Promise<{ width: number; height: number; preview: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, preview: url });
    // A file the browser cannot decode is still offered: the server has the
    // last word on what is a usable page, and it says so in plain words
    image.onerror = () => resolve({ width: 0, height: 0, preview: url });
    image.src = url;
  });
}

/** One half of a double page, cut from the original in the browser. */
function cutHalf(picked: Picked, side: "left" | "right"): Promise<Blob | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const at = Math.round(image.naturalWidth * picked.cut);
      const width = side === "left" ? at : image.naturalWidth - at;
      if (width <= 0) return resolve(null);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return resolve(null);
      context.drawImage(
        image,
        side === "left" ? 0 : at,
        0,
        width,
        image.naturalHeight,
        0,
        0,
        width,
        image.naturalHeight,
      );
      // PNG: the halves are cut from a finished design, and a second lossy
      // pass over small type is exactly what must not happen to it
      canvas.toBlob((blob) => resolve(blob), "image/png");
    };
    image.onerror = () => resolve(null);
    image.src = picked.preview;
  });
}

function send(
  url: string,
  form: FormData,
  onProgress: (fraction: number) => void,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) return resolve({ ok: true });
      let message = `Yükleme başarısız (${request.status}).`;
      try {
        const body: unknown = JSON.parse(request.responseText);
        if (body && typeof body === "object" && "error" in body) {
          message = (body as { error?: { message?: string } }).error?.message ?? message;
        }
      } catch {
        /* the body was not our error envelope; the status line is enough */
      }
      resolve({ ok: false, message });
    };
    request.onerror = () => resolve({ ok: false, message: "Bağlantı kesildi." });
    request.send(form);
  });
}

export function PageUploader({
  issueId,
  csrfToken,
}: {
  issueId: string;
  csrfToken: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const take = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const measured = await Promise.all(
      list.map(async (file, index) => {
        const size = await readSize(file);
        return {
          key: `${Date.now()}-${index}-${file.name}`,
          file,
          width: size.width,
          height: size.height,
          preview: size.preview,
          split: size.width > 0 && size.width / size.height >= SPREAD_RATIO,
          cut: 0.5,
          state: "waiting" as const,
          progress: 0,
          error: null,
        };
      }),
    );
    setPicked((current) => [...current, ...measured]);
  }, []);

  const patch = (key: string, change: Partial<Picked>) => {
    setPicked((current) => current.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)));
  };

  const clear = () => {
    for (const entry of picked) URL.revokeObjectURL(entry.preview);
    setPicked([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = async () => {
    setBusy(true);
    const url = `/api/editor/issues/${issueId}/pages`;

    // One at a time: the server writes a position per page, and a queue is
    // also the only way the order on screen matches the order in the issue
    for (const entry of picked) {
      if (entry.state === "done") continue;
      patch(entry.key, { state: "sending", progress: 0, error: null });

      const parts: { blob: Blob; name: string }[] = [];
      if (entry.split) {
        const base = entry.file.name.replace(/\.[^.]+$/, "");
        const left = await cutHalf(entry, "left");
        const right = await cutHalf(entry, "right");
        if (!left || !right) {
          patch(entry.key, { state: "failed", error: "Çift sayfa bölünemedi." });
          continue;
        }
        parts.push({ blob: left, name: `${base}-sol.png` }, { blob: right, name: `${base}-sag.png` });
      } else {
        parts.push({ blob: entry.file, name: entry.file.name });
      }

      let failed: string | null = null;
      for (const [at, part] of parts.entries()) {
        // Vercel would refuse it with a bare 413 before the server could explain
        if (part.blob.size > MAX_PAGE_IMAGE_BYTES) {
          failed = PAGE_IMAGE_TOO_LARGE;
          break;
        }
        const form = new FormData();
        form.append("csrfToken", csrfToken);
        form.append("file", part.blob, part.name);
        const result = await send(url, form, (fraction) => {
          patch(entry.key, { progress: (at + fraction) / parts.length });
        });
        if (!result.ok) {
          failed = result.message;
          break;
        }
      }

      patch(entry.key, failed ? { state: "failed", error: failed } : { state: "done", progress: 1 });
    }

    setBusy(false);
    router.refresh();
  };

  const waiting = picked.filter((entry) => entry.state !== "done").length;

  return (
    <div className="space-y-3">
      <div
        className={`rounded-md border-2 border-dashed p-5 text-center text-sm ${
          over ? "border-accent bg-accent/5" : "border-line"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void take(event.dataTransfer.files);
        }}
      >
        <p className="mb-2 text-muted">
          Sayfa görsellerini buraya sürükleyin — PNG, JPG veya WEBP, en çok {MAX_PAGE_IMAGE_MB} MB.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="mx-auto block text-sm"
          onChange={(event) => {
            if (event.target.files) void take(event.target.files);
          }}
        />
      </div>

      {picked.length > 0 && (
        <ul className="space-y-3">
          {picked.map((entry) => (
            <li key={entry.key} className="flex gap-3 rounded-md border border-line p-3">
              <div className="relative shrink-0">
                {/* The preview is a local object URL, never a server address */}
                <img
                  src={entry.preview}
                  alt=""
                  className="h-24 w-auto max-w-[12rem] border border-line object-contain"
                />
                {entry.split && (
                  <span
                    className="absolute inset-y-0 w-px bg-danger"
                    style={{ left: `${entry.cut * 100}%` }}
                    aria-hidden
                  />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="truncate font-medium">{entry.file.name}</p>
                <p className="text-xs text-muted">
                  {entry.width > 0 ? `${entry.width}×${entry.height} · ` : ""}
                  {(entry.file.size / (1024 * 1024)).toFixed(1)} MB
                </p>

                {entry.width / entry.height >= SPREAD_RATIO && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={entry.split}
                        disabled={busy}
                        onChange={(event) => patch(entry.key, { split: event.target.checked })}
                      />
                      Çift sayfa — ortadan böl
                    </label>
                    {entry.split && (
                      <label className="flex items-center gap-1.5">
                        Kesim
                        <input
                          type="range"
                          min={30}
                          max={70}
                          value={Math.round(entry.cut * 100)}
                          disabled={busy}
                          onChange={(event) => patch(entry.key, { cut: Number(event.target.value) / 100 })}
                        />
                        <span className="tabular-nums">%{Math.round(entry.cut * 100)}</span>
                      </label>
                    )}
                  </div>
                )}

                {entry.state === "sending" && (
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    Yükleniyor… %{Math.round(entry.progress * 100)}
                  </p>
                )}
                {entry.state === "done" && (
                  <p className="flex items-center gap-1.5 text-xs text-accent">
                    <Check className="size-3.5" aria-hidden /> Eklendi
                  </p>
                )}
                {entry.state === "failed" && (
                  <p className="flex items-center gap-1.5 text-xs text-danger">
                    <AlertTriangle className="size-3.5" aria-hidden /> {entry.error}
                  </p>
                )}
              </div>

              <button
                type="button"
                className="self-start text-muted hover:text-ink"
                onClick={() => {
                  URL.revokeObjectURL(entry.preview);
                  setPicked((current) => current.filter((other) => other.key !== entry.key));
                }}
                disabled={busy}
                aria-label="Listeden çıkar"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void upload()}
            disabled={busy || waiting === 0}
          >
            <Upload className="mr-1.5 inline size-4" aria-hidden />
            {busy ? "Yükleniyor…" : `${waiting} görseli yükle`}
          </button>
          <button
            type="button"
            className="rounded-md border border-line px-3.5 py-2 text-sm"
            onClick={clear}
            disabled={busy}
          >
            Listeyi temizle
          </button>
        </div>
      )}
    </div>
  );
}
