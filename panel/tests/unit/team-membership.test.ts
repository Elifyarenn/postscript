/**
 * Membership periods (D-302): a date the records do not hold stays null.
 */
import { describe, expect, it } from "vitest";
import { markPeriods, rolePeriods } from "@/lib/team-membership";

const at = (iso: string) => new Date(iso);

describe("rolePeriods", () => {
  it("opens on promotion and closes on demotion", () => {
    expect(
      rolePeriods(
        [
          { at: at("2026-01-10T09:00:00Z"), oldRole: "user", newRole: "writer" },
          { at: at("2026-05-01T09:00:00Z"), oldRole: "writer", newRole: "user" },
        ],
        "user",
      ),
    ).toEqual([{ duty: "writer", startedAt: "2026-01-10T09:00:00.000Z", endedAt: "2026-05-01T09:00:00.000Z" }]);
  });

  it("splits a move from writer to editor into two periods", () => {
    const periods = rolePeriods(
      [
        { at: at("2026-01-10T09:00:00Z"), oldRole: "user", newRole: "writer" },
        { at: at("2026-03-01T09:00:00Z"), oldRole: "writer", newRole: "editor" },
      ],
      "editor",
    );
    expect(periods.map((p) => [p.duty, p.endedAt])).toEqual([
      ["writer", "2026-03-01T09:00:00.000Z"],
      ["editor", null],
    ]);
  });

  it("leaves the start unknown when no record holds it", () => {
    expect(rolePeriods([], "admin")).toEqual([{ duty: "admin", startedAt: null, endedAt: null }]);
    expect(rolePeriods([], "user")).toEqual([]);
    const [first] = rolePeriods([{ at: at("2026-02-01T00:00:00Z"), oldRole: "writer", newRole: "user" }], "user");
    expect(first).toEqual({ duty: "writer", startedAt: null, endedAt: "2026-02-01T00:00:00.000Z" });
  });
});

describe("markPeriods", () => {
  it("follows the audit history of a mark", () => {
    expect(
      markPeriods(
        "illustrator",
        [
          { at: at("2026-01-01T00:00:00Z"), before: false, after: true },
          { at: at("2026-02-01T00:00:00Z"), before: true, after: false },
        ],
        false,
      ),
    ).toEqual([{ duty: "illustrator", startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-02-01T00:00:00.000Z" }]);
  });

  it("keeps a current mark without history, start unknown", () => {
    expect(markPeriods("authorized", [], true)).toEqual([{ duty: "authorized", startedAt: null, endedAt: null }]);
    expect(markPeriods("authorized", [], false)).toEqual([]);
  });
});
