import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth/session";
import { buildImprint } from "@/lib/legal";
import { SOCIAL_LINKS } from "@/lib/site";
import { getSiteSettings } from "@/services/site-settings";
import { SiteShell } from "@/components/site-shell";
import { SiteBanner } from "@/components/site-ui";

export const metadata = { title: "İletişim" };

// The address comes from the admin-editable site settings, so it is read per request
export const dynamic = "force-dynamic";

/**
 * How to reach the magazine (D-137). The address is the imprint's own, so it
 * is kept in one place (site_settings); removal requests and the statutory
 * details stay on the imprint page, which this page points to. There is no
 * form: a message sent from here would be a new kind of personal data.
 */
export default async function ContactPage() {
  const [settings, context] = await Promise.all([getSiteSettings(), getAuthContext()]);
  const { email } = buildImprint(settings);
  const user = context?.user ?? null;
  const accounts = SOCIAL_LINKS.flatMap((link) => (link.url ? [{ ...link, url: link.url }] : []));

  return (
    <SiteShell user={user} bleed>
      <SiteBanner title="İletişim" subtitle="Bize ulaşın" />

      <div className="contact-page">
        <section className="contact-card" aria-labelledby="contact-mail">
          <h2 id="contact-mail">E-posta</h2>
          <p>Dergiyle ilgili her konuda bize e-postayla yazabilirsiniz.</p>
          {email ? (
            <a href={`mailto:${email}`} className="contact-mail">
              {email}
            </a>
          ) : (
            <p className="contact-muted">E-posta adresimiz çok yakında burada.</p>
          )}
        </section>

        <section className="contact-card" aria-labelledby="contact-writing">
          <h2 id="contact-writing">Yazar olmak</h2>
          <p>
            Dergide yazmak istiyorsan hesabım sayfasından yazar başvurusu yapabilirsin. Başvurular
            editör ve yönetim tarafından değerlendirilir.
          </p>
          {/* The writer application lives on the account page (D-037); a visitor signs up first */}
          <Link href={user ? "/account" : "/register"} className="site-button">
            Aramıza katıl <ArrowRight aria-hidden />
          </Link>
        </section>

        <section className="contact-card" aria-labelledby="contact-legal">
          <h2 id="contact-legal">Başvurular</h2>
          <p>
            Derginin tanıtıcı bilgileri ve içerik kaldırma başvurularının usulü{" "}
            <Link href="/kunye" className="underline">
              künye sayfasındadır
            </Link>
            . Kişisel verilerinize ilişkin başvurular için{" "}
            <Link href="/kvkk" className="underline">
              KVKK aydınlatma metnine
            </Link>{" "}
            bakın.
          </p>
        </section>

        {accounts.length > 0 && (
          <section className="contact-card" aria-labelledby="contact-follow">
            <h2 id="contact-follow">Bizi takip edin</h2>
            <ul className="contact-accounts">
              {accounts.map((link) => (
                <li key={link.key}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </SiteShell>
  );
}
