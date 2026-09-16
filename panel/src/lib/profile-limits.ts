/**
 * The limits of the community profile, in one place both sides can import
 * (D-160). The edit dialog checks a picture before it is sent, so the member
 * learns about a 9 MB photo at once instead of after a long upload; the
 * services enforce the same numbers again, because the browser can be skipped.
 */

export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

/** The picture types the upload check recognises; PDF is refused for a profile. */
export const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export const MAX_PEN_NAME_LENGTH = 80;

export const MAX_BIO_LENGTH = 2000;
