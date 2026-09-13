import { getSiteSettings } from "@/services/site-settings";
import { getAuthContext } from "@/lib/auth/session";
import { buildImprint, imprintFields } from "@/lib/legal";
import { LegalPage } from "@/components/legal";
import { Alert } from "@/components/ui";

export const metadata = { title: "Künye ve İletişim" };

// The publisher details are admin-editable, so the page is rendered per request
export const dynamic = "force-dynamic";

/**
 * The notice 5651 s. 3 requires: who runs this site, where they can be reached,
 * and how a removal request is made (D-084).
 *
 * The law wants these facts reachable from the front page under a contact
 * heading, so the homepage nav and footer both link here.
 */
export default async function ContactPage() {
  const [settings, context] = await Promise.all([getSiteSettings(), getAuthContext()]);
  const imprint = buildImprint(settings);
  const email = imprint.email;

  // A blank line is a job for whoever can fix it. Telling every reader that the
  // notice is incomplete only advertises the gap, so the warning is admin-only
  // and the public page simply shows the lines that are filled in (D-085).
  const isAdmin = context?.user.role === "admin";

  // An admin sees the blanks so they know what is left to fill; a reader sees
  // only the lines that carry a fact.
  const allFields = imprintFields(imprint);
  const fields = isAdmin ? allFields : allFields.filter((field) => field.value !== null);

  return (
    <LegalPage title="Künye ve İletişim" current="/iletisim">
      <p>
        Bu sayfa, 5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar
        Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun&rsquo;un 3. maddesi uyarınca
        yayımlanmıştır.
      </p>

      {isAdmin && imprint.missing.length > 0 ? (
        <Alert tone="warning" title="Künye bilgileri eksik">
          Şu alanlar henüz doldurulmadı: {imprint.missing.join(", ")}. Yöneticiler bu bilgileri
          yönetim panelindeki &ldquo;Sistem&rdquo; sayfasından girer.
        </Alert>
      ) : null}

      <h2>Tanıtıcı bilgiler</h2>

      <dl className="my-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
        {fields.map((field) => (
          <div key={field.label} className="contents">
            <dt className="text-muted">{field.label}</dt>
            <dd>{field.value ?? <span className="text-muted">— belirtilmedi —</span>}</dd>
          </div>
        ))}
      </dl>

      <p>
        Postscript Dergisi kâr amacı gütmeyen bir e-dergidir. Ortaklardan her biri ortaklık adına
        tek başına temsile yetkilidir. Dergiye ilişkin her konuda yukarıdaki e-posta adresi
        kullanılabilir.
      </p>

      <h2>Hangi sıfatla sorumluyuz</h2>

      <p>
        Dergide yayımlanan yazılar bakımından <strong>içerik sağlayıcı</strong>, okuyucuların
        yazdığı yorumlar ve topluluk sohbeti mesajları bakımından <strong>yer sağlayıcı</strong>
        konumundayız. Yer sağlayıcı olarak barındırdığımız içeriği denetlemekle yükümlü değiliz;
        hukuka aykırılığı bildirilen içeriği ise aşağıdaki usulle kaldırırız.
      </p>

      <h2>İçerik kaldırma ve itiraz başvuruları</h2>

      <p>
        Dergide yayımlanan bir içerik nedeniyle kişilik haklarının veya özel hayatın gizliliğinin
        ihlal edildiğini düşünen herkes, 5651 sayılı Kanun&rsquo;un 9. ve 9/A maddeleri uyarınca
        doğrudan bize başvurabilir. Başvuru için mahkeme kararı şartı yoktur.
      </p>

      <p>Başvurunuzda şunlar bulunmalıdır:</p>

      <ul>
        <li>Ad soyadınız ve size ulaşabileceğimiz bir e-posta adresi,</li>
        <li>Şikâyet ettiğiniz içeriğin tam adresi (URL),</li>
        <li>İçeriğin hangi hakkınızı nasıl ihlal ettiğine dair kısa açıklama,</li>
        <li>Talebiniz: içeriğin kaldırılması, düzeltilmesi veya cevap hakkı.</li>
      </ul>

      <p>
        Başvurunuzu{" "}
        {email ? (
          <a className="text-accent underline" href={`mailto:${email}`}>
            {email}
          </a>
        ) : (
          <span className="text-muted">künyedeki e-posta adresine</span>
        )}{" "}
        gönderin. Başvuruları <strong>en geç yirmi dört saat içinde</strong> cevaplandırırız.
        Talebi yerinde bulursak içerik aynı süre içinde yayından kaldırılır; kaldırılan bir yazının
        adresi, geri çekildiği bilgisiyle birlikte açık kalır. Talebi yerinde bulmazsak gerekçemizi
        yazılı olarak bildiririz — bu durumda sulh ceza hâkimliğine başvurma hakkınız saklıdır.
      </p>

      <p>
        Yazarlar, kendi yayımlanmış yazılarının kaldırılmasını panel üzerinden de talep edebilir;
        bu talep yazar sözleşmesinin 9. maddesine tabidir.
      </p>

      <h2>Kişisel verilere ilişkin başvurular</h2>

      <p>
        6698 sayılı Kanun kapsamındaki taleplerinizin usulü ayrıca düzenlenmiştir; KVKK aydınlatma
        metninin &ldquo;Başvuru usulü&rdquo; başlığına bakın.
      </p>

      <h2>Barındırma</h2>

      <p>
        Site Vercel Inc. altyapısında yayımlanmakta, veritabanı Neon Inc. tarafından Amerika
        Birleşik Devletleri&rsquo;nde (AWS us-east-2) işletilmektedir. Bu, derginin yer sağlayıcı
        sıfatını ve yukarıdaki başvuru usulünü değiştirmez.
      </p>
    </LegalPage>
  );
}
