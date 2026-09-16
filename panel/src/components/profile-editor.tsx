"use client";

/**
 * "Profili düzenle" the way X does it (D-160): a button on the member's own
 * profile opens one dialog holding the cover photo, the profile picture over
 * it and the bio, with a single "Kaydet" in its top bar. There is no name
 * field: the community shows the handle (D-166), and the pen name is the
 * magazine's, changed on the account page (D-162).
 *
 * - Chosen pictures are prepared in the browser and previewed at once; they are
 *   sent only on "Kaydet" (D-161: shrunk first, so a phone photo fits the
 *   4.5 MB body Vercel accepts - the original file never travels).
 * - Closing with unsaved changes asks before throwing them away.
 * - Nothing is saved field by field: the service keeps all of it or none, and
 *   repeats every check, because the browser can be skipped.
 *
 * Built on the native <dialog>: it traps focus, answers Esc and makes the page
 * behind it inert without a library (the project adds none for this).
 */
import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Camera, X } from "lucide-react";
import { updateProfileAction } from "@/app/social/actions";
import {
  MAX_BIO_LENGTH,
  PROFILE_IMAGE_TYPES,
  planPicture,
  uploadProblem,
  type ProfileImageKind,
} from "@/lib/profile-limits";
import type { ActionState } from "./form";

export type EditableProfile = {
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
};

const KINDS: ProfileImageKind[] = ["avatar", "header"];

/** One picture's pending change; `previewUrl` is a blob URL only for a new file. */
type Picture = { action: "keep" | "remove" | "replace"; previewUrl: string | null };

const UNCHANGED: Picture = { action: "keep", previewUrl: null };

const PICTURE_TEXT = {
  avatar: { pick: "Profil fotoğrafı seç", remove: "Profil fotoğrafını kaldır" },
  header: { pick: "Kapak fotoğrafı seç", remove: "Kapak fotoğrafını kaldır" },
} as const;

/** Behind a picture with transparency when the browser can only write JPEG: the page's paper. */
const JPEG_BACKGROUND = "#ded2c7";

const ENCODE_QUALITY = 0.86;

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, ENCODE_QUALITY));
}

/**
 * WebP keeps transparency and is the smaller file. A browser that cannot write
 * it silently hands back a PNG instead, so the type is checked and JPEG, which
 * every browser writes, is the fallback.
 */
async function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const webp = await canvasToBlob(canvas, "image/webp");
  if (webp?.type === "image/webp") return webp;

  const context = canvas.getContext("2d");
  if (context) {
    // JPEG has no transparency; without a fill the clear parts turn black
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = JPEG_BACKGROUND;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvasToBlob(canvas, "image/jpeg");
}

/**
 * Turns a picked file into the file that will be sent, or a reason it cannot
 * be. The decision itself is `planPicture`, tested without a browser (D-161).
 */
async function preparePicture(file: File, kind: ProfileImageKind): Promise<{ file: File } | { error: string }> {
  const decodable = file.type !== "image/gif" && (PROFILE_IMAGE_TYPES as readonly string[]).includes(file.type);
  // "from-image" applies the camera's rotation, so a portrait photo is not stored lying down
  const bitmap = decodable
    ? await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null)
    : null;

  try {
    const plan = planPicture(file, bitmap ? { width: bitmap.width, height: bitmap.height } : null, kind);
    if (plan.kind === "refuse") return { error: plan.message };
    if (plan.kind === "keep") return { file };

    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    if (!context || !bitmap) return { error: "Bu fotoğraf hazırlanamadı. Başka bir dosya deneyin." };
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, plan.width, plan.height);

    const blob = await encodeCanvas(canvas);
    if (!blob) return { error: "Bu fotoğraf hazırlanamadı. Başka bir dosya deneyin." };
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    return { file: new File([blob], `${kind}.${extension}`, { type: blob.type }) };
  } finally {
    bitmap?.close();
  }
}

export function ProfileEditor({
  profile,
  csrfToken,
  triggerClassName,
}: {
  profile: EditableProfile;
  csrfToken: string;
  triggerClassName?: string;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const inputRefs = { avatar: useRef<HTMLInputElement>(null), header: useRef<HTMLInputElement>(null) };
  // Every blob URL made for a preview, so none outlives the dialog
  const blobUrls = useRef(new Set<string>());
  // The prepared files; the inputs carry no name, so the originals are never sent
  const chosenFiles = useRef<Partial<Record<ProfileImageKind, File>>>({});
  // Bumped on every reset, so a picture still being prepared when the dialog
  // closes cannot land in the next opening
  const generation = useRef(0);

  const [bio, setBio] = useState(profile.bio ?? "");
  const [pictures, setPictures] = useState<Record<ProfileImageKind, Picture>>({
    avatar: UNCHANGED,
    header: UNCHANGED,
  });
  const [preparing, setPreparing] = useState(0);
  const [pickErrors, setPickErrors] = useState<Partial<Record<ProfileImageKind, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  // A previous attempt's errors must not greet the member when the dialog opens again
  const [showResult, setShowResult] = useState(false);

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      for (const kind of KINDS) {
        const file = chosenFiles.current[kind];
        if (formData.get(`${kind}Action`) === "replace" && file) formData.set(`${kind}Image`, file);
      }

      let result: ActionState;
      try {
        result = await updateProfileAction(previous, formData);
      } catch {
        // A dropped connection or a body the host refused never reaches runAction
        return { error: "Profil kaydedilemedi. Bağlantınızı kontrol edip yeniden deneyin." };
      }
      // X closes the dialog on a successful save; the page behind is already re-rendered
      if (result?.success) dialogRef.current?.close();
      return result;
    },
    null,
  );

  useEffect(() => {
    const urls = blobUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const busy = pending || preparing > 0;

  const isDirty =
    bio !== (profile.bio ?? "") ||
    pictures.avatar.action !== "keep" ||
    pictures.header.action !== "keep";

  const fieldError = (name: string): string | undefined =>
    showResult ? state?.fieldErrors?.[name]?.[0] : undefined;

  /** Back to what the server holds: used on open and whenever the dialog closes. */
  function resetToSaved() {
    generation.current += 1;
    setBio(profile.bio ?? "");
    setPictures({ avatar: UNCHANGED, header: UNCHANGED });
    setPreparing(0);
    setPickErrors({});
    setSubmitError(null);
    setShowResult(false);
    chosenFiles.current = {};
    blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrls.current.clear();
    for (const ref of Object.values(inputRefs)) if (ref.current) ref.current.value = "";
  }

  function open() {
    resetToSaved();
    dialogRef.current?.showModal();
  }

  /** The close button and Esc: straight out when nothing changed, otherwise ask first. */
  function requestClose() {
    if (pending) return;
    if (isDirty) confirmRef.current?.showModal();
    else dialogRef.current?.close();
  }

  function discardChanges() {
    confirmRef.current?.close();
    dialogRef.current?.close();
  }

  async function pick(kind: ProfileImageKind, file: File | undefined) {
    if (!file) return;
    // Emptied at once: picking the same file again must fire a change, and the
    // original is never sent anyway
    if (inputRefs[kind].current) inputRefs[kind].current.value = "";

    const started = generation.current;
    setPreparing((count) => count + 1);
    const prepared = await preparePicture(file, kind);
    if (started !== generation.current) return;
    setPreparing((count) => count - 1);

    if ("error" in prepared) {
      setPickErrors((errors) => ({ ...errors, [kind]: prepared.error }));
      return;
    }
    const previewUrl = URL.createObjectURL(prepared.file);
    blobUrls.current.add(previewUrl);
    chosenFiles.current[kind] = prepared.file;
    setPickErrors((errors) => ({ ...errors, [kind]: undefined }));
    setSubmitError(null);
    setPictures((current) => ({ ...current, [kind]: { action: "replace", previewUrl } }));
  }

  function remove(kind: ProfileImageKind) {
    if (inputRefs[kind].current) inputRefs[kind].current.value = "";
    delete chosenFiles.current[kind];
    setPickErrors((errors) => ({ ...errors, [kind]: undefined }));
    setSubmitError(null);
    setPictures((current) => ({ ...current, [kind]: { action: "remove", previewUrl: null } }));
  }

  function shownUrl(kind: ProfileImageKind): string | null {
    const picture = pictures[kind];
    if (picture.action === "replace") return picture.previewUrl;
    if (picture.action === "remove") return null;
    return kind === "avatar" ? profile.avatarUrl : profile.headerUrl;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    // Saving nothing is just closing, as on X; no request is made
    if (!isDirty) {
      event.preventDefault();
      dialogRef.current?.close();
      return;
    }
    const sizes = KINDS.filter((kind) => pictures[kind].action === "replace").map(
      (kind) => chosenFiles.current[kind]?.size ?? 0,
    );
    const problem = uploadProblem(sizes);
    if (problem) {
      event.preventDefault();
      setSubmitError(problem);
      return;
    }
    setSubmitError(null);
    setShowResult(true);
  }

  const headerUrl = shownUrl("header");
  const avatarUrl = shownUrl("avatar");
  const titleId = `${id}-title`;
  const topError = submitError ?? (showResult ? state?.error : undefined);

  /** The round camera and remove controls laid over a picture. */
  const pictureControls = (kind: ProfileImageKind, hasPicture: boolean) => (
    <span className="profile-editor-photo-actions">
      <label className="profile-editor-photo-action">
        <Camera aria-hidden className="size-5" />
        <span className="sr-only">{PICTURE_TEXT[kind].pick}</span>
        <input
          ref={inputRefs[kind]}
          type="file"
          accept={PROFILE_IMAGE_TYPES.join(",")}
          className="sr-only"
          disabled={busy}
          aria-invalid={Boolean(pickErrors[kind] ?? fieldError(`${kind}Image`)) || undefined}
          aria-describedby={`${id}-${kind}-error`}
          onChange={(event) => void pick(kind, event.currentTarget.files?.[0])}
        />
      </label>
      {hasPicture && (
        <button
          type="button"
          className="profile-editor-photo-action"
          onClick={() => remove(kind)}
          disabled={busy}
          aria-label={PICTURE_TEXT[kind].remove}
          title={PICTURE_TEXT[kind].remove}
        >
          <X aria-hidden className="size-5" />
        </button>
      )}
    </span>
  );

  const pictureError = (kind: ProfileImageKind) => {
    const message = pickErrors[kind] ?? fieldError(`${kind}Image`);
    return (
      <p id={`${id}-${kind}-error`} className="profile-editor-error" role={message ? "alert" : undefined}>
        {message}
      </p>
    );
  };

  return (
    <>
      <button type="button" className={triggerClassName} onClick={open}>
        Profili düzenle
      </button>

      <dialog
        ref={dialogRef}
        className="profile-editor"
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onClose={resetToSaved}
      >
        <form action={formAction} onSubmit={submit} className="profile-editor-form">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="avatarAction" value={pictures.avatar.action} />
          <input type="hidden" name="headerAction" value={pictures.header.action} />

          <header className="profile-editor-bar">
            <button
              type="button"
              className="profile-editor-close"
              onClick={requestClose}
              disabled={pending}
              aria-label="Kapat"
              title="Kapat"
            >
              <X aria-hidden className="size-5" />
            </button>
            <h2 id={titleId} className="profile-editor-title">
              Profili düzenle
            </h2>
            <button type="submit" className="profile-editor-save" disabled={busy}>
              {pending ? "Kaydediliyor…" : preparing > 0 ? "Hazırlanıyor…" : "Kaydet"}
            </button>
          </header>

          {topError && (
            <p className="profile-editor-alert" role="alert">
              {topError}
            </p>
          )}

          <div className="profile-editor-cover">
            {headerUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- a blob preview or our own media route
              <img src={headerUrl} alt="" />
            )}
            {pictureControls("header", Boolean(headerUrl))}
          </div>

          <div className="profile-editor-avatar">
            <span className="profile-editor-avatar-circle">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a blob preview or our own media route
                <img src={avatarUrl} alt="" />
              ) : (
                <span aria-hidden>{(profile.username ?? "?").charAt(0)}</span>
              )}
              {pictureControls("avatar", Boolean(avatarUrl))}
            </span>
          </div>

          {/* Both pictures' notes go under the avatar, which half covers the strip above */}
          <p className="profile-editor-status" role="status">
            {preparing > 0 ? "Fotoğraf hazırlanıyor…" : ""}
          </p>
          {pictureError("header")}
          {pictureError("avatar")}

          <div className="profile-editor-fields">
            <div className="profile-editor-field" data-invalid={Boolean(fieldError("bio")) || undefined}>
              <span className="profile-editor-field-top">
                <label htmlFor={`${id}-bio`}>Biyografi</label>
                <span className="profile-editor-count" aria-hidden>
                  {bio.length}/{MAX_BIO_LENGTH}
                </span>
              </span>
              <textarea
                id={`${id}-bio`}
                name="bio"
                value={bio}
                onChange={(event) => setBio(event.currentTarget.value)}
                maxLength={MAX_BIO_LENGTH}
                rows={4}
                aria-invalid={Boolean(fieldError("bio")) || undefined}
                aria-describedby={`${id}-bio-error`}
              />
            </div>
            <p id={`${id}-bio-error`} className="profile-editor-error">
              {fieldError("bio")}
            </p>

            {/* The magazine's name is kept apart, so nobody hunts for it here (D-162) */}
            <p className="profile-editor-hint">
              Dergide yazılarınızda görünen mahlasınızı{" "}
              <Link href="/account" className="underline">
                Hesabım
              </Link>{" "}
              sayfasından değiştirebilirsiniz.
            </p>
          </div>
        </form>

        {/* X's "Discard changes?" - a second modal on top, so Esc closes only this */}
        <dialog
          ref={confirmRef}
          className="profile-editor-confirm"
          role="alertdialog"
          aria-labelledby={`${id}-discard-title`}
          aria-describedby={`${id}-discard-body`}
        >
          <h3 id={`${id}-discard-title`}>Değişiklikler silinsin mi?</h3>
          <p id={`${id}-discard-body`}>Bu işlem geri alınamaz; yaptığınız değişiklikler kaydedilmeden kaybolur.</p>
          <div className="profile-editor-confirm-actions">
            <button type="button" className="profile-editor-discard" onClick={discardChanges}>
              Sil
            </button>
            <button type="button" autoFocus onClick={() => confirmRef.current?.close()}>
              Vazgeç
            </button>
          </div>
        </dialog>
      </dialog>
    </>
  );
}
