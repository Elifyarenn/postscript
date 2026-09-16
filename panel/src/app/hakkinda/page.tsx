import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth/session";
import { listPublicStaff, type PublicStaffMember } from "@/services/public";
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

/** A list of writers or editors by their public names (D-135). */
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
              <StaffList members={staff} empty="Yazarlarımız çok yakında burada listelenecek." />
              <p className="mt-6 text-sm text-muted">
                Yazarlarımız dergide mahlaslarıyla, mahlası olmayanlar topluluk adlarıyla yer alır.
              </p>
            </>
          )}

          {section === "editorler" && (
            <>
              <h2 id="about-heading">Editörler</h2>
              <StaffList members={staff} empty="Editörlerimiz çok yakında burada listelenecek." />
              <p>
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
              <h2 id="about-heading">Tasarım ve illüstrasyon</h2>
              <p>Derginin görsel dünyasını Tuanna Demir tasarladı.</p>
              <h3>Çizerler</h3>
              <StaffList members={staff} empty="Çizerlerimiz çok yakında burada listelenecek." />
              <p className="mt-6 text-sm text-muted">
                Çizerlerimiz de dergide mahlaslarıyla, mahlası olmayanlar topluluk adlarıyla yer
                alır. Bir çizer aynı zamanda yazar olabilir; ikisi ayrı ayrı sayılır.
              </p>
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
          {/* The writers are met and followed in the community (D-135) */}
          <Link href="/social" className="site-button">
            Tanış <ArrowRight aria-hidden />
          </Link>
        </aside>
      </div>
    </SiteShell>
  );
}
