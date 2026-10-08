/**
 * Writer accounts that exist to try the panel out (D-333). They keep their
 * role, articles and documents, but they are not part of the writer roster:
 * not in the admin's "Yazarlar" list, not mailed when an issue's windows open,
 * not counted among the writers an issue waits on, not offered a temporary
 * area. Addresses are stored lowercase (`normalizeEmail`). This list is the
 * only place they live; a real writer is never added here.
 */
export const TEST_WRITER_EMAILS: readonly string[] = ["semrailhan@outlook.com"];

export function isTestWriterEmail(email: string): boolean {
  return TEST_WRITER_EMAILS.includes(email.trim().toLowerCase());
}
