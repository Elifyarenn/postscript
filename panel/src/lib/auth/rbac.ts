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
 * The illustrator panel (D-288): the çizer mark (D-151) opens the contract
 * page and the documents, nothing else. The mark is not on the session, so
 * the caller reads it from the account.
 */
export function canAccessIllustratorPanel(actor: Actor, isIllustrator: boolean): boolean {
  return isOperational(actor) && isIllustrator;
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
 * The e-mail outbox holds addresses and message subjects: the admins and the
 * main editor see and run it (D-269, D-330). A plain category editor does not.
 */
export function canManageMailQueue(actor: Actor, assignment?: Pick<EditorAssignment, "isMainEditor"> | null): boolean {
  if (canAccessAdminPanel(actor)) return true;
  return canAccessEditorPanel(actor) && assignment?.isMainEditor === true;
}

/**
 * Where the PANEL button on the front page leads (D-086). Built on the same
 * checks the panel guards run, so the button never points at a door that would
 * answer 403; a plain reader, a banned or an unverified account gets none.
 */
export function panelPathFor(actor: Actor): string | null {
  if (canAccessAdminPanel(actor)) return "/admin";
  if (canAccessEditorPanel(actor)) return "/editor";
  if (canAccessWriterPanel(actor)) return "/writer";
  return null;
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

/**
 * The admins are the community's moderators (module 4, D-179): they remove
 * posts, settle reports, open and archive the topic groups and keep the
 * banned word list. Nobody else moderates; there are no group owners (D-093).
 */
export function canModerateCommunity(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

/** Who a duty tag describes; `isMainEditor` only ever counts for an editor. */
export type TagPerson = {
  // A plain string, because some admin lists carry the role column untyped
  role: string;
  isMainEditor: boolean | null;
  writerStatus?: string | null;
  /** The Tasarımcı mark (D-151, D-310); left out where a screen does not carry it. */
  isIllustrator?: boolean | null;
};

/**
 * A person's duty tag. A main editor wears the "Ana editör" tag in place of
 * "Editör" on every screen (D-312); this is display only, the main editor's
 * powers are read from `editor-categories`, never from here.
 */
export function roleBadge(person: TagPerson): string {
  if (person.role === "editor" && person.isMainEditor === true) return "main_editor";
  // A designer without a team role is a designer, not a plain "Kullanıcı" (D-312)
  if (person.role === "user" && person.isIllustrator === true) return "illustrator";
  return person.role;
}

/**
 * The panel's role tags. A hybrid editor holds both duties and is titled
 * "Editor & Yazar" (D-060); a hybrid main editor keeps both tags apart.
 */
export function panelRoleBadges(person: TagPerson): string[] {
  const hybrid = person.role === "editor" && person.writerStatus != null;
  if (!hybrid) return [roleBadge(person)];
  return person.isMainEditor === true ? ["main_editor", "writer"] : ["editor_writer"];
}

/** The badge the community shows beside a staff member's handle (D-179). */
export function communityBadge(person: TagPerson): string | null {
  if (person.role === "admin") return "community_admin";
  // The community carries no Tasarımcı mark: a plain member stays untagged there
  return person.role === "user" ? null : roleBadge(person);
}

/**
 * Temporary areas for one issue (D-306): the admins, and the main editor who
 * hands out the issue's work (D-330). A plain category editor does not.
 */
export function canManageIssueAreaGrants(actor: Actor, assignment?: Pick<EditorAssignment, "isMainEditor"> | null): boolean {
  if (canAccessAdminPanel(actor)) return true;
  return canAccessEditorPanel(actor) && assignment?.isMainEditor === true;
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
 * Someone who may act as an author: an active writer, an editor who also
 * holds an active writer duty (a hybrid), or an admin. This is the gate for
 * writing one's own articles in the writer panel (step 1 of the review chain,
 * D-059). The two admins write without a writer duty (D-304).
 */
export function isActiveWriter(actor: Actor): boolean {
  if (!isOperational(actor)) return false;
  if (hasRole(actor.role, "admin")) return true;
  return actor.writerStatus === "active" && hasRole(actor.role, "writer");
}

/** An admin is given no area: every live area is theirs to write in (D-304). */
export function canWriteInAnyArea(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

/**
 * The two admins founded the magazine, so no author contract is asked of them
 * (D-305). Everyone else who writes still needs one before submitting.
 */
export function needsAuthorAgreement(actor: Pick<Actor, "role">): boolean {
  return actor.role !== "admin";
}

/** An editor's scope over the review chain, read from the database by the caller. */
export type EditorAssignment = {
  /** A main editor reads every category and approves the second review stage. */
  isMainEditor: boolean;
  /** The area names the editor holds in `editor_categories` (slots 1 to 3, D-332). */
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

/* ------------------------------------------------------------------ */
/* Issue windows and topic proposals (D-261)                           */
/* ------------------------------------------------------------------ */

/** Creating issues and setting their topic and delivery windows is the admin's job. */
export function canManageIssues(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

/** Who may propose a topic for an issue: anyone who may write their own articles. */
export function canProposeTopics(actor: Actor): boolean {
  return isActiveWriter(actor);
}

/**
 * Deciding on topic proposals sits with whoever decides the main review
 * stage: a main editor or an admin. A category editor may not.
 */
export function canReviewTopicProposals(actor: Actor, assignment: EditorAssignment): boolean {
  return canReviewMainStage(actor, assignment);
}

/**
 * Reaching a team member by phone or WhatsApp (D-267). The main editor runs
 * the review chain with the writers, so they get the same contact line an
 * admin has; a category editor does not, since the number is personal data
 * shown only where the work needs it.
 */
export function canContactTeam(actor: Actor, assignment: EditorAssignment): boolean {
  return canReviewMainStage(actor, assignment);
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
      // From the main editor's stage this is their revision request to the
      // category editor (D-331), not a submission
      if (article.status === "pending_admin_approval") return canReviewMainStage(actor, assignment);
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

    // `awaiting_rights` is the only status nobody may ask for directly: the
    // service enters it automatically after `accepted` (§7.2), together with
    // opening the rights form. Anything unknown lands here too and is refused.
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Team avatars (D-194)                                                */
/* ------------------------------------------------------------------ */

/**
 * The duty marks an account can carry instead of a staff role: illustrator
 * (D-151), legal adviser (D-238), assistant (D-239). Each one is named rather
 * than collapsed into a single "is marked" flag, so a caller cannot widen the
 * door by conflating two duties.
 */
export type DutyMarks = {
  isIllustrator?: boolean;
  /** The "Yetkili" mark (D-295); it replaced the legal adviser and assistant marks. */
  isAuthorized?: boolean;
};

/**
 * The team is everyone who makes the magazine: writers, editors, admins, and
 * members carrying one of the duty marks. A plain reader has no place on a team
 * page, so the builder stays closed to them.
 */
export function canCreateTeamAvatar(actor: Actor, marks: DutyMarks = {}): boolean {
  const marked = marks.isIllustrator === true || marks.isAuthorized === true;
  return isOperational(actor) && (hasRole(actor.role, "writer") || marked);
}

/** Every team avatar, its PNG and the ZIP are the admin's to see (D-194). */
export function canManageTeamAvatars(actor: Actor): boolean {
  return canAccessAdminPanel(actor);
}

/* ------------------------------------------------------------------ */
/* The manor game preview (D-263)                                      */
/* ------------------------------------------------------------------ */

/**
 * Accounts that may open the closed preview of /oyun besides the admins: the
 * game's writer, who is not staff. This list is the only place the address
 * lives; widening the preview means adding a line here, and opening the game
 * to everyone means retiring this check, not the list.
 */
export const MANOR_GAME_PREVIEW_EMAILS: readonly string[] = ["semrailhan@outlook.com"];

/**
 * The admins and the listed accounts. The address has to be verified, which
 * `isOperational` already demands, so registering someone else's address
 * without its mailbox opens nothing.
 */
export function canPreviewManorGame(actor: Actor & { email: string }): boolean {
  if (canAccessAdminPanel(actor)) return true;
  return isOperational(actor) && MANOR_GAME_PREVIEW_EMAILS.includes(actor.email.trim().toLowerCase());
}
