import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { MAX_ANON_MESSAGE_LENGTH } from "@/lib/anon-box";
import { getAnonComposeState } from "@/services/anon-box";
import { getMemberSettings } from "@/services/social";
import { PanelForm } from "@/components/form";
import { SiteTitle, Sparkle } from "@/components/site-ui";
import { Alert, Textarea } from "@/components/ui";
import { sendAnonMessageAction } from "../actions";

export const metadata = { title: "Anonim kutu" };

/**
 * The magazine's anonymous box, laid out as the "anon box" design (D-113,
 * D-185): what a member writes here goes to the admins, without the member's
 * name, for the "Eğlence & Dedikodu" section.
 */
export default async function AnonBoxPage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";

  const { username } = await getMemberSettings({ ...user });
  if (!username) {
    return (
      <>
        <SiteTitle>Anonim kutu</SiteTitle>
        <Alert tone="info">
          Anonim kutuya yazmak için{" "}
          <Link href="/social/settings" className="underline">
            bir kullanıcı adı seçin
          </Link>
          .
        </Alert>
      </>
    );
  }

  const state = await getAnonComposeState({ ...user });

  return (
    <div className="anon-page">
      <header className="anon-banner">
        <h1 className="fit-line">Anonim kutu</h1>
        <p>Adını söylemeden söylemek istediklerin.</p>
        <Sparkle />
      </header>

      {/* Said before the form, not after it: the sender must know this while writing */}
      <div className="anon-warning" role="note">
        <strong>Adınızı görmeyiz, ama anonim değilsiniz</strong>
        Mesajınız yöneticilere adınız olmadan ulaşır. 5651 sayılı Kanun gereği hesabınızla ve trafik
        kaydıyla birlikte saklanır; yalnızca yetkili mercilerin hukuka uygun talebi üzerine
        paylaşılabilir. Başkalarının adını, özel hayatını veya kişisel bilgilerini yazmayın.
      </div>

      {state.canSend ? (
        <div className="anon-form">
          <PanelForm
            action={sendAnonMessageAction}
            csrfToken={csrfToken}
            submitLabel="Anonim olarak gönder"
            submitClassName="anon-send fit-line"
            submitContent={
              <>
                <Sparkle /> Anonim olarak gönder <ArrowRight aria-hidden />
              </>
            }
          >
            <div className="anon-field">
              <label htmlFor="anonBody" className="sr-only">
                Mesajınız
              </label>
              <Textarea
                id="anonBody"
                name="body"
                required
                maxLength={MAX_ANON_MESSAGE_LENGTH}
                rows={8}
                placeholder="Söylemek istediğini buraya yaz…"
                className="anon-textarea"
              />
              <p className="anon-hint">En çok {MAX_ANON_MESSAGE_LENGTH} karakter.</p>
            </div>
            <p className="anon-quote">Bazı şeyler söylenmek için değil, yazılmak için vardır.</p>
            <div className="anon-divider" aria-hidden>
              <Sparkle />
            </div>
            {/* Publication needs the writer's leave (5846 s. FSEK), so it is asked, not assumed (D-185) */}
            <label className="anon-consent">
              <input type="checkbox" name="publishConsent" required className="size-4 accent-accent" />
              <span>
                Mesajımın Eğlence &amp; Dedikodu bölümünde, adım olmadan, kısaltılarak veya düzenlenerek
                yayımlanabileceğini kabul ediyorum.
              </span>
            </label>
          </PanelForm>
        </div>
      ) : (
        <Alert tone="info">{state.problem}</Alert>
      )}

      {/* The design's closing box, telling what this box is for */}
      <p className="anon-note">
        Anonim kutu, anonim olarak bize gönderebileceğin hikâye, anı, itiraf ve dedikodular içindir.
        Seçtiklerimiz Eğlence &amp; Dedikodu bölümünde adın olmadan yayımlanır ve herkes tarafından
        okunur. +18 ve siyasi içerikler, gerçek kişileri teşhir eden ya da kırıcı yazılar
        yayımlanmaz.{" "}
        <Link href="/kullanim-sartlari" className="underline">
          Kullanım şartları
        </Link>
      </p>
    </div>
  );
}
