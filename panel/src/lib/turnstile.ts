/**
 * Cloudflare Turnstile verification for the forms that make the site send
 * e-mail to an address typed in by a stranger: registration and resending the
 * verification link (D-111). Bots used those forms to open accounts and to
 * mail people who never asked.
 */
import "server-only";
import { env } from "@/lib/env";
import { badRequest } from "@/lib/errors";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare documents tokens as at most 2048 characters. */
const MAX_TOKEN_LENGTH = 2048;

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

let fetcher: Fetcher = (input, init) => fetch(input, init);

/** Only for tests: answer siteverify without reaching Cloudflare. */
export function setBotCheckFetcher(next: Fetcher): void {
  fetcher = next;
}

/** The site key to render the widget with, or null while Turnstile is not configured. */
export function turnstileSiteKey(): string | null {
  const config = env();
  return config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET_KEY ? config.TURNSTILE_SITE_KEY : null;
}

type SiteverifyResult = { success?: boolean; action?: string; "error-codes"?: string[] };

/**
 * Throws 400 unless Cloudflare confirms the token was solved for `action`.
 *
 * Skipped while the keys are unset, so shipping the code cannot close
 * registration before the keys reach Vercel. Once configured it fails closed:
 * if Cloudflare cannot be reached the form is refused, since letting bots
 * through during an outage is what this exists to stop.
 */
export async function assertHuman(
  token: string | null | undefined,
  ip: string | null,
  action: string,
): Promise<void> {
  const config = env();
  if (!config.TURNSTILE_SITE_KEY || !config.TURNSTILE_SECRET_KEY) return;

  const refusal = badRequest("Bot doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar deneyin.");
  if (!token || token.length > MAX_TOKEN_LENGTH) throw refusal;

  let result: SiteverifyResult;
  try {
    const response = await fetcher(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: config.TURNSTILE_SECRET_KEY,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(5_000),
    });
    result = (await response.json()) as SiteverifyResult;
  } catch (error) {
    // The token and the secret stay out of the log; the reason is enough
    console.error(`Turnstile siteverify unreachable: ${error instanceof Error ? error.message : String(error)}`);
    throw refusal;
  }

  if (result.success !== true) throw refusal;
  // A token solved on another form must not open this one
  if (result.action !== undefined && result.action !== action) throw refusal;
}
