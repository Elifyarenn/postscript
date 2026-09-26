/**
 * The size limit for an issue page picture, shared by the uploader and the
 * service (D-254).
 *
 * D-240 set 25 MB, but every upload travels in one request to a Vercel
 * function, and Vercel refuses a request body over 4.5 MB (D-161) before our
 * code runs. 4 MB leaves room for the form's other fields; a bigger page has
 * to be exported smaller (JPG or WEBP) until uploads go straight to storage.
 */
export const MAX_PAGE_IMAGE_MB = 4;
export const MAX_PAGE_IMAGE_BYTES = MAX_PAGE_IMAGE_MB * 1024 * 1024;

export const PAGE_IMAGE_TOO_LARGE = `Sayfa görseli çok büyük. Sınır: ${MAX_PAGE_IMAGE_MB} MB.`;
