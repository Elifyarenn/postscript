import Link from "next/link";
import { getSiteSettings } from "@/services/site-settings";
import { buildImprint } from "@/lib/legal";
import { LegalPage } from "@/components/legal";

export const metadata = { title: "Kullanım Şartları" };

// The publisher e-mail and the competent court come from admin-editable settings
export const dynamic = "force-dynamic";

/**
 * The terms a reader accepts by using the site (D-084).
 *
 * Written against what the product actually does: reading needs an account,
 * commenting needs a verified address, the chat can be closed by an admin, and
 * moderation masks banned words rather than reviewing posts in advance.
 */
export default async function TermsPage() {
  const imprint = buildImprint(await getSiteSettings());
  const email = imprint.email;
  const city = imprint.jurisdictionCity;

  return (
    <LegalPage title="Kullanım Şartları" current="/kullanim-sartlari">
      <h2>1. Kapsam</h2>

      <p>
        Bu şartlar, Postscript Dergisi&rsquo;nin internet sitesini kullanan herkes için geçerlidir.
        Siteye kayıt olarak veya kayıtlı hesabınızla giriş yaparak bu şartları kabul etmiş
        olursunuz. Derginin tanıtıcı bilgileri ve iletişim adresi{" "}
        <Link href="/iletisim" className="text-accent underline">
          künye sayfasındadır
        </Link>
        .
      </p>

      <p>
        Yazarlar için ayrıca Yazar Sözleşmesi ve Kullanım Ruhsatı Taahhüdü geçerlidir. İki metin
        çeliştiğinde yazarlık ilişkisi bakımından yazar sözleşmesi uygulanır.
      </p>

      <h2>2. Hesap</h2>

      <ul>
        <li>Dergiyi okumak ve topluluk alanlarını kullanmak için üyelik gerekir.</li>
        <li>Kayıt sırasında verdiğiniz bilgilerin doğru olmasından siz sorumlusunuz.</li>
        <li>
          Yorum yazabilmek ve sohbete katılabilmek için e-posta adresinizin doğrulanmış olması
          gerekir.
        </li>
        <li>
          Hesabınızın güvenliğinden siz sorumlusunuz. Şifrenizi paylaşmayın; hesabınızın izinsiz
          kullanıldığını fark ederseniz bize bildirin.
        </li>
        <li>Bir kişi birden fazla hesap açamaz.</li>
        <li>
          On sekiz yaşını doldurmamış kişiler okuyucu olabilir, ancak yazar olamaz; yazarlık için
          yaş şartı aranır.
        </li>
      </ul>

      <h2>3. Topluluk kuralları</h2>

      <p>Yorumlarda ve topluluk sohbetinde şunlar yasaktır:</p>

      <ul>
        <li>Hakaret, tehdit, taciz, nefret söylemi ve ayrımcılık,</li>
        <li>Başkasının kişisel bilgilerini rızası olmadan paylaşmak,</li>
        <li>Başkasının eserini izinsiz kopyalamak veya kaynak göstermeden aktarmak,</li>
        <li>Reklam, spam ve yönlendirme amaçlı bağlantılar,</li>
        <li>Suç işlemeye teşvik eden veya kanunen yasak olan her türlü içerik,</li>
        <li>Başka bir kişi veya kurum adına konuşuyormuş gibi davranmak.</li>
      </ul>

      {/* Matches D-056: the closed chat is not readable either */}
      <p>
        Topluluk sohbeti yöneticiler tarafından kapatılabilir. Kapalıyken sohbet sayfası
        görüntülenmez, geçmiş mesajlar okunamaz ve yeni mesaj gönderilemez.
      </p>

      <h2>4. İçeriğinizden siz sorumlusunuz</h2>

      <p>
        Yazdığınız yorum ve mesajların hukuki sorumluluğu size aittir. Dergi, yer sağlayıcı olarak
        bu içerikleri önceden denetlemez ve denetlemekle yükümlü değildir. Yayımladığınız içeriğin
        üçüncü kişilerin haklarını ihlal etmediğini kabul etmiş sayılırsınız.
      </p>

      <p>
        Yorum ve mesajlarınız, 5651 sayılı Kanun&rsquo;un 5. maddesi gereği trafik kaydıyla birlikte
        saklanır. Trafik kaydı hesabınızı, IP adresinizi, tarayıcı bilginizi ve gönderim zamanını
        içerir ve bir yıl tutulur. Bu kayıtlar yalnızca kanunen yetkili mercilerin hukuka uygun
        talebi üzerine paylaşılır.
      </p>

      <h2>5. Moderasyon</h2>

      <ul>
        <li>
          Bazı kelimeler otomatik olarak maskelenir. Bu bir ön denetim değildir; içeriğin kurallara
          uygunluğunu garanti etmez.
        </li>
        <li>
          Yöneticiler kurallara aykırı bir yorum veya mesajı gerekçe göstermeksizin kaldırabilir.
          Kaldırma işlemi kayıt altına alınır.
        </li>
        <li>
          Kuralların ağır veya tekrarlanan ihlali hâlinde hesabınız askıya alınabilir. Askıya alınan
          hesap giriş yapabilir ancak yorum ve mesaj yazamaz.
        </li>
        <li>
          Bir içeriğin kaldırılmasını talep etmek isterseniz{" "}
          <Link href="/iletisim" className="text-accent underline">
            künye sayfasındaki başvuru usulünü
          </Link>{" "}
          izleyin; başvurular en geç yirmi dört saat içinde cevaplanır.
        </li>
      </ul>

      <h2>6. Dergideki eserler</h2>

      <p>
        Dergide yayımlanan yazıların mali hakları yazarlarında kalır; dergi bu yazıları yazarın
        verdiği basit ruhsata dayanarak yayımlar. Yazıları kişisel okuma dışında çoğaltmak, başka
        bir mecrada yayımlamak veya işlemek için eser sahibinin izni gerekir. Kaynak göstererek
        yapılan usulüne uygun alıntılar 5846 sayılı Kanun&rsquo;un 35. maddesi kapsamında serbesttir.
      </p>

      <p>
        Sitenin kendi tasarımı, adı ve logosu dergiye aittir. Bir yazının geri çekilmesi hâlinde
        yazının adresi açık kalır ve geri çekildiği bilgisi gösterilir.
      </p>

      <h2>7. Hizmetin sunumu</h2>

      <p>
        Dergi ücretsizdir ve kâr amacı gütmez. Sitenin kesintisiz veya hatasız çalışacağı taahhüt
        edilmez; bakım, arıza veya teknik zorunluluk hâlinde hizmet geçici olarak durabilir.
        Yayın sıklığı ve içerik seçimi derginin takdirindedir.
      </p>

      <h2>8. Hesabın sona ermesi</h2>

      <p>
        Hesabınızın silinmesini istediğiniz an talep edebilirsiniz; talep otuz gün sonra
        gerçekleşir ve kişisel verileriniz anonimleştirilir. Kanunen saklanması zorunlu kayıtlar ile
        imzalı sözleşme ve eser onayı kayıtları bu süreden sonra da saklanır. Ayrıntısı{" "}
        <Link href="/kvkk" className="text-accent underline">
          KVKK aydınlatma metnindedir
        </Link>
        .
      </p>

      <h2>9. Kişisel veriler</h2>

      <p>
        Kişisel verilerinizin hangi amaçla, hangi hukuki sebeple işlendiği, nereye aktarıldığı ve ne
        kadar saklandığı{" "}
        <Link href="/kvkk" className="text-accent underline">
          KVKK aydınlatma metninde
        </Link>{" "}
        açıklanmıştır.
      </p>

      <h2>10. Değişiklikler</h2>

      <p>
        Bu şartlar güncellenebilir. Esaslı bir değişiklik yapıldığında panel üzerinden duyurulur.
        Değişiklikten sonra siteyi kullanmaya devam etmeniz yeni şartların kabulü anlamına gelir.
      </p>

      <h2>11. Uygulanacak hukuk ve yetki</h2>

      <p>
        Bu şartlar Türk hukukuna tabidir. Uyuşmazlıklarda{" "}
        {city ? `${city} mahkemeleri ve icra daireleri` : "derginin bulunduğu yer mahkemeleri"}{" "}
        yetkilidir. Tüketici sıfatını haiz kullanıcıların tüketici hakem heyetlerine ve tüketici
        mahkemelerine başvurma hakkı saklıdır.
      </p>

      <h2>12. İletişim</h2>

      <p>
        Sorularınız için{" "}
        {email ? (
          <a className="text-accent underline" href={`mailto:${email}`}>
            {email}
          </a>
        ) : (
          "künye sayfasındaki e-posta adresini"
        )}{" "}
        kullanabilirsiniz.
      </p>
    </LegalPage>
  );
}
