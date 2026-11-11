import { guardPanel } from "@/lib/auth/guard";
import { ADMIN_GUIDE } from "@/lib/panel-guides";
import { PanelGuideView } from "@/components/panel-guide";

export const metadata = { title: "Kullanım rehberi" };

export default async function AdminGuidePage() {
  await guardPanel("admin");
  return <PanelGuideView guide={ADMIN_GUIDE} />;
}
