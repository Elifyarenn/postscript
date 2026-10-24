/**
 * The size limit for a çizer's drawing, shared by the browser check and the
 * service (D-362). Same reason as the issue pages (D-254): every upload
 * travels in one request to a Vercel function, and Vercel refuses a body over
 * 4.5 MB before our code runs.
 */
export const MAX_ILLUSTRATION_MB = 4;
export const MAX_ILLUSTRATION_BYTES = MAX_ILLUSTRATION_MB * 1024 * 1024;
