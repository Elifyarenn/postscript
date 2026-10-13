/** The category editor's two extra days and the last-day reminder window (D-336). */
import { describe, expect, it } from "vitest";
import { editorEditClosesAt, isEditorEditingOpen, isSubmissionLastDay } from "@/lib/issue-periods";

const opensAt = new Date("2026-09-30T07:00:00Z");
const closesAt = new Date("2026-10-14T15:00:00Z");
const windowed = { topicOpensAt: null, topicClosesAt: null, submissionOpensAt: opensAt, submissionClosesAt: closesAt };
const none = { topicOpensAt: null, topicClosesAt: null, submissionOpensAt: null, submissionClosesAt: null };

describe("editor editing deadline", () => {
  it("ends two days after the delivery deadline, inclusive", () => {
    expect(editorEditClosesAt(windowed)?.toISOString()).toBe("2026-10-16T15:00:00.000Z");
    expect(isEditorEditingOpen(windowed, new Date("2026-10-16T15:00:00Z"))).toBe(true);
    expect(isEditorEditingOpen(windowed, new Date("2026-10-16T15:00:01Z"))).toBe(false);
  });

  it("has no limit in an issue without windows", () => {
    expect(editorEditClosesAt(none)).toBeNull();
    expect(isEditorEditingOpen(none, new Date("2030-01-01T00:00:00Z"))).toBe(true);
  });
});

describe("the delivery window's last day", () => {
  it("is the last 24 hours before the deadline", () => {
    expect(isSubmissionLastDay(windowed, new Date("2026-10-13T14:59:59Z"))).toBe(false);
    expect(isSubmissionLastDay(windowed, new Date("2026-10-13T15:00:00Z"))).toBe(true);
    expect(isSubmissionLastDay(windowed, new Date("2026-10-14T15:00:00Z"))).toBe(true);
    expect(isSubmissionLastDay(windowed, new Date("2026-10-14T15:00:01Z"))).toBe(false);
    expect(isSubmissionLastDay(none, new Date("2026-10-14T10:00:00Z"))).toBe(false);
  });
});
