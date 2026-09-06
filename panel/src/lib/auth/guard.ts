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
import {
  canAccessAdminPanel,
  canAccessEditorPanel,
  canAccessWriterPanel,
  requiresTwoFactor,
} from "./rbac";
import type { Role } from "@/db/schema";

/**
 * The inner writer pages, which need an active writer with no outstanding
 * mandatory announcement. The lock sends the writer to the page that clears it,
 * rather than showing a dead end.
 */
export async function guardWriterInnerPages(): Promise<AuthContext> {
  const context = await guardPanel("writer");
  const { user } = context;

  // Editors and admins outrank the writer status gate
  if (canAccessEditorPanel(user)) return context;

  if (user.writerStatus !== "active") redirect("/writer/agreement");

  const { pendingAcknowledgements } = await import("@/services/announcements");
  const pending = await pendingAcknowledgements(user);
  if (pending.length > 0) redirect("/writer/announcements");

  return context;
}

/**
 * Any signed-in page outside the panels. A session that still owes a second
 * factor is sent to present it first, whatever the role: an opted-in writer or
 * reader is held to the factor exactly like an editor.
 */
export async function requireSession(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  if (!context.twoFactorSatisfied) redirect("/two-factor");
  return context;
}

/**
 * Guards a panel area. Order matters: identify first, then the second factor,
 * then the role, so a user is never told "forbidden" for a problem they can fix.
 */
export async function guardPanel(minimum: Role): Promise<AuthContext> {
  const context = await requireSession();
  const { user } = context;

  if (user.isBanned) forbidden();

  // Elevated roles finish their second factor before anything else opens
  if (requiresTwoFactor(user.role) && !context.twoFactorSatisfied) {
    redirect(user.totpConfirmedAt ? "/two-factor" : "/two-factor/setup");
  }
  // A writer who turned the factor on voluntarily is held to it as well
  if (user.totpConfirmedAt && !context.twoFactorSatisfied) redirect("/two-factor");

  const allowed =
    minimum === "user" ||
    (minimum === "writer" && canAccessWriterPanel(user)) ||
    (minimum === "editor" && canAccessEditorPanel(user)) ||
    (minimum === "admin" && canAccessAdminPanel(user));

  if (!allowed) forbidden();

  return context;
}
