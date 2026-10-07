import { notFound } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { mayManageMailQueue } from "@/services/mail-queue";
import { MailQueueView } from "@/components/mail-queue-view";

export const metadata = { title: "E-posta kuyruğu" };

// "Kuyruğu şimdi işle" sends for up to four minutes inside the request
export const maxDuration = 300;

/** The outbox for the main editor (D-330); a plain category editor gets a 404. */
export default async function EditorMailPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { user } = await guardPanel("editor");
  if (!(await mayManageMailQueue({ ...user }))) notFound();
  return <MailQueueView user={{ ...user }} searchParams={searchParams} basePath="/editor/mail" />;
}
