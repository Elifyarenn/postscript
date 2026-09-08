import "server-only";

/**
 * Route guards for the panel layouts.
 *
 * These are the page-level counterpart to `requireRole`: no session sends the
 * visitor to the login screen, but an authenticated visitor who simply lacks
 * the role gets a real HTTP 403 rather than a redirect, which is what §13.2
 * asks for.
 */
import { forbidden, redirect } from "next/navigation";
import { getAuthContext, type AuthContext } from "./session";
import { canAccessAdminPanel, canAccessEditorPanel, canAccessWriterPanel } from "./rbac";
import type { Role } from "@/db/schema";

/**
 * The inner writer pages, which need an active writer with no outstanding
 * mandatory announcement. A frozen writer is sent to the dashboard, which
 * explains the lock, rather than being shown a dead end. There is no contract
 * gate anymore (D-050): writers are active from the moment they are approved.
 */
export async function guardWriterInnerPages(): Promise<AuthContext> {
  const context = await guardPanel("writer");
  const { user } = context;

  // Editors and admins outrank the writer status gate
  if (canAccessEditorPanel(user)) return context;

  if (user.writerStatus === "suspended") redirect("/writer");

  const { pendingAcknowledgements } = await import("@/services/announcements");
  const pending = await pendingAcknowledgements(user);
  if (pending.length > 0) redirect("/writer/announcements");

  return context;
}

/**
 * Any signed-in page outside the panels.
 *
 * An unverified address goes no further than the page that explains why: the
 * account exists, but it cannot be used until the link in the e-mail is
 * followed (D-034).
 */
export async function requireSession(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  if (context.user.emailVerifiedAt === null) redirect("/verify-email/pending");
  return context;
}

/**
 * Guards a panel area. Identity first, then the role, so a user is never told
 * "forbidden" for a problem they could fix. An editor or admin who has not
 * set up the mandatory second factor is sent to the account page that offers
 * exactly that (D-048).
 */
export async function guardPanel(minimum: Role): Promise<AuthContext> {
  const context = await requireSession();
  const { user } = context;

  if (user.isBanned) forbidden();

  const allowed =
    minimum === "user" ||
    (minimum === "writer" && canAccessWriterPanel(user)) ||
    (minimum === "editor" && canAccessEditorPanel(user)) ||
    (minimum === "admin" && canAccessAdminPanel(user));

  if (!allowed) forbidden();

  if (minimum === "editor" || minimum === "admin") {
    if (!context.user.totpEnabled) redirect("/account?twoFactor=1");
  }

  return context;
}
