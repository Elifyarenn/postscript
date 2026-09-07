/**
 * The lead selection rules: at most three categories, only active ones, and
 * no full categories.
 */
import { describe, expect, it } from "vitest";
import { leadSelectionIssues, MAX_LEAD_CATEGORIES } from "@/services/leads";

type Cat = { id: string; name: string; maxQuota: number; currentCount: number; isActive: boolean };

const open: Cat = { id: "a", name: "BİLİM & TEKNOLOJİ", maxQuota: 3, currentCount: 1, isActive: true };
const full: Cat = { id: "b", name: "MÜZİK", maxQuota: 3, currentCount: 3, isActive: true };
const inactive: Cat = { id: "c", name: "EDEBİYAT", maxQuota: 3, currentCount: 0, isActive: false };

describe("leadSelectionIssues", () => {
  const other: Cat = { ...open, id: "d", name: "EDEBİYAT" };

  it("accepts a valid selection of one to three categories", () => {
    expect(leadSelectionIssues(["a"], [open])).toEqual([]);
    expect(leadSelectionIssues(["a", "d", "e"], [open, other, { ...open, id: "e" }])).toHaveLength(0);
  });

  it("refuses an empty selection", () => {
    expect(leadSelectionIssues([], [open]).join(" ")).toMatch(/En az bir kategori/);
  });

  it(`refuses more than ${MAX_LEAD_CATEGORIES} categories`, () => {
    const issues = leadSelectionIssues(["1", "2", "3", "4"], [open, full, inactive, open]);
    expect(issues.join(" ")).toMatch(/En fazla 3 kategori/);
  });

  it("refuses a full category and says so", () => {
    const issues = leadSelectionIssues(["b"], [full]);
    expect(issues.join(" ")).toMatch(/kontenjanı dolu/i);
  });

  it("refuses an inactive category", () => {
    const issues = leadSelectionIssues(["c"], [inactive]);
    expect(issues.join(" ")).toMatch(/kapalı/i);
  });

  it("refuses a category id that no longer exists", () => {
    const issues = leadSelectionIssues(["gone"], [open]);
    expect(issues.join(" ")).toMatch(/artık mevcut değil/);
  });
});