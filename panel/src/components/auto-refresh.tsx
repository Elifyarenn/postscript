"use client";

/**
 * Re-renders the current page's server components on an interval (D-091).
 *
 * The conversation screen needs new messages without a WebSocket server,
 * which the hosting does not offer. `router.refresh()` merges the new server
 * payload without resetting client state, so a half-typed message survives.
 * A hidden tab is not refreshed: nobody is reading it.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
