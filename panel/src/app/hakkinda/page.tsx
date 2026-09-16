import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth/session";
import { listPublicStaff, type PublicStaffMember } from "@/services/public";
import { SiteShell } from "@/components/site-shell";
import { SiteBanner } from "@/components/site-ui";

export const metadata = { title: "Hakkında" };

// The design sets "DESIGNER AND ILLUSTRATORS" on three lines; the lines are kept (D-167)
const SECTIONS = [
  { key: "hikayemiz", label: ["Hikâyemiz"] },
  { key: "yazarlar", label: ["Yazarlar"] },
  { key: "editorler", label: ["Editörler"] },
  { key: "tasarim", label: ["Tasarımcılar", "ve", "çizerler"] },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function parseSection(value: string | undefined): SectionKey {
  return SECTIONS.find((section) => section.key === value)?.key ?? "hikayemiz";
}

/** The thin eight-point star drawn under the tabs. */
function TabsStar() {
  return (
    <svg viewBox="0 0 96 120" aria-hidden className="about-tabs-star">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="48" y1="1" x2="48" y2="119" />
        <line x1="1" y1="60" x2="95" y2="60" />
        <line x1="20" y1="32" x2="76" y2="88" />
        <line x1="76" y1="32" x2="20" y2="88" />
      </g>
    </svg>
  );
}

/**
 * A list of writers or editors by their public names (D-135). It scrolls
 * inside the panel once it outgrows it (D-167).
 */
function StaffList({ members, empty }: { members: PublicStaffMember[]; empty: string }) {
  if (members.length === 0) return <p>{empty}</p>;
  return (
    <ul className="about-writers">
      {members.map((member) => (
        <li key={member.href}>
          <Link href={member.href}>{member.name}</Link>
        </li>
      ))}
    </ul>
  );
}

function sectionHref(key: SectionKey): string {
  return key === "hikayemiz" ? "/hakkinda" : `/hakkinda?bolum=${key}`;
}

/**
 * Who we are (D-112), from the "about" design. Public like the legal pages: it
 * needs no session, and the writers and editors it lists are shown by pen name
 * or community handle, never by their real name (D-135).
 */
export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<{ bolum?: string }>;
}) {
  const [context, params] = await Promise.all([getAuthContext(), searchParams]);
  const section = parseSection(params.bolum);
  const staff =
    section === "yazarlar"
      ? await listPublicStaff("writer")
      : section === "editorler"
        ? await listPublicStaff("editor")
        : section === "tasarim"
          ? await listPublicStaff("illustrator")
          : [];
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
              {item.label.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </Link>
          ))}
          <TabsStar />
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
                bulabileceği bir yer.
                <br />
                Şimdi ise büyüyen bir dünya ve siz de bunun bir parçasısınız.
              </p>
              <p>
                Çünkü bazı şeyler
                <br />
                mutlaka yazıya dökülmelidir.
              </p>

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
              <StaffList members={staff} empty="Yazarlarımız çok yakında burada listelenecek." />
              <p className="about-note">
                Yazarlarımız dergide mahlaslarıyla, mahlası olmayanlar topluluk adlarıyla yer alır.
              </p>
            </>
          )}

          {section === "editorler" && (
            <>
              <h2 id="about-heading">Editörler</h2>
              <StaffList members={staff} empty="Editörlerimiz çok yakında burada listelenecek." />
              <p className="about-note">
                Her yazı, kendi alanının editörü tarafından okunur, gerekirse yazarıyla birlikte
                yeniden elden geçirilir ve yayına öyle hazırlanır.
              </p>
              <p>
                Derginin sorumluları ve iletişim bilgileri{" "}
                <Link href="/kunye" className="underline">
                  künye sayfasında
                </Link>
                .
              </p>
            </>
          )}

          {section === "tasarim" && (
            <>
              <h2 id="about-heading">Tasarımcılar ve çizerler</h2>
              <p>Derginin görsel dünyasını Tuanna Demir tasarladı.</p>
              <h3>Çizerler</h3>
              <StaffList members={staff} empty="Çizerlerimiz çok yakında burada listelenecek." />
              <p className="about-note">
                Çizerlerimiz de dergide mahlaslarıyla, mahlası olmayanlar topluluk adlarıyla yer
                alır. Bir çizer aynı zamanda yazar olabilir; ikisi ayrı ayrı sayılır.
              </p>
            </>
          )}
        </section>

        <aside className="about-card" aria-labelledby="about-join">
          <h3 id="about-join">Bize katılmak ister misin?</h3>
          <p>
            Bize katılmak ve hayallerinin peşinde koşan bir yazar, editör ya da çizer/ tasarımcı mı
            olmak istiyorsun? Aramıza katıl!
          </p>
          {/* The writer application lives on the account page (D-037); a visitor signs up first */}
          <Link href={user ? "/account" : "/register"} className="site-button fit-line">
            Aramıza katıl <ArrowRight aria-hidden />
          </Link>
        </aside>

        <aside className="about-card" aria-labelledby="about-writers">
          <h3 id="about-writers">Yazarlar</h3>
          <p>
            Biz; gerçek hikâyelerin gücüne inanan yaratıcılar, yazarlar ve hayalperestlerden oluşan
            bir topluluğuz.
          </p>
          {/* The writers are met and followed in the community (D-135) */}
          <Link href="/social" className="site-button fit-line">
            Tanış <ArrowRight aria-hidden />
          </Link>
        </aside>
      </div>
    </SiteShell>
  );
}
