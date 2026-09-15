import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { buildImprint } from "@/lib/legal";
import { SOCIAL_LINKS } from "@/lib/site";
import { turnstileSiteKey } from "@/lib/turnstile";
import { getSiteSettings } from "@/services/site-settings";
import { listWriterAreasWithQuota } from "@/services/writer-areas";
import { PanelForm } from "@/components/form";
import { SiteShell } from "@/components/site-shell";
import { SiteBanner } from "@/components/site-ui";
import { TurnstileWidget } from "@/components/turnstile";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { sendContactMessageAction } from "./actions";

export const metadata = { title: "İletişim" };

// The address and the topics are admin-editable, so the page is read per request
export const dynamic = "force-dynamic";

/**
 * The contact screen of the designs (D-145): the invitation and the magazine's
 * own addresses on the left, the message form on the right. The form mails the
 * magazine and stores nothing; the statutory details stay on the imprint page.
 */
export default async function ContactPage() {
  const [settings, context, areas] = await Promise.all([
    getSiteSettings(),
    getAuthContext(),
    listWriterAreasWithQuota(),
  ]);
  const { email } = buildImprint(settings);
  const user = context?.user ?? null;
  const csrfToken = (await readCsrfToken()) ?? "";
  const siteKey = turnstileSiteKey();
  const accounts = SOCIAL_LINKS.flatMap((link) => (link.url ? [{ ...link, url: link.url }] : []));

  return (
    <SiteShell user={user} bleed>
      <SiteBanner title="İletişim" subtitle="Bir sorunuz mu var?" />

      <div className="contact-page">
        <section className="contact-intro" aria-labelledby="contact-intro-title">
          <h2 id="contact-intro-title" className="contact-heading">
            Bize ulaşın
          </h2>
          <p className="contact-text">
            Bir sorunuz, öneriniz mi var? Ya da sadece merhaba mı demek istiyorsunuz? Buna çok
            seviniriz. Dilediğiniz zaman bizimle iletişime geçebilirsiniz.
          </p>

          {email && (
            <a href={`mailto:${email}`} className="contact-mail">
              {email}
            </a>
          )}

          {accounts.length > 0 && (
            <ul className="contact-accounts">
              {accounts.map((link) => (
                <li key={link.key}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}

          <p className="contact-note">
            İçerik kaldırma başvuruları ve derginin tanıtıcı bilgileri{" "}
            <Link href="/kunye" className="underline">
              künye sayfasında
            </Link>
            ; kişisel verilerinize ilişkin başvurular için{" "}
            <Link href="/kvkk" className="underline">
              KVKK aydınlatma metnine
            </Link>{" "}
            bakın.
          </p>

          {/* The writer application lives on the account page (D-037); a visitor signs up first */}
          <Link href={user ? "/account" : "/register"} className="site-button">
            Aramıza katıl <ArrowRight aria-hidden />
          </Link>
        </section>

        <section className="contact-form-card" aria-labelledby="contact-form-title">
          <h2 id="contact-form-title" className="contact-heading">
            Bize mesaj gönderin
          </h2>

          <PanelForm
            action={sendContactMessageAction}
            csrfToken={csrfToken}
            submitLabel="Gönder"
            submitContent={
              <>
                Gönder <ArrowRight aria-hidden className="size-4" />
              </>
            }
          >
            <>
              <Field label="Ad *" htmlFor="contact-name">
                <Input id="contact-name" name="name" required minLength={2} maxLength={80} autoComplete="name" />
              </Field>

              <Field label="E-posta *" htmlFor="contact-email">
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                />
              </Field>

              <Field label="Konu" htmlFor="contact-subject">
                <Input id="contact-subject" name="subject" maxLength={120} />
              </Field>

              <Field label="Başlık seçin" htmlFor="contact-topic">
                <Select id="contact-topic" name="topic" defaultValue="">
                  <option value="">Bir başlık seçin…</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name}
                    </option>
                  ))}
                  <option value="Diğer">Diğer</option>
                </Select>
              </Field>

              <Field label="Mesaj *" htmlFor="contact-message">
                <Textarea id="contact-message" name="message" required minLength={10} maxLength={4000} rows={6} />
              </Field>

              {/* Null until both Turnstile keys are set; the form then works without the widget (D-111) */}
              {siteKey && <TurnstileWidget siteKey={siteKey} action="contact" />}

              <p className="contact-consent">
                Gönderdiğiniz ad, e-posta adresi ve mesaj yalnızca size cevap verebilmek için
                kullanılır ve dergi posta kutusuna iletilir; sitede saklanmaz.{" "}
                <Link href="/kvkk" className="underline">
                  Ayrıntılar
                </Link>
              </p>
            </>
          </PanelForm>
        </section>
      </div>
    </SiteShell>
  );
}
