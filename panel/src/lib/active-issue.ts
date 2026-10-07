/**
 * The active issue (D-330): the one issue new articles go into and the one
 * every article list opens on. Pure, so the choice is unit tested; the
 * service reads the rows and the setting.
 */
import type { Issue } from "@/db/schema";

/** The `site_settings` key an admin sets; not a contract placeholder. */
export const ACTIVE_ISSUE_SETTING = "active_issue_id";

type IssueLike = Pick<Issue, "id" | "number" | "status" | "deletedAt">;

/** A published or archived issue takes no new article and no moved one. */
export function isIssueClosed(issue: Pick<IssueLike, "status">): boolean {
  return issue.status === "published" || issue.status === "archived";
}

/**
 * The issue the admin chose, while it is still open; otherwise the lowest
 * numbered open issue, so publishing issue N moves everyone on to N+1 without
 * anyone having to remember the setting.
 */
export function pickActiveIssue<T extends IssueLike>(issues: readonly T[], chosenId: string | null): T | null {
  const open = issues.filter((issue) => issue.deletedAt === null && !isIssueClosed(issue));
  const chosen = chosenId ? open.find((issue) => issue.id === chosenId) : undefined;
  if (chosen) return chosen;
  return [...open].sort((a, b) => a.number - b.number)[0] ?? null;
}

/**
 * Which issue a list shows (D-330): the one asked for when it exists among
 * those the viewer may see, else the active one, else the newest. There is no
 * "all issues" choice: two issues' articles never share a list.
 */
export function pickListIssue<T extends { id: string; number: number }>(
  visible: readonly T[],
  requestedId: string | null | undefined,
  activeId: string | null,
): T | null {
  return (
    visible.find((issue) => issue.id === requestedId) ??
    visible.find((issue) => issue.id === activeId) ??
    [...visible].sort((a, b) => b.number - a.number)[0] ??
    null
  );
}
