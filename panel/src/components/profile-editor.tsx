"use client";

/**
 * "Profili düzenle" the way X does it (D-160): a button on the member's own
 * profile opens one dialog holding the cover photo, the profile picture over
 * it, the pen name and the bio, with a single "Kaydet" in its top bar.
 *
 * - Chosen pictures are previewed at once and sent only on "Kaydet".
 * - The picture checks run here first, so a wrong file is caught before a long
 *   upload; the service repeats every check, because the browser can be skipped.
 * - Closing with unsaved changes asks before throwing them away.
 * - Nothing is saved field by field: the service keeps all of it or none.
 *
 * Built on the native <dialog>: it traps focus, answers Esc and makes the page
 * behind it inert without a library (the project adds none for this).
 */
import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Camera, X } from "lucide-react";
import { updateProfileAction } from "@/app/social/actions";
import {
  MAX_BIO_LENGTH,
  MAX_PEN_NAME_LENGTH,
  MAX_PROFILE_IMAGE_BYTES,
  PROFILE_IMAGE_TYPES,
} from "@/lib/profile-limits";
import type { ActionState } from "./form";

export type EditableProfile = {
  username: string | null;
  penName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
};

type PictureKind = "avatar" | "header";

/** One picture's pending change; `previewUrl` is a blob URL only for a new file. */
type Picture = { action: "keep" | "remove" | "replace"; previewUrl: string | null };

const UNCHANGED: Picture = { action: "keep", previewUrl: null };

const PICTURE_TEXT = {
  avatar: { pick: "Profil fotoğrafı seç", remove: "Profil fotoğrafını kaldır" },
  header: { pick: "Kapak fotoğrafı seç", remove: "Kapak fotoğrafını kaldır" },
} as const;

/** Why a picked file cannot be used, or null. Mirrors the service's checks (D-141). */
function pictureProblem(file: File): string | null {
  if (!(PROFILE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Yalnızca JPEG, PNG, GIF ya da WEBP seçebilirsiniz.";
  }
  if (file.size > MAX_PROFILE_IMAGE_BYTES) return "Görsel çok büyük. Sınır: 5 MB.";
  return null;
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

  const [penName, setPenName] = useState(profile.penName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [pictures, setPictures] = useState<Record<PictureKind, Picture>>({
    avatar: UNCHANGED,
    header: UNCHANGED,
  });
  const [pickErrors, setPickErrors] = useState<Partial<Record<PictureKind, string>>>({});
  // A previous attempt's errors must not greet the member when the dialog opens again
  const [showResult, setShowResult] = useState(false);

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await updateProfileAction(previous, formData);
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

  const isDirty =
    penName !== (profile.penName ?? "") ||
    bio !== (profile.bio ?? "") ||
    pictures.avatar.action !== "keep" ||
    pictures.header.action !== "keep";

  const fieldError = (name: string): string | undefined =>
    showResult ? state?.fieldErrors?.[name]?.[0] : undefined;

  /** Back to what the server holds: used on open and whenever the dialog closes. */
  function resetToSaved() {
    setPenName(profile.penName ?? "");
    setBio(profile.bio ?? "");
    setPictures({ avatar: UNCHANGED, header: UNCHANGED });
    setPickErrors({});
    setShowResult(false);
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

  function pick(kind: PictureKind, file: File | undefined) {
    if (!file) return;
    const problem = pictureProblem(file);
    if (problem) {
      setPickErrors((errors) => ({ ...errors, [kind]: problem }));
      // The rejected file must not travel with the form
      if (inputRefs[kind].current) inputRefs[kind].current.value = "";
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    blobUrls.current.add(previewUrl);
    setPickErrors((errors) => ({ ...errors, [kind]: undefined }));
    setPictures((current) => ({ ...current, [kind]: { action: "replace", previewUrl } }));
  }

  function remove(kind: PictureKind) {
    if (inputRefs[kind].current) inputRefs[kind].current.value = "";
    setPickErrors((errors) => ({ ...errors, [kind]: undefined }));
    setPictures((current) => ({ ...current, [kind]: { action: "remove", previewUrl: null } }));
  }

  function shownUrl(kind: PictureKind): string | null {
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
    setShowResult(true);
  }

  const headerUrl = shownUrl("header");
  const avatarUrl = shownUrl("avatar");
  const titleId = `${id}-title`;

  /** The round camera and remove controls laid over a picture. */
  const pictureControls = (kind: PictureKind, hasPicture: boolean) => (
    <span className="profile-editor-photo-actions">
      <label className="profile-editor-photo-action">
        <Camera aria-hidden className="size-5" />
        <span className="sr-only">{PICTURE_TEXT[kind].pick}</span>
        <input
          ref={inputRefs[kind]}
          type="file"
          name={`${kind}Image`}
          accept={PROFILE_IMAGE_TYPES.join(",")}
          className="sr-only"
          aria-invalid={Boolean(pickErrors[kind] ?? fieldError(`${kind}Image`)) || undefined}
          aria-describedby={`${id}-${kind}-error`}
          onChange={(event) => pick(kind, event.currentTarget.files?.[0])}
        />
      </label>
      {hasPicture && (
        <button
          type="button"
          className="profile-editor-photo-action"
          onClick={() => remove(kind)}
          aria-label={PICTURE_TEXT[kind].remove}
          title={PICTURE_TEXT[kind].remove}
        >
          <X aria-hidden className="size-5" />
        </button>
      )}
    </span>
  );

  const pictureError = (kind: PictureKind) => {
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
            <button type="submit" className="profile-editor-save" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </header>

          {showResult && state?.error && (
            <p className="profile-editor-alert" role="alert">
              {state.error}
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
          {/* Both pictures' problems go under the avatar, which half covers the strip above */}
          {pictureError("header")}
          {pictureError("avatar")}

          <div className="profile-editor-fields">
            <div className="profile-editor-field" data-invalid={Boolean(fieldError("penName")) || undefined}>
              <span className="profile-editor-field-top">
                <label htmlFor={`${id}-penName`}>Mahlas</label>
                <span className="profile-editor-count" aria-hidden>
                  {penName.length}/{MAX_PEN_NAME_LENGTH}
                </span>
              </span>
              <input
                id={`${id}-penName`}
                name="penName"
                value={penName}
                onChange={(event) => setPenName(event.currentTarget.value)}
                maxLength={MAX_PEN_NAME_LENGTH}
                autoComplete="off"
                aria-invalid={Boolean(fieldError("penName")) || undefined}
                aria-describedby={`${id}-penName-hint ${id}-penName-error`}
              />
            </div>
            <p id={`${id}-penName-hint`} className="profile-editor-hint">
              Profilinizde ve yazılarınızda görünen ad. Boş bırakırsanız
              {profile.username ? ` @${profile.username}` : " kullanıcı adınız"} görünür.
            </p>
            <p id={`${id}-penName-error`} className="profile-editor-error">
              {fieldError("penName")}
            </p>

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
