import { describe, expect, it } from "vitest";
import { isIssueClosed, pickActiveIssue, pickListIssue } from "@/lib/active-issue";

const issue = (number: number, status: "planning" | "in_production" | "published" | "archived", deleted = false) => ({
  id: `i${number}`,
  number,
  status,
  deletedAt: deleted ? new Date() : null,
});

describe("pickActiveIssue (D-330)", () => {
  const rows = [issue(1, "published"), issue(2, "in_production"), issue(3, "planning")];

  it("takes the lowest open issue when nothing is chosen", () => {
    expect(pickActiveIssue(rows, null)?.number).toBe(2);
  });

  it("follows the admin's choice while that issue is open", () => {
    expect(pickActiveIssue(rows, "i3")?.number).toBe(3);
  });

  it("ignores a choice that was published, archived or deleted since", () => {
    expect(pickActiveIssue(rows, "i1")?.number).toBe(2);
    expect(pickActiveIssue([...rows, issue(4, "planning", true)], "i4")?.number).toBe(2);
  });

  it("has no active issue when every issue is closed", () => {
    expect(pickActiveIssue([issue(1, "published"), issue(2, "archived")], null)).toBeNull();
  });

  it("treats published and archived as closed", () => {
    expect(isIssueClosed({ status: "published" })).toBe(true);
    expect(isIssueClosed({ status: "archived" })).toBe(true);
    expect(isIssueClosed({ status: "planning" })).toBe(false);
  });
});

describe("pickListIssue (D-330)", () => {
  const visible = [
    { id: "a", number: 1 },
    { id: "b", number: 2 },
    { id: "c", number: 3 },
  ];

  it("opens on the active issue and never on 'all'", () => {
    expect(pickListIssue(visible, undefined, "b")?.id).toBe("b");
    expect(pickListIssue(visible, "", "b")?.id).toBe("b");
  });

  it("shows the issue asked for, if the viewer may see it", () => {
    expect(pickListIssue(visible, "a", "b")?.id).toBe("a");
    expect(pickListIssue(visible, "hidden", "b")?.id).toBe("b");
  });

  it("falls back to the newest when the active issue is not visible", () => {
    expect(pickListIssue(visible, undefined, "hidden")?.id).toBe("c");
    expect(pickListIssue([], undefined, "b")).toBeNull();
  });
});
