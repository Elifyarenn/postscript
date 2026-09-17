import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { cn, formatDateTime } from "@/lib/utils";
import { listMagazineAnonBox, type AnonBoxView } from "@/services/anon-box";
import { ActionButton } from "@/components/form";
import { Alert, Card, EmptyState } from "@/components/ui";
import { CommunityAdminHeader } from "../community-admin-header";
import { archiveAnonMessageAction, removeAnonMessageAction } from "../actions";

export const metadata = { title: "Anonim kutu" };

/**
 * The magazine's anonymous box (D-185): what members left for the "Eğlence &
 * Dedikodu" section. The admins read it without the senders' names; the
 * list's shape carries no sender at all.
 */
export default async function AdminAnonBoxPage({
  searchParams,
}: {
  searchParams: Promise<{ arsiv?: string }>;
}) {
  const [{ user }, csrf, params] = await Promise.all([guardPanel("admin"), readCsrfToken(), searchParams]);
  const csrfToken = csrf ?? "";
  const view: AnonBoxView = params.arsiv ? "archive" : "inbox";
  const messages = await listMagazineAnonBox({ ...user }, view);

  const tabClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm",
      active ? "bg-accent text-white" : "border border-line bg-surface text-muted hover:text-ink",
    );

  return (
    <>
      <CommunityAdminHeader
        title="Anonim kutu"
        description="Üyelerin Eğlence & Dedikodu bölümü için adlarını vermeden gönderdikleri hikâye, anı, itiraf ve dedikodular."
      />

      <div className="space-y-6">
        <Alert tone="info" title="Yayımlamadan önce">
          Gönderenler mesajın adları olmadan, kısaltılarak veya düzenlenerek yayımlanmasını kabul etti.
          Gerçek bir kişiyi teşhir eden, özel hayatına giren, +18 ya da siyasi içerikleri yayımlamayın;
          kişiyi tanınır kılan ayrıntıları çıkarın. Gönderenin kimliği bu panelde gösterilmez.
        </Alert>

        <nav className="flex gap-2" aria-label="Anonim kutu görünümü">
          <Link href="/admin/community/anon" className={tabClass(view === "inbox")} aria-current={view === "inbox" ? "page" : undefined}>
            Gelen kutusu
          </Link>
          <Link href="/admin/community/anon?arsiv=1" className={tabClass(view === "archive")} aria-current={view === "archive" ? "page" : undefined}>
            Arşiv
          </Link>
        </nav>

        {messages.length === 0 ? (
          <EmptyState>{view === "inbox" ? "Kutuda yeni mesaj yok." : "Arşivde mesaj yok."}</EmptyState>
        ) : (
          <ul className="space-y-4">
            {messages.map((message) => {
              const fields = { messageId: message.id };
              return (
                <li key={message.id}>
                  <Card className={cn(message.unread && "border-accent/40")}>
                    <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="mr-auto text-muted">
                        {formatDateTime(message.createdAt)}
                        {message.unread && <span className="ml-2 font-semibold text-accent">yeni</span>}
                      </span>
                      {view === "inbox" && (
                        <ActionButton
                          action={archiveAnonMessageAction}
                          csrfToken={csrfToken}
                          label="Arşivle"
                          variant="secondary"
                          fields={fields}
                        />
                      )}
                      <ActionButton
                        action={removeAnonMessageAction}
                        csrfToken={csrfToken}
                        label="Kaldır"
                        variant="danger"
                        fields={fields}
                        confirmMessage="Kurallara aykırı bu mesaj kaldırılsın mı?"
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted">
          Anonim mesajlar yazıldıktan bir yıl sonra kalıcı olarak silinir. Yayımlanan metin yazıda kalır.
        </p>
      </div>
    </>
  );
}
