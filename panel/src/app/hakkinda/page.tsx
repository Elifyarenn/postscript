import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth/session";
import { listPublicAuthors } from "@/services/public";
import { SiteShell } from "@/components/site-shell";
import { SiteBanner, Sparkle } from "@/components/site-ui";

export const metadata = { title: "Hakkında" };

const SECTIONS = [
  { key: "hikayemiz", label: "Hikâyemiz" },
  { key: "yazarlar", label: "Yazarlar" },
  { key: "editorler", label: "Editörler" },
  { key: "tasarim", label: "Tasarım ve illüstrasyon" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function parseSection(value: string | undefined): SectionKey {
  return SECTIONS.find((section) => section.key === value)?.key ?? "hikayemiz";
}

function sectionHref(key: SectionKey): string {
  return key === "hikayemiz" ? "/hakkinda" : `/hakkinda?bolum=${key}`;
}

/**
 * Who we are (D-112), from the "about" design. Public like the legal pages: it
 * needs no session, and the writers it lists are shown by pen name only.
 */
export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<{ bolum?: string }>;
}) {
  const [context, params] = await Promise.all([getAuthContext(), searchParams]);
  const section = parseSection(params.bolum);
  const authors = section === "yazarlar" ? await listPublicAuthors() : [];
  const user = context?.user ?? null;

  return (
    <SiteShell user={user} bleed>
      <SiteBanner title="Hakkında" subtitle="Bizimle ilgili her şey" />

      <div className="about-grid">
        <nav className="about-tabs" aria-label="Hakkında bölümleri">
          {SECTIONS.map((item) => (
            <Link
              key={item.key}
              href={sectionHref(item.key)}
              aria-current={item.key === section ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Sparkle />
        </nav>

        <section className="about-panel" aria-labelledby="about-heading">
          {section === "hikayemiz" && (
            <>
              <h2 id="about-heading">Hikâyemiz</h2>
              <p>
                Postscript, hayalperestler, aşırı düşünenler, maceracılar ve meraklı zihinler için
                oluşturulmuş dijital bir dergi topluluğudur. Burada, vazgeçemediğimiz şeyleri
                topluyoruz: hikâyeler, sanat, müzik, moda, kültür, psikoloji ve bunların arasındaki
                tüm o güzel kaos.
              </p>
              <p>
                Her şey küçük bir fikirle başladı: Kafanızda yaşayan şeylerin nihayet bir yuva
                bulabileceği bir yer. Şimdi ise büyüyen bir dünya ve siz de bunun bir parçasısınız.
              </p>
              <p>Çünkü bazı şeyler mutlaka yazıya dökülmelidir.</p>

              <div className="about-creators">
                <h3>Yaratıcılar</h3>
                <ul>
                  <li>
                    TUANNA DEMİR
                    <br />
                    (yapımcı ve tasarımcı)
                  </li>
                  <li>
                    ELİF YAREN ÇEKİÇ
                    <br />
                    (web sitesi geliştiricisi)
                  </li>
                </ul>
              </div>
            </>
          )}

          {section === "yazarlar" && (
            <>
              <h2 id="about-heading">Yazarlar</h2>
              {authors.length === 0 ? (
                <p>İlk yazılar yayımlandığında yazarlarımız burada listelenecek.</p>
              ) : (
                <ul className="about-writers">
                  {authors.map((author) => (
                    <li key={author.slug}>
                      <Link href={`/magazine/authors/${author.slug}`}>{author.name}</Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-6 text-sm text-muted">
                Yazarlarımız dergide mahlaslarıyla yer alır.
              </p>
            </>
          )}

          {section === "editorler" && (
            <>
              <h2 id="about-heading">Editörler</h2>
              <p>
                Her yazı, kendi alanının editörü tarafından okunur, gerekirse yazarıyla birlikte
                yeniden elden geçirilir ve yayına öyle hazırlanır.
              </p>
              <p>
                Derginin sorumluları ve iletişim bilgileri{" "}
                <Link href="/iletisim" className="underline">
                  künye sayfasında
                </Link>
                .
              </p>
            </>
          )}

          {section === "tasarim" && (
            <>
              <h2 id="about-heading">Tasarım ve illüstrasyon</h2>
              <p>Derginin görsel dünyasını Tuanna Demir tasarladı.</p>
              <p>İllüstratörlerimiz ve çizerlerimiz çok yakında bu sayfada.</p>
            </>
          )}
        </section>

        <aside className="about-card" aria-labelledby="about-join">
          <h3 id="about-join">Bize katılmak ister misin?</h3>
          <p>
            Hayallerinin peşinde koşan bir yazar olmak mı istiyorsun? Hesabım sayfasından yazar
            başvurusu yapabilirsin. Aramıza katıl!
          </p>
          {/* The writer application lives on the account page (D-037); a visitor signs up first */}
          <Link href={user ? "/account" : "/register"} className="site-button">
            Aramıza katıl <ArrowRight aria-hidden />
          </Link>
        </aside>

        <aside className="about-card" aria-labelledby="about-writers">
          <h3 id="about-writers">Yazarlar</h3>
          <p>
            Biz; gerçek hikâyelerin gücüne inanan yaratıcılar, yazarlar ve hayalperestlerden oluşan
            bir topluluğuz.
          </p>
          <Link href={sectionHref("yazarlar")} className="site-button">
            Tanış <ArrowRight aria-hidden />
          </Link>
        </aside>
      </div>
    </SiteShell>
  );
}
