/**
 * Permission functions (§13.3). The interesting cases are the ones where a
 * higher role must NOT get a lower role's data, and where a writer is gated by
 * writer_status rather than by role.
 */
import { describe, expect, it } from "vitest";
import {
  canAccessAdminPanel,
  canAccessEditorPanel,
  canAccessRestrictedWriterPages,
  canAccessWriterPanel,
  canFinalizePublication,
  canManageUsers,
  canPerformTransition,
  canReadArticle,
  canReviewCategoryStage,
  canReviewMainStage,
  canSignRightsGrant,
  canViewContractDocuments,
  hasRole,
  isActiveWriter,
  isHybrid,
  type Actor,
  type EditorAssignment,
} from "@/lib/auth/rbac";
import type { ArticleStatus } from "@/db/schema";

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "user-1",
    role: "user",
    writerStatus: null,
    editorStatus: null,
    emailVerifiedAt: new Date("2026-01-01"),
    isBanned: false,
    ...overrides,
  };
}

describe("role ordering", () => {
  it("treats roles as inclusive ranks", () => {
    expect(hasRole("admin", "editor")).toBe(true);
    expect(hasRole("editor", "writer")).toBe(true);
    expect(hasRole("writer", "editor")).toBe(false);
    expect(hasRole("user", "writer")).toBe(false);
    expect(hasRole("user", "user")).toBe(true);
  });
});

describe("panel access", () => {
  it("keeps a plain user out of every panel", () => {
    const plain = actor();
    expect(canAccessWriterPanel(plain)).toBe(false);
    expect(canAccessEditorPanel(plain)).toBe(false);
    expect(canAccessAdminPanel(plain)).toBe(false);
  });

  it("keeps an unverified account out even when the role is high enough", () => {
    const unverified = actor({ role: "admin", emailVerifiedAt: null });
    expect(canAccessAdminPanel(unverified)).toBe(false);
  });

  it("keeps a banned account out", () => {
    const banned = actor({ role: "editor", isBanned: true });
    expect(canAccessEditorPanel(banned)).toBe(false);
  });

  it("lets an admin into the editor panel", () => {
    expect(canAccessEditorPanel(actor({ role: "admin" }))).toBe(true);
  });

  it("does not let an editor read contract PDFs or manage users", () => {
    const editor = actor({ role: "editor" });
    // §8: contracts and approval records are for the writer and the admin
    expect(canViewContractDocuments(editor)).toBe(false);
    expect(canManageUsers(editor)).toBe(false);
  });
});

describe("writer_status gate", () => {
  it("opens the panel but locks the inner pages while the agreement is pending", () => {
    const pending = actor({ role: "writer", writerStatus: "pending_agreement" });
    expect(canAccessWriterPanel(pending)).toBe(true);
    expect(canAccessRestrictedWriterPages(pending)).toBe(false);
  });

  it("opens everything once the writer is active", () => {
    const active = actor({ role: "writer", writerStatus: "active" });
    expect(canAccessRestrictedWriterPages(active)).toBe(true);
  });

  it("closes the inner pages again when the writer is suspended", () => {
    const suspended = actor({ role: "writer", writerStatus: "suspended" });
    expect(canAccessRestrictedWriterPages(suspended)).toBe(false);
  });

  it("does not gate editors on writer_status", () => {
    const editor = actor({ role: "editor", writerStatus: null });
    expect(canAccessRestrictedWriterPages(editor)).toBe(true);
  });
});

describe("editor_status gate", () => {
  it("locks the editor panel while the duty is frozen", () => {
    const frozen = actor({ role: "editor", editorStatus: "suspended" });
    expect(canAccessEditorPanel(frozen)).toBe(false);
    // The role itself is intact: the writer panel of a frozen editor still works
    expect(canAccessWriterPanel(frozen)).toBe(true);
  });

  it("reopens the panel once the duty is active", () => {
    const active = actor({ role: "editor", editorStatus: "active" });
    expect(canAccessEditorPanel(active)).toBe(true);
  });

  it("never freezes an admin through editor_status", () => {
    const admin = actor({ role: "admin", editorStatus: null });
    expect(canAccessEditorPanel(admin)).toBe(true);
    expect(canAccessAdminPanel(admin)).toBe(true);
  });
});

describe("article visibility", () => {
  const article = { authorId: "user-1" };

  it("lets the author read their own article", () => {
    const author = actor({ id: "user-1", role: "writer", writerStatus: "active" });
    expect(canReadArticle(author, article)).toBe(true);
  });

  it("hides it from an unrelated writer", () => {
    const stranger = actor({ id: "user-9", role: "writer", writerStatus: "active" });
    expect(canReadArticle(stranger, article)).toBe(false);
  });

  it("shows every article to an editor", () => {
    expect(canReadArticle(actor({ id: "user-9", role: "editor" }), article)).toBe(true);
  });
});

describe("rights grant signing", () => {
  it("only lets the named writer sign", () => {
    const grantor = actor({ id: "user-1", role: "writer", writerStatus: "active" });
    const other = actor({ id: "user-2", role: "writer", writerStatus: "active" });

    expect(canSignRightsGrant(grantor, { grantorId: "user-1" })).toBe(true);
    expect(canSignRightsGrant(other, { grantorId: "user-1" })).toBe(false);
  });

  it("does not let an admin sign on a writer's behalf", () => {
    const admin = actor({ id: "admin-1", role: "admin" });
    expect(canSignRightsGrant(admin, { grantorId: "user-1" })).toBe(false);
  });
});

describe("the hybrid role (D-060)", () => {
  it("recognises an editor with a writer duty as hybrid", () => {
    expect(isHybrid(actor({ role: "editor", writerStatus: "active" }))).toBe(true);
  });

  it("does not call a plain editor or writer hybrid", () => {
    expect(isHybrid(actor({ role: "editor", writerStatus: null }))).toBe(false);
    expect(isHybrid(actor({ role: "writer", writerStatus: "active" }))).toBe(false);
  });

  it("treats an active writer (or hybrid) as an author", () => {
    expect(isActiveWriter(actor({ role: "writer", writerStatus: "active" }))).toBe(true);
    expect(isActiveWriter(actor({ role: "editor", writerStatus: "active" }))).toBe(true);
    expect(isActiveWriter(actor({ role: "writer", writerStatus: "pending_agreement" }))).toBe(false);
    expect(isActiveWriter(actor({ role: "writer", writerStatus: null }))).toBe(false);
  });
});

describe("the staged review chain (D-059)", () => {
  const noAssignment: EditorAssignment = { isMainEditor: false, assignedAreas: [] };
  const artEditor: EditorAssignment = { isMainEditor: false, assignedAreas: ["Sanat"] };
  const mainEditor: EditorAssignment = { isMainEditor: true, assignedAreas: [] };

  it("lets a category editor review articles of their own areas only", () => {
    const editor = actor({ role: "editor" });
    expect(canReviewCategoryStage(editor, artEditor, { status: "in_review", authorId: null, category: "Sanat" })).toBe(true);
    expect(canReviewCategoryStage(editor, artEditor, { status: "in_review", authorId: null, category: "Bilim" })).toBe(false);
    expect(canReviewCategoryStage(editor, noAssignment, { status: "in_review", authorId: null, category: "Sanat" })).toBe(false);
  });

  it("lets a main editor and an admin cover any category", () => {
    const editor = actor({ role: "editor" });
    const admin = actor({ role: "admin" });
    expect(canReviewCategoryStage(editor, mainEditor, { status: "in_review", authorId: null, category: "Sanat" })).toBe(true);
    expect(canReviewCategoryStage(admin, noAssignment, { status: "in_review", authorId: null, category: null })).toBe(true);
  });

  it("reserves the main stage and the publication flow for main editors and admins", () => {
    const editor = actor({ role: "editor" });
    const admin = actor({ role: "admin" });
    expect(canReviewMainStage(editor, artEditor)).toBe(false);
    expect(canReviewMainStage(editor, mainEditor)).toBe(true);
    expect(canReviewMainStage(admin, noAssignment)).toBe(true);
    expect(canFinalizePublication(editor)).toBe(false);
    expect(canFinalizePublication(admin)).toBe(true);
  });

  const article = (status: ArticleStatus, overrides: Partial<{ category: string | null; authorId: string | null }> = {}) => ({
    status,
    category: overrides.category ?? "Sanat",
    authorId: overrides.authorId ?? "writer-1",
  });

  it("lets the author submit their own draft and resubmit a revision", () => {
    const author = actor({ id: "writer-1", role: "writer", writerStatus: "active" });
    expect(canPerformTransition(author, noAssignment, article("draft"), "in_review")).toBe(true);
    expect(canPerformTransition(author, noAssignment, article("revision_requested"), "in_review")).toBe(true);
    // …but not someone else's draft, and not an approval
    const stranger = actor({ id: "writer-2", role: "writer", writerStatus: "active" });
    expect(canPerformTransition(stranger, noAssignment, article("draft"), "in_review")).toBe(false);
    expect(canPerformTransition(author, noAssignment, article("draft"), "category_approved")).toBe(false);
  });

  it("walks the chain exactly: category editor, then main editor, then admin", () => {
    const editor = actor({ role: "editor" });
    const admin = actor({ role: "admin" });

    // Stage 2: only the category editor (or main/admin) approves
    expect(canPerformTransition(editor, artEditor, article("in_review"), "category_approved")).toBe(true);
    expect(canPerformTransition(editor, noAssignment, article("in_review"), "category_approved")).toBe(false);

    // Stage 3: the main editor hands it to the admin
    expect(canPerformTransition(editor, artEditor, article("category_approved"), "admin_review")).toBe(false);
    expect(canPerformTransition(editor, mainEditor, article("category_approved"), "admin_review")).toBe(true);

    // Stage 4: only the admin accepts it into the publication flow
    expect(canPerformTransition(admin, noAssignment, article("admin_review"), "accepted")).toBe(true);
    expect(canPerformTransition(editor, mainEditor, article("admin_review"), "accepted")).toBe(false);

    // Publication is the admin's alone
    expect(canPerformTransition(editor, mainEditor, article("awaiting_rights"), "scheduled")).toBe(false);
    expect(canPerformTransition(admin, noAssignment, article("awaiting_rights"), "scheduled")).toBe(true);
    expect(canPerformTransition(admin, noAssignment, article("published"), "withdrawn")).toBe(true);
  });

  it("lets a reviewer send an article back for revision at their own stage", () => {
    const editor = actor({ role: "editor" });
    expect(canPerformTransition(editor, artEditor, article("in_review"), "revision_requested")).toBe(true);
    expect(canPerformTransition(editor, mainEditor, article("category_approved"), "revision_requested")).toBe(true);
    expect(canPerformTransition(editor, artEditor, article("category_approved"), "revision_requested")).toBe(false);
    expect(canPerformTransition(editor, mainEditor, article("admin_review"), "revision_requested")).toBe(false);
    expect(canPerformTransition(actor({ role: "admin" }), noAssignment, article("admin_review"), "revision_requested")).toBe(true);
  });
});
