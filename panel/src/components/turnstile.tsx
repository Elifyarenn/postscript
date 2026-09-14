"use client";

/**
 * The Cloudflare Turnstile widget (D-111). It writes its token into the
 * enclosing form as `botToken`, which the server then checks with Cloudflare.
 *
 * A token can be spent only once, so the widget is reset after every submit:
 * a form that comes back with an error would otherwise send a used token and
 * be refused a second time.
 */
import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";
import { BOT_TOKEN_FIELD } from "@/lib/bot-token";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({ siteKey, action }: { siteKey: string; action: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const render = useCallback(() => {
    if (!container.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      action,
      "response-field-name": BOT_TOKEN_FIELD,
      language: "tr",
    });
  }, [siteKey, action]);

  useEffect(() => {
    // The script may already be loaded from an earlier page, in which case onLoad never fires
    render();

    const form = container.current?.closest("form");
    const resetAfterSubmit = () => {
      // The token is already inside this submission; the next attempt needs a new one
      window.setTimeout(() => {
        if (widgetId.current) window.turnstile?.reset(widgetId.current);
      }, 0);
    };
    form?.addEventListener("submit", resetAfterSubmit);

    return () => {
      form?.removeEventListener("submit", resetAfterSubmit);
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [render]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={render}
      />
      <div ref={container} />
    </>
  );
}
