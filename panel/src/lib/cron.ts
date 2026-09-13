/**
 * Authenticates Vercel Cron invocations (D-103).
 *
 * Vercel sends the project's `CRON_SECRET` as `Authorization: Bearer <secret>`.
 * Anyone can reach the URL, so this check is the only thing between the public
 * internet and a run that deletes records.
 */
import { safeEquals } from "@/lib/crypto";

/** Longer than Vercel's suggested 16, so the secret cannot be brute forced in practice. */
export const CRON_SECRET_MIN_LENGTH = 32;

export function isCronRequestAuthorised(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  // An unset or weak secret closes the endpoint instead of opening it
  if (!secret || secret.length < CRON_SECRET_MIN_LENGTH) return false;
  if (!authorization) return false;
  return safeEquals(authorization, `Bearer ${secret}`);
}
