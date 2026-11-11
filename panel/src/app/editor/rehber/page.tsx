import { guardPanel } from "@/lib/auth/guard";
import { EDITOR_GUIDE } from "@/lib/panel-guides";
import { GUIDE_PATHS } from "@/lib/panel-guides/help";
import { PanelGuideView } from "@/components/panel-guide";

export const metadata = { title: "Kategori editörü rehberi" };

export default async function EditorGuidePage() {
  const { user } = await guardPanel("editor");
  // The main editor and the admin also have the main editor's guide to hand (D-384)
  const related =
    user.role === "admin" || user.isMainEditor
      ? { href: GUIDE_PATHS.mainEditor, label: "Ana editör rehberi" }
      : undefined;
  return <PanelGuideView guide={EDITOR_GUIDE} related={related} />;
}
