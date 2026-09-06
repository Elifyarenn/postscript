/**
 * The 18 year rule is enforced in code, so the age calculation is tested down
 * to the day boundary and across leap years (specification §13.3).
 */
import { describe, expect, it } from "vitest";
import { calculateAge, isAdult, parseIsoDate } from "@/lib/age";

const at = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe("parseIsoDate", () => {
  it("accepts a well formed date", () => {
    expect(parseIsoDate("2000-02-29")).toEqual({ year: 2000, month: 2, day: 29 });
  });

  it("rejects a day that does not exist", () => {
    expect(parseIsoDate("2025-02-30")).toBeNull();
    expect(parseIsoDate("2025-13-01")).toBeNull();
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(parseIsoDate("01.01.2000")).toBeNull();
    expect(parseIsoDate("2000-1-1")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });
});

describe("calculateAge", () => {
  it("counts completed years only", () => {
    expect(calculateAge("2000-06-15", at("2026-06-14"))).toBe(25);
    expect(calculateAge("2000-06-15", at("2026-06-15"))).toBe(26);
    expect(calculateAge("2000-06-15", at("2026-06-16"))).toBe(26);
  });

  it("returns 0 on the day of birth", () => {
    expect(calculateAge("2026-09-06", at("2026-09-06"))).toBe(0);
  });

  it("returns null for a future date", () => {
    expect(calculateAge("2030-01-01", at("2026-09-06"))).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(calculateAge("not-a-date", at("2026-09-06"))).toBeNull();
  });

  describe("29 February birthdays", () => {
    it("has not aged on 28 February of a common year", () => {
      // 2026 is not a leap year, so the birthday falls on 1 March (D-013)
      expect(calculateAge("2008-02-29", at("2026-02-28"))).toBe(17);
    });

    it("has aged on 1 March of a common year", () => {
      expect(calculateAge("2008-02-29", at("2026-03-01"))).toBe(18);
    });

    it("ages on the day itself in a leap year", () => {
      expect(calculateAge("2008-02-29", at("2028-02-29"))).toBe(20);
    });
  });
});

describe("isAdult", () => {
  it("refuses the day before the eighteenth birthday", () => {
    expect(isAdult("2008-09-07", at("2026-09-06"))).toBe(false);
  });

  it("accepts on the eighteenth birthday", () => {
    expect(isAdult("2008-09-06", at("2026-09-06"))).toBe(true);
  });

  it("refuses a seventeen year old", () => {
    expect(isAdult("2009-01-01", at("2026-09-06"))).toBe(false);
  });

  it("refuses a missing or malformed date rather than defaulting to allowed", () => {
    expect(isAdult("", at("2026-09-06"))).toBe(false);
    expect(isAdult("2009-02-30", at("2026-09-06"))).toBe(false);
  });
});
