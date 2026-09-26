import type { ReactNode } from "react";
import { NO_INDEX } from "@/lib/seo";
import { guardPanel } from "@/lib/auth/guard";
import { canReviewTopicProposals } from "@/lib/auth/rbac";
import { getEditorAssignment } from "@/services/editor-categories";
import { ADMIN_NAV, editorNav, PanelShell } from "@/components/shell";

// Sign-in, panel and member pages stay out of search (D-252)
export const metadata = { robots: NO_INDEX };

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const { user } = await guardPanel("editor");

  // The editor routes are also the admin's editorial workspace (issues, the
  // work-approval tracker, the full article management). An admin who visits
  // them sees the admin sidebar, not the narrow editor one (D-059).
  const adminView = user.role === "admin";
  const reviewsTopics = !adminView && canReviewTopicProposals(user, await getEditorAssignment(user.id));

  return (
    <PanelShell
      user={user}
      area={adminView ? "yönetim" : "editör paneli"}
      groups={adminView ? ADMIN_NAV : editorNav(reviewsTopics)}
    >
      {children}
    </PanelShell>
  );
}