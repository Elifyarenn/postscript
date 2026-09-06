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
  canManageUsers,
  canReadArticle,
  canSignRightsGrant,
  canViewContractDocuments,
  hasRole,
  type Actor,
} from "@/lib/auth/rbac";

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "user-1",
    role: "user",
    writerStatus: null,
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
