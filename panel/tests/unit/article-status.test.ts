/**
 * The state machine from §8, including the two rules the specification marks as
 * mandatory: no publishing without a signed rights grant, and no publishing
 * with unlicensed media.
 */
import { describe, expect, it } from "vitest";
import { allowedTargets, checkTransition, autoTransitionAfter } from "@/lib/article-status";
import type { ArticleStatus } from "@/db/schema";

const clean = {
  rightsGrantStatus: "signed" as const,
  allMediaLicensed: true,
};

describe("allowed edges", () => {
  it("matches the staged review chain in the specification (D-059)", () => {
    expect(allowedTargets("draft")).toEqual(["in_review", "archived"]);
    expect(allowedTargets("in_review")).toEqual(["category_approved", "revision_requested", "draft"]);
    expect(allowedTargets("category_approved")).toEqual(["admin_review", "revision_requested", "draft"]);
    expect(allowedTargets("admin_review")).toEqual(["accepted", "revision_requested", "draft"]);
    expect(allowedTargets("revision_requested")).toEqual(["in_review", "draft"]);
    expect(allowedTargets("accepted")).toEqual(["awaiting_rights", "draft"]);
    expect(allowedTargets("awaiting_rights")).toEqual(["scheduled", "revision_requested"]);
    expect(allowedTargets("scheduled")).toEqual(["published", "awaiting_rights"]);
    expect(allowedTargets("published")).toEqual(["archived", "withdrawn"]);
    expect(allowedTargets("archived")).toEqual(["published"]);
  });

  it("makes withdrawn terminal", () => {
    expect(allowedTargets("withdrawn")).toEqual([]);

    const targets: ArticleStatus[] = ["draft", "in_review", "published", "archived"];
    for (const target of targets) {
      expect(checkTransition("withdrawn", target, clean).ok).toBe(false);
    }
  });

  it("refuses a transition that is not in the graph", () => {
    expect(checkTransition("draft", "published", clean).ok).toBe(false);
    expect(checkTransition("draft", "scheduled", clean).ok).toBe(false);
    expect(checkTransition("archived", "draft", clean).ok).toBe(false);
  });

  it("refuses a transition to the same status", () => {
    expect(checkTransition("draft", "draft", clean).ok).toBe(false);
  });
});

describe("rights grant guard", () => {
  it("blocks scheduling while the form is still pending", () => {
    const result = checkTransition("awaiting_rights", "scheduled", {
      rightsGrantStatus: "pending",
      allMediaLicensed: true,
    });
    expect(result).toEqual({
      ok: false,
      reason: "İmzalanmış hak devri formu olmadan makale yayına alınamaz.",
    });
  });

  it("blocks scheduling when there is no form at all", () => {
    expect(
      checkTransition("awaiting_rights", "scheduled", {
        rightsGrantStatus: null,
        allMediaLicensed: true,
      }).ok,
    ).toBe(false);
  });

  it("allows scheduling once the form is signed", () => {
    expect(checkTransition("awaiting_rights", "scheduled", clean).ok).toBe(true);
  });

  it("blocks publishing a scheduled article whose grant was revoked", () => {
    expect(
      checkTransition("scheduled", "published", {
        rightsGrantStatus: "revoked",
        allMediaLicensed: true,
      }).ok,
    ).toBe(false);
  });

  it("only allows the return to revision after a refusal", () => {
    expect(
      checkTransition("awaiting_rights", "revision_requested", {
        rightsGrantStatus: "pending",
        allMediaLicensed: true,
      }).ok,
    ).toBe(false);

    expect(
      checkTransition("awaiting_rights", "revision_requested", {
        rightsGrantStatus: "declined",
        allMediaLicensed: true,
      }).ok,
    ).toBe(true);
  });
});

describe("media license guard", () => {
  it("blocks scheduling when a linked image has no license", () => {
    const result = checkTransition("awaiting_rights", "scheduled", {
      rightsGrantStatus: "signed",
      allMediaLicensed: false,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/lisans/i);
  });
});

describe("withdrawal", () => {
  it("requires a reason", () => {
    expect(checkTransition("published", "withdrawn", { ...clean, withdrawnReason: "" }).ok).toBe(
      false,
    );
    expect(checkTransition("published", "withdrawn", { ...clean, withdrawnReason: "   " }).ok).toBe(
      false,
    );
  });

  it("is allowed with a reason", () => {
    expect(
      checkTransition("published", "withdrawn", { ...clean, withdrawnReason: "Telif itirazı" }).ok,
    ).toBe(true);
  });
});

describe("automatic transitions", () => {
  it("moves an accepted article on to awaiting_rights", () => {
    expect(autoTransitionAfter("accepted")).toBe("awaiting_rights");
  });

  it("leaves every other status alone", () => {
    expect(autoTransitionAfter("draft")).toBeNull();
    expect(autoTransitionAfter("published")).toBeNull();
  });
});
