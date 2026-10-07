import { guardPanel } from "@/lib/auth/guard";
import { MailQueueView } from "@/components/mail-queue-view";

export const metadata = { title: "E-posta kuyruğu" };

// "Kuyruğu şimdi işle" sends for up to four minutes inside the request
export const maxDuration = 300;

export default async function AdminMailPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { user } = await guardPanel("admin");
  return <MailQueueView user={{ ...user }} searchParams={searchParams} basePath="/admin/mail" />;
}
