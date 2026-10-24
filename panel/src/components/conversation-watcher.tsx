"use client";

/**
 * Keeps an open conversation current without re-rendering it on a timer
 * (D-364). It asks the server for the conversation's fingerprint and redraws
 * the page only when that differs from the one the page was drawn with; the
 * page, once redrawn, hands down the new fingerprint. Sending a message
 * redraws the page itself, so the new fingerprint arrives with it and the
 * poll does not redraw a second time.
 *
 * A hidden tab does not ask: nobody is reading it. Coming back asks at once.
 * An answer that is not a fingerprint (the other member blocked this one, the
 * session ended) redraws too, so the page shows why.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function ConversationWatcher({
  username,
  fingerprint,
  intervalMs,
}: {
  username: string;
  fingerprint: string;
  intervalMs: number;
}) {
  const router = useRouter();
  // The value a redraw was already asked for, so a slow redraw is not asked again
  const requested = useRef<string | null>(null);

  useEffect(() => {
    requested.current = null;
    let stopped = false;

    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/direct-messages/fingerprint?with=${encodeURIComponent(username)}`, {
          cache: "no-store",
        });
        if (stopped) return;
        if (!response.ok) {
          router.refresh();
          return;
        }
        const { fingerprint: current } = (await response.json()) as { fingerprint: string };
        if (!stopped && current !== fingerprint && current !== requested.current) {
          requested.current = current;
          router.refresh();
        }
      } catch {
        // Offline for a moment: the next tick asks again
      }
    };

    const timer = window.setInterval(check, intervalMs);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, username, fingerprint, intervalMs]);

  return null;
}
