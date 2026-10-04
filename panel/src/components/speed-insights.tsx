"use client";

/**
 * Vercel Speed Insights (D-313): how fast pages open on real readers' devices.
 *
 * No cookie and nothing that ties a measurement to a person. The one field that
 * could is the address: a profile or a message thread carries a username in
 * it. So the address is cut down to the route pattern ("/social/u/[username]")
 * and its query string is dropped before anything leaves the browser.
 */
import { SpeedInsights } from "@vercel/speed-insights/next";

type Event = { type: "vital"; url: string; route?: string };

export function pageAddressOnly(event: Event): Event {
  const address = new URL(event.url);
  return { ...event, url: `${address.origin}${event.route ?? address.pathname}` };
}

export function SiteSpeedInsights() {
  // Half the visits: the free tier stops collecting for 14 days past 10,000
  // events a month (D-313)
  return <SpeedInsights sampleRate={0.5} beforeSend={pageAddressOnly} />;
}
