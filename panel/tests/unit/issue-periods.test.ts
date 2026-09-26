/**
 * An issue's topic and delivery windows (D-261): inclusive ends, Turkey's
 * time, and the form rules the database repeats.
 */
import { describe, expect, it } from "vitest";
import {
  formatPeriod,
  parsePeriod,
  periodState,
  toTurkeyLocalInput,
  usesIssueWindows,
} from "@/lib/issue-periods";

// 28.09.2026 18:00 – 05.10.2026 18:00, Turkey's time
const opensAt = new Date("2026-09-28T15:00:00Z");
const closesAt = new Date("2026-10-05T15:00:00Z");
const period = { opensAt, closesAt };

describe("periodState", () => {
  it("is upcoming before the start, open between, closed after", () => {
    expect(periodState(period, new Date("2026-09-28T14:59:59Z"))).toBe("upcoming");
    expect(periodState(period, new Date("2026-10-01T10:00:00Z"))).toBe("open");
    expect(periodState(period, new Date("2026-10-05T15:00:01Z"))).toBe("closed");
  });

  it("counts both ends as inside the window", () => {
    expect(periodState(period, opensAt)).toBe("open");
    expect(periodState(period, closesAt)).toBe("open");
  });

  it("is unset without both ends", () => {
    expect(periodState({ opensAt: null, closesAt: null }, new Date())).toBe("unset");
    expect(periodState({ opensAt, closesAt: null }, new Date())).toBe("unset");
  });
});

describe("parsePeriod", () => {
  it("reads the admin's Turkey-time fields into instants", () => {
    const result = parsePeriod({ opens: "2026-09-28T18:00", closes: "2026-10-05T18:00" }, "Konu");
    expect(result).toEqual({ ok: true, period });
  });

  it("treats two empty fields as not set", () => {
    expect(parsePeriod({ opens: "", closes: null }, "Konu")).toEqual({
      ok: true,
      period: { opensAt: null, closesAt: null },
    });
  });

  it("refuses a start after or equal to its end, half a window, or nonsense", () => {
    expect(parsePeriod({ opens: "2026-10-05T18:00", closes: "2026-09-28T18:00" }, "Konu").ok).toBe(false);
    expect(parsePeriod({ opens: "2026-10-05T18:00", closes: "2026-10-05T18:00" }, "Konu").ok).toBe(false);
    expect(parsePeriod({ opens: "2026-10-05T18:00", closes: "" }, "Konu").ok).toBe(false);
    expect(parsePeriod({ opens: "yarın", closes: "2026-10-05T18:00" }, "Konu").ok).toBe(false);
  });
});

describe("Turkey's time on screen", () => {
  it("prints the window as a Turkish reader expects it", () => {
    expect(formatPeriod(period)).toBe("28 Eylül 18:00 – 5 Ekim 18:00");
  });

  it("fills a datetime-local field with the same wall-clock time it was typed in", () => {
    expect(toTurkeyLocalInput(opensAt)).toBe("2026-09-28T18:00");
    expect(toTurkeyLocalInput(new Date("2026-10-20T20:59:00Z"))).toBe("2026-10-20T23:59");
    expect(toTurkeyLocalInput(new Date("2026-10-20T21:00:00Z"))).toBe("2026-10-21T00:00");
    expect(toTurkeyLocalInput(null)).toBe("");
  });
});

describe("usesIssueWindows", () => {
  it("leaves an issue without windows on the old flow", () => {
    const none = { topicOpensAt: null, topicClosesAt: null, submissionOpensAt: null, submissionClosesAt: null };
    expect(usesIssueWindows(none)).toBe(false);
    expect(usesIssueWindows({ ...none, submissionOpensAt: opensAt, submissionClosesAt: closesAt })).toBe(true);
  });
});
