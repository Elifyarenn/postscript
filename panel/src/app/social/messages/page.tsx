import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { normalizeUsername } from "@/lib/username";
import { getMemberSettings, listMutualFollows } from "@/services/social";
import { listConversations } from "@/services/direct-messages";
import { SiteTitle, Sparkle } from "@/components/site-ui";
import { Alert } from "@/components/ui";
import { ConversationColumn } from "@/components/messages";

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
        <SiteTitle>Mesajlar</SiteTitle>
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

  const [conversations, mutuals] = await Promise.all([
    listConversations({ ...user }),
    listMutualFollows({ ...user }),
  ]);
  // Someone already in the conversation list is not offered a second time
  const talking = new Set(conversations.map((conversation) => conversation.other.username));
  const mutualFollows = mutuals.filter((member) => !talking.has(member.username));

  return (
    <div className="dm-layout">
      <ConversationColumn conversations={conversations} mutualFollows={mutualFollows} />

      <section className="dm-chat dm-chat-empty" aria-label="Konuşma">
        <Sparkle />
        <p>Özel mesajlarınızı yalnızca siz ve yazıştığınız üye görür.</p>
        <p>Soldan bir konuşma seçin ya da kullanıcı adıyla yeni bir konuşma açın.</p>
      </section>
    </div>
  );
}
