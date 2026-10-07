import { describe, expect, it } from "vitest";
import { checkCategoryBudget, CATEGORY_WORD_LIMIT } from "@/lib/category-budget";
import { checkTransition, revisionTarget } from "@/lib/article-status";
import { canPerformTransition, type Actor } from "@/lib/auth/rbac";

describe("checkCategoryBudget (D-331)", () => {
  it("allows the total up to 1600 and refuses past it", () => {
    expect(CATEGORY_WORD_LIMIT).toBe(1600);
    expect(checkCategoryBudget({ others: 1000, before: 0, after: 600 })).toEqual({ ok: true, total: 1600, remaining: 0 });
    expect(checkCategoryBudget({ others: 1000, before: 0, after: 601 }).ok).toBe(false);
  });

  it("replaces an edited article's old count instead of adding it", () => {
    expect(checkCategoryBudget({ others: 600, before: 1000, after: 1000 }).ok).toBe(true);
    expect(checkCategoryBudget({ others: 600, before: 1000, after: 1001 }).ok).toBe(false);
  });

  it("lets an over-limit category shrink but not grow", () => {
    expect(checkCategoryBudget({ others: 0, before: 1800, after: 1700 }).ok).toBe(true);
    expect(checkCategoryBudget({ others: 0, before: 1800, after: 1801 }).ok).toBe(false);
  });
});

describe("the revision request to the category editor (D-331)", () => {
  const context = { rightsGrantStatus: null, allMediaLicensed: true };

  it("is a legal edge back from the main editor's stage, with a mandatory note", () => {
    expect(checkTransition("pending_admin_approval", "in_review", context).ok).toBe(false);
    expect(checkTransition("pending_admin_approval", "in_review", { ...context, note: "Neden" }).ok).toBe(true);
  });

  it("names whom each request goes to", () => {
    expect(revisionTarget("pending_admin_approval", "in_review")).toBe("category_editor");
    expect(revisionTarget("pending_admin_approval", "revision_requested")).toBe("author");
    expect(revisionTarget("draft", "in_review")).toBeNull();
  });

  it("is the main editor's or the admin's to pull", () => {
    const editor: Actor = {
      id: "e",
      role: "editor",
      writerStatus: null,
      editorStatus: "active",
      emailVerifiedAt: new Date(),
      isBanned: false,
    };
    const article = { status: "pending_admin_approval" as const, authorId: "w", category: "Sanat" };
    expect(canPerformTransition(editor, { isMainEditor: true, assignedAreas: [] }, article, "in_review")).toBe(true);
    expect(canPerformTransition(editor, { isMainEditor: false, assignedAreas: ["Sanat"] }, article, "in_review")).toBe(false);
    expect(canPerformTransition({ ...editor, role: "admin", editorStatus: null }, { isMainEditor: false, assignedAreas: [] }, article, "in_review")).toBe(true);
  });
});
