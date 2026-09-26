/**
 * Times are Turkey's, whatever zone the server runs in (D-257).
 */
import { describe, expect, it } from "vitest";
import { formatDateTime, parseTurkeyLocalDateTime } from "@/lib/utils";

describe("parseTurkeyLocalDateTime", () => {
  it("reads the schedule field as Turkey's time, not the server's", () => {
    expect(parseTurkeyLocalDateTime("2026-10-01T17:00")?.toISOString()).toBe("2026-10-01T14:00:00.000Z");
    expect(parseTurkeyLocalDateTime("2026-10-01T17:00:30")?.toISOString()).toBe("2026-10-01T14:00:30.000Z");
  });

  it("refuses anything that is not a datetime-local value", () => {
    expect(parseTurkeyLocalDateTime("")).toBeNull();
    expect(parseTurkeyLocalDateTime("2026-10-01")).toBeNull();
    expect(parseTurkeyLocalDateTime("2026-13-45T99:99")).toBeNull();
    expect(parseTurkeyLocalDateTime("2026-10-01T17:00Z")).toBeNull();
  });
});

describe("formatDateTime", () => {
  it("shows 14.00 UTC as 17:00", () => {
    expect(formatDateTime(new Date("2026-10-01T14:00:00Z"))).toContain("17:00");
  });
});
