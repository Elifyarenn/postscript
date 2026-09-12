/**
 * Role model and permission checks.
 *
 * Roles are ordered, so "at least editor" is a numeric comparison. These are
 * pure functions: the caller supplies the actor, which means they can be unit
 * tested without a request, and they are used on the server only. Hiding a menu
 * item in the browser is never a substitute for calling one of these.
 */
import type { ArticleStatus, EditorStatus, Role, WriterStatus } from "@/db/schema";

const RANK: Record<Role, number> = { user: 0, writer: 1, editor: 2, admin: 3 };

export type Actor = {
  id: string;
  role: Role;
  writerStatus: WriterStatus | null;
  /** Null for anyone who is not an editor; `suspended` locks the editor panel. */
  editorStatus: EditorStatus | null;
  emailVerifiedAt: Date | null;
  isBanned: boolean;
};

export function rankOf(role: Role): number {
  return RANK[role];
}

/** True when `role` is at least `minimum` in the ordered role model. */
export function hasRole(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

/** A banned or unverified account can do nothing except manage its own profile. */
export function isOperational(actor: Actor): boolean {
  return !actor.isBanned && actor.emailVerifiedAt !== null;
}

export function canAccessWriterPanel(actor: Actor): boolean {
  return isOperational(actor) && hasRole(actor.role, "writer");
}

/**
 * A writer whose status is not `active` may only see announcements and the
 * agreement page (§3 rule 5). Everything else in /writer is closed.
 */
export function canAccessRestrictedWriterPages(actor: Actor): boolean {
  if (!canAccessWriterPanel(actor)) return false;
  // Editors and admins are above the writer role and are not gated by writer_status
  if (hasRole(actor.role, "editor")) return true;
  return actor.writerStatus === "active";
}

export function canAccessEditorPanel(actor: Actor): boolean {
  // A frozen editor keeps the role but loses the panel; admin is above the
  // editor duty and is never frozen through `editor_status` (D-039).
  return (
    isOperational(actor) &&
    hasRole(actor.role, "editor") &&
    actor.editorStatus !== "suspended"
  );
}

export function canAccessAdminPanel(actor: Actor): boolean {
  return isOperational(actor) && hasRole(actor.role, "admin");
}

/**
 * Contract and approval PDFs are for the writer they belong to and for an
 * admin. An editor never sees them (§11 of the contract specification).
 */
export function canViewContractDocuments(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

export function canManageUsers(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

export function canManageArticles(actor: Actor): boolean {
  return canAccessEditorPanel(actor);
}

export function canManageAgreements(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

/** Writers may read their own article records; editors may read all of them. */
export function canReadArticle(actor: Actor, article: { authorId: string | null }): boolean {
  if (canAccessEditorPanel(actor)) return true;
  if (!canAccessRestrictedWriterPages(actor)) return false;
  return article.authorId === actor.id;
}

/** Only the writer named on a rights grant may sign or decline it. */
export function canSignRightsGrant(actor: Actor, grant: { grantorId: string }): boolean {
  return canAccessRestrictedWriterPages(actor) && grant.grantorId === actor.id;
}

/* ------------------------------------------------------------------ */
/* Writer applications                                                 */
/* ------------------------------------------------------------------ */

/**
 * Only a plain reader applies. Anyone who already holds a staff role has no
 * reason to; their promotion is the admin's job.
 *
 * Deliberately not gated on `isOperational`: an unverified or banned reader
 * must reach the eligibility check, which names the missing prerequisites
 * instead of giving a bare 403.
 */
export function canSubmitApplication(actor: Actor): boolean {
  return actor.role === "user";
}

/** An editor (or above) runs the first review stage of the pipeline. */
export function canReviewApplications(actor: Actor): boolean {
  return canAccessEditorPanel(actor);
}

/** The admin (and only the admin) decides the second stage of the pipeline. */
export function canFinalizeApplications(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

/** Comment and chat moderation is an admin-only duty (module 4). */
export function canModerateCommunity(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

/** The writing areas are managed from the admin panel (D-055). */
export function canManageWriterAreas(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

/* ------------------------------------------------------------------ */
/* The staged editorial chain (D-059)                                  */
/* ------------------------------------------------------------------ */

/** A user whose role is `editor` and whose `writer_status` is set is a hybrid:
 * they hold both duties and may switch between the writer and the editor
 * panel. The product labels them "Editor & Yazar".
 */
export function isHybrid(actor: Actor): boolean {
  return actor.role === "editor" && actor.writerStatus !== null;
}

/**
 * Someone who may act as an author: an active writer, or an editor who also
 * holds an active writer duty (a hybrid). This is the gate for writing one's
 * own articles in the writer panel (step 1 of the review chain, D-059).
 */
export function isActiveWriter(actor: Actor): boolean {
  return isOperational(actor) && actor.writerStatus === "active" && hasRole(actor.role, "writer");
}

/** An editor's scope over the review chain, read from the database by the caller. */
export type EditorAssignment = {
  /** A main editor reads every category and approves the second review stage. */
  isMainEditor: boolean;
  /** The area names the editor holds in `editor_categories` (slots 1 and 2). */
  assignedAreas: readonly string[];
};

/** The bits of an article the permission checks need. */
export type ArticleForReview = {
  status: ArticleStatus;
  authorId: string | null;
  category: string | null;
};

/**
 * Whether the actor may act on the first review stage (`in_review`) of this
 * article: its category editor, a main editor (who may cover an unassigned
 * category), or an admin.
 */
export function canReviewCategoryStage(
  actor: Actor,
  assignment: EditorAssignment,
  article: ArticleForReview,
): boolean {
  if (!canAccessEditorPanel(actor)) return false;
  if (actor.role === "admin") return true;
  if (assignment.isMainEditor) return true;
  return article.category !== null && assignment.assignedAreas.includes(article.category);
}

/**
 * Whether the actor may decide the second review stage
 * (`pending_admin_approval`): a main editor or an admin. A plain category
 * editor has no say over it.
 */
export function canReviewMainStage(actor: Actor, assignment: EditorAssignment): boolean {
  if (!canAccessEditorPanel(actor)) return false;
  return actor.role === "admin" || assignment.isMainEditor;
}

/**
 * The publication flow (`ready_for_publishing` and everything after
 * `accepted`) is the admin's job. Editors review; the admin publishes (D-059).
 */
export function canFinalizePublication(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

/** The author themselves may write, edit and submit their own draft. */
export function canAuthorOwnDraft(actor: Actor, article: ArticleForReview): boolean {
  return (
    canAccessRestrictedWriterPages(actor) &&
    article.authorId !== null &&
    article.authorId === actor.id
  );
}

/** The author may rewrite their draft, or any editor may manage articles. */
function canEditDraft(actor: Actor, article: ArticleForReview): boolean {
  return canAuthorOwnDraft(actor, article) || canManageArticles(actor);
}

/**
 * The single authority on who may trigger a given edge, in addition to the
 * state machine's own legality check. An edge may be legal in the graph but
 * still closed to this actor; returning false here means a 403, not a 409 —
 * the graph is fine, the caller is not allowed to pull that lever.
 */
export function canPerformTransition(
  actor: Actor,
  assignment: EditorAssignment,
  article: ArticleForReview,
  to: ArticleStatus,
): boolean {
  switch (to) {
    // The writer submits their draft or resubmits a revised text; editors can
    // do the same on anyone's draft.
    case "in_review":
      return canEditDraft(actor, article);

    // First review stage: the category editor (or main editor/admin fallback)
    case "pending_admin_approval":
      return canReviewCategoryStage(actor, assignment, article);

    // Second review stage: the main editor hands it to the admin
    case "ready_for_publishing":
      return canReviewMainStage(actor, assignment);

    // Final gate: only the admin accepts an article into the publication flow
    case "accepted":
      return canFinalizePublication(actor);

    // Sending an article back to the author is a review decision; the allowed
    // deciders depend on where the article is in the chain.
    case "revision_requested":
    case "draft": {
      if (article.status === "in_review") return canReviewCategoryStage(actor, assignment, article);
      if (article.status === "pending_admin_approval") return canReviewMainStage(actor, assignment);
      if (article.status === "ready_for_publishing") return canFinalizePublication(actor);
      if (article.status === "revision_requested") return canManageArticles(actor);
      if (article.status === "accepted") return canFinalizePublication(actor);
      return false;
    }

    // The publication flow belongs to the admin alone.
    case "scheduled":
    case "published":
    case "archived":
    case "withdrawn":
      return canFinalizePublication(actor);

    // `awaiting_rights` and `withdrawn` are not reachable by a direct call:
    // the first is auto-entered from `accepted`, and `withdrawn` is terminal.
    default:
      return false;
  }
}
