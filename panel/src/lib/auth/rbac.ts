/**
 * Role model and permission checks.
 *
 * Roles are ordered, so "at least editor" is a numeric comparison. These are
 * pure functions: the caller supplies the actor, which means they can be unit
 * tested without a request, and they are used on the server only. Hiding a menu
 * item in the browser is never a substitute for calling one of these.
 */
import type { Role, WriterStatus } from "@/db/schema";

const RANK: Record<Role, number> = { user: 0, writer: 1, editor: 2, admin: 3 };

export type Actor = {
  id: string;
  role: Role;
  writerStatus: WriterStatus | null;
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
  return isOperational(actor) && hasRole(actor.role, "editor");
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
