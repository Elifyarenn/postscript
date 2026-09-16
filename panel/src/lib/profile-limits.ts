/**
 * The limits of the community profile, in one place both sides can import
 * (D-160). The edit dialog checks a picture before it is sent, so the member
 * learns about a wrong file at once instead of after a long upload; the
 * services enforce the stored limits again, because the browser can be skipped.
 */

/** The largest picture the service stores. */
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

/** The picture types the upload check recognises; PDF is refused for a profile. */
export const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export const MAX_PEN_NAME_LENGTH = 80;

export const MAX_BIO_LENGTH = 2000;

/**
 * Both pictures together, as one save sends them (D-161). Vercel refuses a
 * request body over 4.5 MB before the action runs; this leaves room for the
 * multipart framing and a full-length bio.
 */
export const MAX_PROFILE_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * The largest file the browser will even try to shrink. A phone photo is a few
 * megabytes; past this, decoding it could stall a small phone.
 */
export const MAX_SOURCE_IMAGE_BYTES = 30 * 1024 * 1024;

/** The longest side a picture is kept at. Larger never shows larger on the profile. */
export const PROFILE_IMAGE_MAX_SIDE = { avatar: 1000, header: 2000 } as const;

/** Small enough to send untouched: re-encoding it would only cost quality. */
export const KEEP_ORIGINAL_BYTES = 1024 * 1024;

export type ProfileImageKind = keyof typeof PROFILE_IMAGE_MAX_SIDE;

/** The width and height that fit inside a square of `maxSide`, keeping the shape; never enlarges. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export type PicturePlan =
  | { kind: "refuse"; message: string }
  | { kind: "keep" }
  | { kind: "shrink"; width: number; height: number };

/**
 * What the dialog does with a picked file (D-161), decided from its type, size
 * and pixel size alone so it can be tested without a browser:
 *
 * - a type the service would refuse, or a file too big to decode: refused;
 * - a GIF is sent as it is, because redrawing it would stop its animation, so
 *   it must already be within the stored limit;
 * - a small file that is not oversized in pixels is sent untouched;
 * - anything else is redrawn at most `PROFILE_IMAGE_MAX_SIDE` on its long side.
 */
export function planPicture(
  file: { type: string; size: number },
  pixels: { width: number; height: number } | null,
  kind: ProfileImageKind,
): PicturePlan {
  if (!(PROFILE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { kind: "refuse", message: "Yalnızca JPEG, PNG, GIF ya da WEBP seçebilirsiniz." };
  }
  if (file.type === "image/gif") {
    return file.size > MAX_PROFILE_UPLOAD_BYTES
      ? { kind: "refuse", message: "Hareketli GIF en fazla 4 MB olabilir." }
      : { kind: "keep" };
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return { kind: "refuse", message: "Fotoğraf çok büyük. Sınır: 30 MB." };
  }
  if (!pixels) return { kind: "refuse", message: "Bu fotoğraf açılamadı. Başka bir dosya deneyin." };

  const maxSide = PROFILE_IMAGE_MAX_SIDE[kind];
  const oversized = Math.max(pixels.width, pixels.height) > maxSide;
  if (!oversized && file.size <= KEEP_ORIGINAL_BYTES) return { kind: "keep" };

  return { kind: "shrink", ...fitWithin(pixels.width, pixels.height, maxSide) };
}

/** Why the pictures of one save cannot be sent together, or null. */
export function uploadProblem(sizes: number[]): string | null {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return total > MAX_PROFILE_UPLOAD_BYTES
    ? "Fotoğraflar birlikte çok büyük (en fazla 4 MB). Birini değiştirip yeniden deneyin."
    : null;
}
