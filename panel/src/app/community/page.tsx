import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { getAccessMode } from "@/services/access-mode";
import { restrictToAccountWhenClosed } from "@/lib/access-mode";
import { navForRole, PanelShell } from "@/components/shell";
import { PageHeader } from "@/components/ui";
import { listChatMessages } from "@/services/community";
import { ChatRoom, type ChatMessage } from "./chat-room";

export const metadata = { title: "Topluluk sohbeti" };

/**
 * The live chat room. The server seeds the first page of messages; the client
 * polls the messages endpoint and appends new ones every few seconds.
 * Banned words are masked on the way in, and the room stays admin-moderated.
 */
export default async function CommunityPage() {
  const context = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";

  // While the site is closed the community waits; only the admin enters (D-049)
  const closed = (await getAccessMode()) === "closed";
  if (closed && restrictToAccountWhenClosed(context.user.role)) redirect("/account");

  const nav = navForRole(context.user.role);
  const messages = await listChatMessages();
  const initial: ChatMessage[] = messages.map((message) => ({
    ...message,
    createdAt: message.createdAt.toISOString(),
  }));

  return (
    <PanelShell user={context.user} area={nav.area} groups={nav.groups}>
      <PageHeader
        title="Topluluk sohbeti"
        description="Herkese açık canlı sohbet. Küfür ve hakaret içeren mesajlar otomatik yıldızlanır; yönetim kaldırabilir."
      />

      <ChatRoom
        csrfToken={csrfToken}
        currentUserId={context.user.id}
        isAdmin={context.user.role === "admin"}
        initialMessages={initial}
      />
    </PanelShell>
  );
}