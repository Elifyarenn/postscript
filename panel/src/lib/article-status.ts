/**
 * Article state machine (§8).
 *
 * This module is pure: it decides whether a transition is legal given the
 * article's surroundings, and knows nothing about the database. The service
 * layer calls it before every status change, so hiding a button in the browser
 * is never what keeps an article from being published.
 */
import type { ArticleStatus, GrantStatus } from "@/db/schema";

/** Every legal edge in the graph. Anything not listed here is a 409. */
const TRANSITIONS: Record<ArticleStatus, readonly ArticleStatus[]> = {
  draft: ["in_review", "archived"],
  // The staged editorial chain (D-059, names per D-066): the writer submits,
  // the category editor approves, the main editor approves, and the admin
  // accepts the article into the publication flow. Each reviewer can also
  // send it back.
  in_review: ["pending_admin_approval", "revision_requested", "draft"],
  pending_admin_approval: ["ready_for_publishing", "revision_requested", "draft"],
  ready_for_publishing: ["accepted", "revision_requested", "draft"],
  revision_requested: ["in_review", "draft"],
  accepted: ["awaiting_rights", "draft"],
  awaiting_rights: ["scheduled", "revision_requested"],
  scheduled: ["published", "awaiting_rights"],
  published: ["archived", "withdrawn"],
  archived: ["published"],
  withdrawn: [], // terminal
};

export type TransitionContext = {
  /** Status of the article's active rights grant, null when none exists. */
  rightsGrantStatus: GrantStatus | null;
  /** False when any attached media row has no license_type (§8, last rule). */
  allMediaLicensed: boolean;
  /** `withdrawn_reason` is mandatory when withdrawing. */
  withdrawnReason?: string | null;
};

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

export function allowedTargets(from: ArticleStatus): readonly ArticleStatus[] {
  return TRANSITIONS[from];
}

export function isKnownTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * The single authority on status changes. Edge legality first, then the
 * business guards that the specification attaches to particular edges.
 */
export function checkTransition(
  from: ArticleStatus,
  to: ArticleStatus,
  context: TransitionContext,
): TransitionCheck {
  if (from === to) {
    return { ok: false, reason: `Makale zaten "${from}" durumunda.` };
  }
  if (!isKnownTransition(from, to)) {
    return { ok: false, reason: `"${from}" durumundan "${to}" durumuna geçilemez.` };
  }

  // Publishing in any form requires a signed rights grant. This is the rule the
  // specification calls out as mandatory server-side.
  if (to === "scheduled" || to === "published") {
    if (context.rightsGrantStatus !== "signed") {
      return {
        ok: false,
        reason: "İmzalanmış hak devri formu olmadan makale yayına alınamaz.",
      };
    }
    if (!context.allMediaLicensed) {
      return {
        ok: false,
        reason: "Makaleye bağlı her görselin lisans bilgisi girilmeden yayına alınamaz.",
      };
    }
  }

  // Going back for revision from awaiting_rights only makes sense after a refusal
  if (from === "awaiting_rights" && to === "revision_requested") {
    if (context.rightsGrantStatus !== "declined") {
      return {
        ok: false,
        reason: "Devir formu reddedilmeden revizyon durumuna dönülemez.",
      };
    }
  }

  if (to === "withdrawn" && !context.withdrawnReason?.trim()) {
    return { ok: false, reason: "Geri çekme gerekçesi zorunludur." };
  }

  return { ok: true };
}

/**
 * `accepted` is not a resting place: acceptance creates the rights form and the
 * article moves on automatically (§7.2).
 */
export function autoTransitionAfter(status: ArticleStatus): ArticleStatus | null {
  return status === "accepted" ? "awaiting_rights" : null;
}

/** Statuses the public API is allowed to serve. */
export function isPubliclyVisible(status: ArticleStatus): boolean {
  return status === "published";
}
