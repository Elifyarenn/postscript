/**
 * Front-end revalidation webhook (§10).
 *
 * The public site is deployed separately, so publishing or withdrawing has to
 * tell it to drop its cache. Failures are logged and swallowed: a front end
 * that is down must not roll back a publication that already happened.
 */
import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

export type RevalidateEvent = {
  type: "article.published" | "article.withdrawn" | "article.updated" | "issue.published";
  slug?: string;
  issueNumber?: number;
};

export async function triggerRevalidate(event: RevalidateEvent): Promise<void> {
  const config = env();
  const url = config.REVALIDATE_WEBHOOK_URL;
  if (!url) return;

  const payload = JSON.stringify({ ...event, sentAt: new Date().toISOString() });

  // Signed so the front end can tell a real call from a random POST
  const signature = config.REVALIDATE_WEBHOOK_SECRET
    ? createHmac("sha256", config.REVALIDATE_WEBHOOK_SECRET).update(payload).digest("hex")
    : undefined;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(signature ? { "x-postscript-signature": signature } : {}),
      },
      body: payload,
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Revalidate webhook failed", error);
  }
}
