/**
 * Whether this actor may open this issue at all.
 *
 *  - an issue marked `adminOnly` is the admins' working copy: nobody else,
 *    not an editor, not a writer, not a signed-in reader (D-240)
 *  - a published issue is open to everyone, signed in or not (D-257)
 *  - anything else is the editorial panel's preview. An archived issue
 *    counted as open here while the public API and the issue page already
 *    closed it; taking an issue out of "published" now closes the reader,
 *    its pictures and its tests as well (D-317)
 *
 * In its own module so the public picture copies (D-353) can ask the same
 * question without importing the issue page service that calls them.
 */
import type { Issue } from "@/db/schema";
import { canAccessAdminPanel, canAccessEditorPanel, type Actor } from "@/lib/auth/rbac";

export function mayReadIssue(actor: Actor | null, issue: Pick<Issue, "status" | "adminOnly">): boolean {
  if (issue.adminOnly) return actor !== null && canAccessAdminPanel(actor);
  if (issue.status === "published") return true;
  return actor !== null && canAccessEditorPanel(actor);
}
