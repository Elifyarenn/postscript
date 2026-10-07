import { guardPanel } from "@/lib/auth/guard";
import { MailPreviewView } from "@/components/mail-preview-view";

export const metadata = { title: "E-posta önizlemesi" };

// A draft can be sent, and its body dropped, at any moment
export const dynamic = "force-dynamic";

export default async function MailPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await guardPanel("admin");
  const { id } = await params;
  return <MailPreviewView user={{ ...user }} id={id} basePath="/admin/mail" />;
}
