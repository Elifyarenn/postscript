import { guardIllustratorPanel } from "@/lib/auth/guard";
import { ILLUSTRATOR_GUIDE } from "@/lib/panel-guides";
import { PanelGuideView } from "@/components/panel-guide";

export const metadata = { title: "Kullanım rehberi" };

export default async function IllustratorGuidePage() {
  await guardIllustratorPanel();
  return <PanelGuideView guide={ILLUSTRATOR_GUIDE} />;
}
