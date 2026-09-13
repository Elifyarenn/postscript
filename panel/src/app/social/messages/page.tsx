import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { normalizeUsername } from "@/lib/username";
import { getMemberSettings } from "@/services/social";
import { listConversations } from "@/services/direct-messages";
import { Alert, Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { ConversationList } from "@/components/messages";

export const metadata = { title: "Mesajlar" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const { user } = await requireSession();

  // The "new message" box is a plain GET form: opening a conversation changes nothing
  const { to } = await searchParams;
  const target = to ? normalizeUsername(to) : "";
  if (target) redirect(`/social/messages/${encodeURIComponent(target)}`);

  const { username } = await getMemberSettings({ ...user });
  if (!username) {
    return (
      <>
        <PageHeader title="Mesajlar" />
        <Alert tone="info" title="Önce bir kullanıcı adı seçin">
          Özel mesajlaşmak için bir kullanıcı adı gerekir.{" "}
          <Link href="/social/settings" className="underline">
            Kullanıcı adı seçin
          </Link>
          .
        </Alert>
      </>
    );
  }

  const conversations = await listConversations({ ...user });

  return (
    <>
      <PageHeader
        title="Mesajlar"
        description="Özel mesajlarınızı yalnızca siz ve yazıştığınız üye görür."
      />

      <div className="space-y-6">
        <Card>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Field label="Yeni mesaj" htmlFor="to">
                <Input id="to" name="to" placeholder="@kullaniciadi" required autoComplete="off" />
              </Field>
            </div>
            <Button type="submit" variant="secondary">
              Konuşmayı aç
            </Button>
          </form>
        </Card>

        <Card className="p-0">
          <ConversationList conversations={conversations} />
        </Card>
      </div>
    </>
  );
}
