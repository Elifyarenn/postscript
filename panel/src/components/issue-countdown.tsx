"use client";

/**
 * The countdown to an issue's release on the issues page (D-192). It ticks in
 * the reader's browser; the server draws the date in words, so the moment is
 * readable before the script runs and for screen readers, which are not read
 * every second.
 */
import { useEffect, useState } from "react";
import { countdownParts } from "@/lib/countdown";
import { Sparkle } from "./site-ui";

const UNITS = [
  ["days", "Gün"],
  ["hours", "Saat"],
  ["minutes", "Dakika"],
  ["seconds", "Saniye"],
] as const;

export function IssueCountdown({
  releaseAt,
  issueLabel,
  title,
  momentText,
}: {
  /** ISO time with its offset, e.g. 2026-10-01T17:00:00+03:00. */
  releaseAt: string;
  /** "Sayı 01" */
  issueLabel: string;
  title: string;
  /** "1 Ekim 17.00", worded on the server. */
  momentText: string;
}) {
  const target = new Date(releaseAt).getTime();
  // Null until mounted: the server's clock and the reader's differ, so the numbers are drawn only here
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const parts = now === null ? null : countdownParts(target, now);

  return (
    <section className="issue-countdown" aria-labelledby="issue-countdown-title">
      <p className="issue-countdown-label">
        <Sparkle /> {issueLabel}
      </p>
      <h2 id="issue-countdown-title" className="issue-countdown-title fit-line" lang="en">
        {title}
      </h2>

      {parts?.done ? (
        <p className="issue-countdown-soon">Çok yakında</p>
      ) : (
        <ol className="issue-countdown-clock" aria-hidden>
          {UNITS.map(([key, label]) => (
            <li key={key}>
              <span className="issue-countdown-number">
                {parts ? String(parts[key]).padStart(2, "0") : "––"}
              </span>
              <span className="issue-countdown-unit">{label}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="issue-countdown-when">{momentText}&apos;de yayında</p>
    </section>
  );
}
