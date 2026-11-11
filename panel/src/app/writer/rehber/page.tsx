import { guardPanel } from "@/lib/auth/guard";
import { WRITER_GUIDE } from "@/lib/panel-guides";
import { PanelGuideView } from "@/components/panel-guide";

export const metadata = { title: "Kullanım rehberi" };

export default async function WriterGuidePage() {
  await guardPanel("writer");
  return <PanelGuideView guide={WRITER_GUIDE} />;
}
