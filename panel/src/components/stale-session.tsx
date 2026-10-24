/**
 * Clears a session cookie that opens nothing any more (D-365). Placed only on
 * the per-request public pages a cookie holder reaches; the cached anonymous
 * copies never render it, since reading cookies would take them off the cache.
 */
import { hasStaleSessionCookie } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { ClearStaleSession } from "./clear-stale-session";

export async function StaleSessionCleaner() {
  if (!(await hasStaleSessionCookie())) return null;
  const csrfToken = await readCsrfToken();
  // Without the token cookie the action would be refused; nothing to try
  if (!csrfToken) return null;
  return <ClearStaleSession csrfToken={csrfToken} />;
}
