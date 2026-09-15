import { describe, expect, it } from "vitest";
import { formatMonthYear } from "@/lib/relative-time";

describe("formatMonthYear (D-140)", () => {
  it("names the month and the year, and never the day", () => {
    expect(formatMonthYear(new Date("2026-09-07T12:00:00Z"))).toBe("Eylül 2026");
  });

  it("reads the date in Istanbul time, so a late join is not moved to the next month", () => {
    // 22:30 UTC on 30 September is already 1 October in Istanbul
    expect(formatMonthYear(new Date("2026-09-30T22:30:00Z"))).toBe("Ekim 2026");
    expect(formatMonthYear(new Date("2026-09-30T20:30:00Z"))).toBe("Eylül 2026");
  });
});
