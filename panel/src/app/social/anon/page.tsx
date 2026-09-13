import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { cn, formatDateTime } from "@/lib/utils";
import { getMemberSettings } from "@/services/social";
import { listAnonInbox } from "@/services/anon-box";
import { ActionButton } from "@/components/form";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { hideAnonMessageAction, muteAnonSenderAction } from "../actions";

export const metadata = { title: "Anonim kutu" };

/** The recipient's box. It never carries the sender, by construction (D-092). */
export default async function AnonInboxPage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const settings = await getMemberSettings({ ...user });

  if (!settings.username) {
    return (
      <>
        <PageHeader title="Anonim kutu" />
        <Alert tone="info" title="Önce bir kullanıcı adı seçin">
          Anonim kutu için bir kullanıcı adı gerekir.{" "}
          <Link href="/social/settings" className="underline">
            Kullanıcı adı seçin
          </Link>
          .
        </Alert>
      </>
    );
  }

  const messages = await listAnonInbox({ ...user });

  return (
    <>
      <PageHeader
        title="Anonim kutu"
        description="Üyelerin size adlarını göstermeden bıraktığı mesajlar."
      />

      <div className="space-y-6">
        {!settings.anonBoxEnabled && (
          <Alert tone="warning" title="Kutunuz kapalı">
            Yeni anonim mesaj gelmez.{" "}
            <Link href="/social/settings" className="underline">
              Topluluk ayarlarından açabilirsiniz
            </Link>
            .
          </Alert>
        )}

        <Alert tone="info">
          Gönderenlerin kimliğini göremezsiniz. İstemediğiniz bir göndereni susturabilirsiniz; kim
          olduğunu siz de öğrenmezsiniz. Kurallara aykırı bir mesajı bildirirseniz göndereni
          yalnızca yöneticiler görür.
        </Alert>

        {messages.length === 0 ? (
          <EmptyState>Kutunuzda mesaj yok.</EmptyState>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {messages.map((message) => {
                const fields = { messageId: message.id };
                return (
                  <li key={message.id} className="py-4">
                    <p className={cn("text-sm break-words whitespace-pre-wrap", message.unread && "font-semibold")}>
                      {message.body}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="mr-2 text-xs text-muted">{formatDateTime(message.createdAt)}</span>
                      <ActionButton
                        action={hideAnonMessageAction}
                        csrfToken={csrfToken}
                        label="Sil"
                        variant="ghost"
                        fields={fields}
                      />
                      <ActionButton
                        action={muteAnonSenderAction}
                        csrfToken={csrfToken}
                        label="Göndereni sustur"
                        variant="ghost"
                        fields={fields}
                        confirmMessage="Bu gönderen size bir daha anonim mesaj gönderemez ve bıraktığı tüm mesajlar kutunuzdan kalkar. Kim olduğunu siz de öğrenmezsiniz. Devam edilsin mi?"
                      />
                      <Link
                        href={`/social/report?type=anon_message&id=${message.id}`}
                        className="rounded-md px-2.5 py-1 text-xs text-muted hover:bg-paper hover:text-danger"
                      >
                        Bildir
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
