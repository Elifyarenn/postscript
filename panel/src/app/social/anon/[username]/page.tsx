import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { MAX_ANON_MESSAGE_LENGTH } from "@/lib/anon-box";
import { getAnonComposeState } from "@/services/anon-box";
import { getMemberSettings } from "@/services/social";
import { PanelForm } from "@/components/form";
import { Alert, Card, Field, PageHeader, Textarea } from "@/components/ui";
import { sendAnonMessageAction } from "../../actions";

export const metadata = { title: "Anonim mesaj" };

export default async function AnonComposePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { username: rawUsername } = await params;

  const { username } = await getMemberSettings({ ...user });
  if (!username) {
    return (
      <>
        <PageHeader title="Anonim mesaj" />
        <Alert tone="info">
          Anonim mesaj göndermek için{" "}
          <Link href="/social/settings" className="underline">
            bir kullanıcı adı seçin
          </Link>
          .
        </Alert>
      </>
    );
  }

  const state = await getAnonComposeState({ ...user }, decodeURIComponent(rawUsername)).catch(
    (error: unknown) => {
      if (isAppError(error) && (error.status === 404 || error.status === 400)) notFound();
      throw error;
    },
  );
  const recipient = state.recipient;

  return (
    <>
      <PageHeader
        title="Anonim mesaj"
        description={`@${recipient.username} kutusuna, adınızı göstermeden.`}
        actions={
          <Link href={`/social/u/${recipient.username}`} className="text-sm text-accent">
            Profile dön
          </Link>
        }
      />

      <Card>
        {/* Said before the form, not after it: the sender must know this while writing */}
        <Alert tone="warning" title="Alıcı adınızı görmez, ama anonim değilsiniz">
          Mesajınız hesabınızla ve 5651 sayılı Kanun gereği trafik kaydıyla birlikte saklanır.
          Kurallara aykırı bir mesaj bildirilirse yöneticiler kimliğinizi görür; yetkili mercilerin
          hukuka uygun talebi üzerine paylaşılabilir.
        </Alert>

        <div className="mt-4">
          {state.canSend ? (
            <PanelForm action={sendAnonMessageAction} csrfToken={csrfToken} submitLabel="Anonim gönder">
              <input type="hidden" name="username" value={recipient.username} />
              <Field label="Mesajınız" htmlFor="anonBody" hint={`En çok ${MAX_ANON_MESSAGE_LENGTH} karakter.`}>
                <Textarea
                  id="anonBody"
                  name="body"
                  required
                  maxLength={MAX_ANON_MESSAGE_LENGTH}
                  rows={4}
                  className="font-sans"
                />
              </Field>
            </PanelForm>
          ) : (
            <Alert tone="info">{state.problem}</Alert>
          )}
        </div>
      </Card>
    </>
  );
}
