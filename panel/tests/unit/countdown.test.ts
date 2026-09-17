import { describe, expect, it } from "vitest";
import { countdownParts, formatReleaseMoment } from "@/lib/countdown";
import { issueExtrasFor } from "@/lib/issue-extras";

describe("issue countdown (D-192)", () => {
  const release = "2026-10-01T17:00:00+03:00";
  const target = new Date(release).getTime();

  it("splits the time left into days, hours, minutes and seconds", () => {
    const now = new Date("2026-09-17T12:30:15+03:00").getTime();
    expect(countdownParts(target, now)).toEqual({ days: 14, hours: 4, minutes: 29, seconds: 45, done: false });
  });

  it("stops at zero once the moment has passed", () => {
    expect(countdownParts(target, target)).toMatchObject({ days: 0, seconds: 0, done: true });
    expect(countdownParts(target, target + 60_000).done).toBe(true);
  });

  it("words the moment in Turkey's time", () => {
    expect(formatReleaseMoment(release)).toBe("1 Ekim 17.00");
  });

  it("counts down to Obsession on 1 October at 17.00", () => {
    expect(issueExtrasFor(1)?.release).toEqual({ at: release, title: "Obsession" });
  });
});
