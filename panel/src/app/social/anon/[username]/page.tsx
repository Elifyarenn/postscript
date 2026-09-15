import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { MAX_ANON_MESSAGE_LENGTH } from "@/lib/anon-box";
import { getAnonComposeState } from "@/services/anon-box";
import { getMemberSettings } from "@/services/social";
import { PanelForm } from "@/components/form";
import { SiteTitle, Sparkle } from "@/components/site-ui";
import { Alert, Textarea } from "@/components/ui";
import { sendAnonMessageAction } from "../../actions";

export const metadata = { title: "Anonim mesaj" };

/**
 * Writing into a member's anonymous box, laid out as the "anon box" design
 * (D-113, D-116). The design's note says the words are published in the
 * magazine; this box goes to one member, so the notes here say what really
 * happens.
 */
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
        <SiteTitle>Anonim mesaj</SiteTitle>
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
    <div className="anon-page">
      <header className="anon-banner">
        <h1>Anonim kutu</h1>
        <p>Adını söylemeden söylemek istediklerin.</p>
        <Sparkle />
      </header>

      <p className="anon-recipient">
        @{recipient.username} kutusuna yazıyorsunuz ·{" "}
        <Link href={`/social/u/${recipient.username}`} className="underline">
          Profile dön
        </Link>
      </p>

      {/* Said before the form, not after it: the sender must know this while writing */}
      <div className="anon-warning" role="note">
        <strong>Alıcı adınızı görmez, ama anonim değilsiniz</strong>
        Mesajınız hesabınızla ve 5651 sayılı Kanun gereği trafik kaydıyla birlikte saklanır.
        Kurallara aykırı bir mesaj bildirilirse yöneticiler kimliğinizi görür; yetkili mercilerin
        hukuka uygun talebi üzerine paylaşılabilir.
      </div>

      {state.canSend ? (
        <div className="anon-form">
          <PanelForm
            action={sendAnonMessageAction}
            csrfToken={csrfToken}
            submitLabel="Anonim olarak gönder"
            submitClassName="anon-send"
            submitContent={
              <>
                <Sparkle /> Anonim olarak gönder <ArrowRight aria-hidden />
              </>
            }
          >
            <input type="hidden" name="username" value={recipient.username} />
            <div className="anon-field">
              <label htmlFor="anonBody" className="sr-only">
                Mesajınız
              </label>
              <Textarea
                id="anonBody"
                name="body"
                required
                maxLength={MAX_ANON_MESSAGE_LENGTH}
                rows={6}
                placeholder="Söylemek istediğini buraya yaz…"
                className="anon-textarea"
              />
              <p className="anon-hint">En çok {MAX_ANON_MESSAGE_LENGTH} karakter.</p>
            </div>
            <p className="anon-quote">Bazı şeyler söylenmek için değil, yazılmak için vardır.</p>
            <div className="anon-divider" aria-hidden>
              <Sparkle />
            </div>
          </PanelForm>
        </div>
      ) : (
        <Alert tone="info">{state.problem}</Alert>
      )}

      {/* The design's closing box, telling what this box is for */}
      <p className="anon-note">
        Anonim kutu, @{recipient.username} adlı üyeye adını göstermeden soru, itiraf ya da güzel bir
        söz bırakman içindir. Mesajın yalnızca ona gider, dergide yayımlanmaz. Kırıcı, +18 ya da
        kurallara aykırı mesajlar bildirilebilir.
      </p>

      <p className="text-center text-sm">
        <Link href="/social/anon" className="site-more">
          Kendi kutunuz <ArrowRight aria-hidden />
        </Link>
      </p>
    </div>
  );
}
