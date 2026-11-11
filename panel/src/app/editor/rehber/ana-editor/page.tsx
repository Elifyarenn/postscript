import { forbidden } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { MAIN_EDITOR_GUIDE } from "@/lib/panel-guides";
import { GUIDE_PATHS } from "@/lib/panel-guides/help";
import { PanelGuideView } from "@/components/panel-guide";

export const metadata = { title: "Ana editör rehberi" };

/** The main editor's own guide (D-384); like the main editor's pages, closed to category editors. */
export default async function MainEditorGuidePage() {
  const { user } = await guardPanel("editor");
  if (user.role !== "admin" && !user.isMainEditor) forbidden();
  return (
    <PanelGuideView
      guide={MAIN_EDITOR_GUIDE}
      related={{ href: GUIDE_PATHS.editor, label: "Kategori editörü rehberi" }}
    />
  );
}
