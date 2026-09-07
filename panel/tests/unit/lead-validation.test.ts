/**
 * The lead selection rules: exactly one category, which must exist, be active
 * and have room.
 */
import { describe, expect, it } from "vitest";
import { leadSelectionIssues } from "@/services/leads";

type Cat = { id: string; name: string; maxQuota: number; currentCount: number; isActive: boolean };

const open: Cat = { id: "a", name: "BİLİM & TEKNOLOJİ", maxQuota: 3, currentCount: 1, isActive: true };
const full: Cat = { id: "b", name: "MÜZİK", maxQuota: 3, currentCount: 3, isActive: true };
const inactive: Cat = { id: "c", name: "EDEBİYAT", maxQuota: 3, currentCount: 0, isActive: false };

describe("leadSelectionIssues", () => {
  it("accepts a single valid category", () => {
    expect(leadSelectionIssues("a", [open])).toEqual([]);
  });

  it("refuses an empty selection", () => {
    expect(leadSelectionIssues(null, [open]).join(" ")).toMatch(/Bir kategori seçmelisiniz/);
  });

  it("refuses a full category and says so", () => {
    const issues = leadSelectionIssues("b", [full]);
    expect(issues.join(" ")).toMatch(/kontenjanı dolu/i);
  });

  it("refuses an inactive category", () => {
    const issues = leadSelectionIssues("c", [inactive]);
    expect(issues.join(" ")).toMatch(/kapalı/i);
  });

  it("refuses a category id that no longer exists", () => {
    const issues = leadSelectionIssues("gone", [open]);
    expect(issues.join(" ")).toMatch(/artık mevcut değil/);
  });
});