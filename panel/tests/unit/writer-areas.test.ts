/**
 * The area selection rules: an unknown area and a full area are both refused,
 * a free area passes (D-052).
 */
import { describe, expect, it } from "vitest";
import {
  AREA_QUOTA,
  writerAreaSelectionIssues,
  type WriterAreaQuota,
} from "@/lib/writer-areas";

function quota(currentCount: number): WriterAreaQuota {
  return {
    name: "Sanat & Edebiyat",
    quota: AREA_QUOTA,
    currentCount,
    full: currentCount >= AREA_QUOTA,
  };
}

describe("writer area selection", () => {
  it("passes an area with room", () => {
    expect(writerAreaSelectionIssues("Sanat & Edebiyat", [quota(2)])).toEqual([]);
  });

  it("refuses an unknown area", () => {
    const issues = writerAreaSelectionIssues("Yok boyle bir alan", [quota(2)]);
    expect(issues).toEqual(["Seçilen alan geçersiz."]);
  });

  it("refuses a full area, naming it", () => {
    const issues = writerAreaSelectionIssues("Sanat & Edebiyat", [quota(AREA_QUOTA)]);
    expect(issues[0]).toContain("kontenjanı dolu");
  });
});
