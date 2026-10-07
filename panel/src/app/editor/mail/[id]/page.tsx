import { notFound } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { mayManageMailQueue } from "@/services/mail-queue";
import { MailPreviewView } from "@/components/mail-preview-view";

export const metadata = { title: "E-posta önizlemesi" };

// A draft can be sent, and its body dropped, at any moment
export const dynamic = "force-dynamic";

export default async function EditorMailPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await guardPanel("editor");
  if (!(await mayManageMailQueue({ ...user }))) notFound();
  const { id } = await params;
  return <MailPreviewView user={{ ...user }} id={id} basePath="/editor/mail" />;
}
