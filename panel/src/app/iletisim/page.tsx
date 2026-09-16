import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { buildImprint } from "@/lib/legal";
import { turnstileSiteKey } from "@/lib/turnstile";
import { getSiteSettings } from "@/services/site-settings";
import { listWriterAreasWithQuota } from "@/services/writer-areas";
import { PanelForm } from "@/components/form";
import { SiteShell } from "@/components/site-shell";
import { SiteBanner } from "@/components/site-ui";
import { TurnstileWidget } from "@/components/turnstile";
import { sendContactMessageAction } from "./actions";

export const metadata = { title: "İletişim" };

// The address and the topics are admin-editable, so the page is read per request
export const dynamic = "force-dynamic";

/** The handle the design gives for Instagram and X (D-168). */
const DESIGN_HANDLE = "postscriptmgzn";

/** The small solid star the design sets on the send button. */
function SendStar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 1.5l3.09 6.6 7.16.86-5.28 4.94 1.4 7.1L12 17.4 5.63 21l1.4-7.1L1.75 8.96l7.16-.86z" fill="currentColor" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 40 34" aria-hidden>
      <rect x="1" y="3" width="38" height="28" rx="4" fill="currentColor" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 40 34" aria-hidden>
      <rect x="4" y="1" width="32" height="32" rx="9" fill="currentColor" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 40 34" aria-hidden>
      <path d="M5 2h8.5l7.4 10 8.3-10H34L23.2 15.1 35 32h-8.5l-8-11.1L9.2 32H4.4l11.7-14z" fill="currentColor" />
    </svg>
  );
}

/**
 * The contact screen of the designs (D-145, D-168): the invitation and the
 * magazine's addresses on the left, the message form on the right, in one band
 * ruled across the paper. The form mails the magazine and stores nothing; the
 * statutory details stay on the imprint page.
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

  return (
    <SiteShell user={user} bleed>
      <SiteBanner title="İletişim" subtitle="Bir sorunuz mu var?" />

      <div className="contact-page">
        <section className="contact-intro" aria-labelledby="contact-intro-title">
          <h2 id="contact-intro-title" className="contact-heading fit-line">
            Bize ulaşın
          </h2>
          <p className="contact-text">
            Bir sorunuz, öneriniz mi var? Ya da sadece merhaba mı demek istiyorsunuz? Buna çok
            seviniriz. Dilediğiniz zaman bizimle iletişime geçebilirsiniz.
          </p>

          <ul className="contact-ways">
            {email && (
              <li>
                <MailIcon />
                <a href={`mailto:${email}`}>{email}</a>
              </li>
            )}
            {/* The design names the accounts; they are not linked until their
                addresses are confirmed, as in the footer (D-116) */}
            <li>
              <InstagramIcon />
              <span>
                <span className="sr-only">Instagram: </span>
                {DESIGN_HANDLE}
              </span>
            </li>
            <li>
              <XIcon />
              <span>
                <span className="sr-only">X: </span>
                {DESIGN_HANDLE}
              </span>
            </li>
          </ul>

          {/* Not in the design, but owed: what the form does with the data (D-145) and
              where the statutory details are (5651 s. m. 3); kept small, under the addresses */}
          <p className="contact-note">
            Formla gönderdiğiniz ad, e-posta ve mesaj yalnızca size cevap vermek için dergi
            e-postasına iletilir, sitede saklanmaz (
            <Link href="/kvkk" className="underline">
              KVKK
            </Link>
            ). Kaldırma başvuruları ve tanıtıcı bilgiler{" "}
            <Link href="/kunye" className="underline">
              künyede
            </Link>
            .
          </p>
        </section>

        <section className="contact-form-card" aria-labelledby="contact-form-title">
          <h2 id="contact-form-title" className="contact-form-title fit-line">
            Bize mesaj gönderin
          </h2>

          <PanelForm
            action={sendContactMessageAction}
            csrfToken={csrfToken}
            submitLabel="Gönder"
            submitClassName="contact-send"
            submitContent={
              <>
                Gönder <SendStar />
              </>
            }
          >
            <>
              {/* The design writes the labels inside the boxes; screen readers still get a label */}
              <label htmlFor="contact-name" className="sr-only">
                Ad
              </label>
              <input
                id="contact-name"
                name="name"
                className="contact-field is-first"
                placeholder="Ad *"
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />

              <label htmlFor="contact-email" className="sr-only">
                E-posta
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                className="contact-field"
                placeholder="E-posta *"
                required
                maxLength={254}
                autoComplete="email"
              />

              <label htmlFor="contact-topic" className="sr-only">
                Konu
              </label>
              <select id="contact-topic" name="topic" className="contact-field" defaultValue="">
                <option value="">Konu seçin…</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.name}>
                    {area.name}
                  </option>
                ))}
                <option value="Diğer">Diğer</option>
              </select>

              <label htmlFor="contact-message" className="sr-only">
                Mesaj
              </label>
              <textarea
                id="contact-message"
                name="message"
                className="contact-field"
                placeholder="Mesaj *"
                required
                minLength={10}
                maxLength={4000}
              />

              {/* Null until both Turnstile keys are set; the form then works without the widget (D-111) */}
              {siteKey && (
                <div className="turnstile-slot">
                  <TurnstileWidget siteKey={siteKey} action="contact" appearance="interaction-only" />
                </div>
              )}
            </>
          </PanelForm>
        </section>

        <div className="contact-strip" aria-hidden />
      </div>
    </SiteShell>
  );
}
