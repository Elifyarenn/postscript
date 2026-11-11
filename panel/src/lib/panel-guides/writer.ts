import { ARTICLE_JOURNEY, ISSUE_WINDOWS, WORD_BUDGET } from "./shared";
import { SIGNING_SECTION } from "./signing";
import type { PanelGuide } from "./types";

/** The writer panel, from becoming a writer to a published article. */
export const WRITER_GUIDE: PanelGuide = {
  title: "Yazar paneli kullanım rehberi",
  intro:
    "Konu belirlemekten yazınızın yayımlanmasına kadar yazar panelinin her sayfası: ne gösterir, hangi düğme ne yapar, hangi süre ve sınırlara dikkat etmelisiniz.",
  sections: [
    {
      id: "baslarken",
      title: "Başlarken: kısa yol haritası",
      blocks: [
        {
          kind: "flow",
          steps: ["Duyuruları onayla", "Sözleşmeyi imzala, yükle", "Konunu gönder", "Yazını yaz", "İncelemeye gönder", "Yayın"],
          caption: "Yazar olarak bir sayıya katılmanın yolu.",
        },
        {
          kind: "steps",
          items: [
            "**Duyurular**ı okuyun; onay isteyen duyuru varsa onaylayın.",
            "**Sözleşmem** sayfasından yazar sözleşmesini imzalayıp yükleyin; yönetici doğrulayınca yazı gönderebilirsiniz.",
            "**Profil ve güvenlik** sayfasında mahlasınızı ve biyografinizi girin.",
            "Konu belirleme dönemi açılınca **Sayılar ve konular**dan konunuzu gönderin.",
            "Konunuz kabul edilince yazınızı yazın ve yazı kabul döneminde **İncelemeye gönder**e basın.",
            "Yazınız editörlerden geçerken durumunu **Yazılarım**dan izleyin; revizyon istenirse düzeltip yeniden gönderin.",
          ],
        },
        {
          kind: "note",
          text: "Onaylanmamış zorunlu bir duyuru varsa ya da yazarlığınız askıdaysa menüde **Sayılar ve konular**, **Eser Onayları** ve **Yazılarım** soluklaşır ve açılmaz. Duyurular, Sözleşmem ve bu rehber her zaman açıktır. Her sayfanın üst çubuğundaki **Bu sayfanın rehberi** düğmesi o sayfayı anlatan bölümü açar.",
        },
      ],
    },
    {
      id: "genel-bakis",
      title: "Genel bakış",
      href: "/writer",
      blocks: [
        {
          kind: "p",
          text: "Sizden beklenen işlerin özeti. Üstte varsa uyarılar çıkar: sayfalarınızın kilitli olduğu, mahlasınızın olmadığı (mahlas yoksa yazı ad soyadınızla yayımlanır) ya da onay bekleyen duyuru olduğu.",
        },
        {
          kind: "list",
          items: [
            "**Sayı takvimi:** süreci devam eden her sayı için hangi aşamada olduğunuzu tek cümleyle söyler (örneğin \"Bu sayı için konunuzu belirleyin.\", \"Editör değerlendirmesi bekleniyor.\", \"Konu kabul edildi — yazmaya başlayabilirsin.\"). Yanındaki **Konu Belirle** ya da **Ayrıntılar** bağlantısı ilgili sayfaya götürür. Saatler Türkiye saatidir.",
            "**Sözleşme:** sözleşmenizin doğrulanıp doğrulanmadığı.",
            "**Bekleyen Eser Onayları:** aktif sayıda onayınızı bekleyen yazılar.",
            "**Teslim takvimi:** aktif sayıdaki yazılarınız; kelime sayısı, teslim tarihi ve durumuyla.",
          ],
        },
        {
          kind: "note",
          text: "Konu belirleme ve yazı kabul dönemleri açıldığında e-posta alırsınız. Teslimin bitmesine 24 saat kala, konusu kabul edilmiş ama henüz gönderilmemiş yazınız varsa hatırlatma e-postası gelir.",
        },
      ],
    },
    {
      id: "duyurular",
      title: "Duyurular",
      href: "/writer/announcements",
      blocks: [
        {
          kind: "p",
          text: "Yönetimin yazarlara duyuruları. Sayfayı açmak hepsini okundu sayar; onay bekleyenler en üsttedir. Önem derecesi (Bilgilendirme / Önemli / Kritik) rozetle gösterilir.",
        },
        {
          kind: "p",
          text: "Zorunlu onaylı bir duyuruyu onaylamadan diğer yazar sayfalarınız açılmaz. Duyuruyu okuyup **Okudum, onaylıyorum**a basın; onay tarihi duyurunun altında görünür.",
        },
        {
          kind: "compare",
          items: [
            { title: "Bilgilendirme duyurusu", tone: "neutral", points: ["Okumanız yeter", "Sayfayı açınca okundu sayılır"] },
            {
              title: "Onay isteyen duyuru",
              tone: "warn",
              points: ["Okudum, onaylıyorum düğmesine basmalısınız", "Onaylanana kadar diğer sayfalar kapalı", "Kritik duyurular her zaman onay ister"],
            },
          ],
        },
      ],
    },
    {
      id: "konular",
      title: "Sayılar ve konular",
      href: "/writer/topics",
      blocks: [
        {
          kind: "p",
          text: "Her sayı için önce konunuzu belirlersiniz; ana editör kabul edince yazınızı yazar ve yazı kabul döneminde teslim edersiniz. Her sayının **Konu belirleme**, **Yazı kabul** ve **Planlanan yayın** tarihleri sayfada yazar; kapanış dakikası da dönemin içindedir.",
        },
        ISSUE_WINDOWS,
        {
          kind: "steps",
          items: [
            "Konu belirleme dönemi açıkken sayının altındaki **Konu Belirle** formunu doldurun.",
            "**Konu başlığı** (3–200 karakter) ve **Kısa açıklama** (10–2000 karakter) zorunludur.",
            "İki alanınız varsa **Alan**ı seçin; tek alanınız varsa seçmek isteğe bağlıdır.",
            "**Konuyu gönder**e basın. Karar size panel bildirimi ve e-postayla gelir.",
          ],
        },
        {
          kind: "compare",
          items: [
            { title: "Kabul edildi", tone: "ok", points: ["Yazıya başla düğmesi çıkar", "Yazı bu konuya bağlanır"] },
            { title: "Değişiklik istendi", tone: "neutral", points: ["Editörün notunu okuyun", "Düzeltip yeniden gönderin"] },
            { title: "Reddedildi", tone: "warn", points: ["Konu bu sayı için kapandı"] },
          ],
        },
        {
          kind: "list",
          items: [
            "Her sayıda alanınız başına bir konu önerebilirsiniz. İkinci alanınız ya da o sayı için verilmiş geçici bir alanınız varsa onun için ayrı bir form çıkar.",
            "**Değişiklik istendi:** editörün notunu okuyun, **Konuyu düzenle ve yeniden gönder** formunda düzeltip **Yeniden gönder**e basın. Yazı kabul dönemi kapanana kadar yeniden gönderebilirsiniz.",
            "**Kabul edildi:** **Yazıya başla** düğmesi yazınızı bu konuya bağlı olarak açar.",
            "**Reddedildi:** konu bu sayı için kabul edilmedi.",
            "**Konu geçmişi** her adımı (gönderildi, değişiklik istendi, kabul edildi…) tarihleriyle gösterir.",
          ],
        },
      ],
    },
    {
      id: "yazilarim",
      title: "Yazılarım",
      href: "/writer/articles",
      blocks: [
        {
          kind: "p",
          text: "Seçili sayıdaki yazılarınız ve toplam kelime sayınız. Her satırda sayı, kategori, kelime, teslim ve yayın tarihleri ile durum yer alır. Taslak ve revizyondaki yazılar için **Düzenle**, diğerleri için **Sürümler ve notlar** bağlantısı çıkar; editör notları satırın altında görünür.",
        },
      ],
    },
    {
      id: "yeni-yazi",
      title: "Yeni yazı",
      href: "/writer/articles/new",
      blocks: [
        {
          kind: "p",
          text: "Sağ üstteki **Yeni yazı** düğmesiyle ya da konu sayfasındaki **Yazıya başla** ile açılır. Yazı aktif sayıya bağlanır ve sonradan başka sayıya taşınmaz.",
        },
        {
          kind: "list",
          items: [
            "**Konu** (zorunlu): kabul edilmiş ve henüz yazısı olmayan konularınız. Kabul edilmiş konunuz yoksa \"konusuz\" seçeneğiyle de yazabilirsiniz; bu durumda ana editöre bildirim gider. Bir konuya yalnızca bir yazı bağlanır.",
            "**Başlık** 3–200 karakter. **Slug** boş bırakılırsa başlıktan üretilir.",
            "**Özet** en çok 600 karakter.",
            "**Kategori** (zorunlu): yalnızca size tanımlı alanlar; yazı o alanın editörüne düşer.",
            "**Gövde (markdown):** canlı kelime sayacı vardır. 500 kelimeyi aşınca uyarı çıkar, bu yalnızca öneridir.",
            "**Kaynakça** (isteğe bağlı): her kaynağı \"- \" ile başlayan ayrı bir satıra yazın. Kelime sayısına dahil değildir.",
          ],
        },
        {
          kind: "note",
          text: "Bağlayıcı sınır: bir kategoride bir sayıya giren bütün yazıların toplamı 1.600 kelimeyi geçemez. Formdaki satır kategori toplamını ve kalan hakkı gösterir; sınırı aşan kayıt reddedilir. Metni kısaltmak her zaman serbesttir.",
        },
        WORD_BUDGET,
        {
          kind: "p",
          text: "Word'den yapıştırdığınız metin paragraflara kendiliğinden bölünür; bölünmezse **Satır sonlarını paragrafa çevir**e basın. **Taslak olarak kaydet** yazıyı kaydedip yazı sayfasını açar.",
        },
      ],
    },
    {
      id: "gonderme",
      title: "Yazıyı düzenlemek ve incelemeye göndermek",
      href: "/writer/articles",
      pages: ["/writer/articles/"],
      blocks: [
        {
          kind: "p",
          text: "Yazı **Taslak** ya da **Revizyon istendi** durumundayken düzenlenebilir. Kayıt için **Bu kayıtta neyi değiştirdiniz?** alanına kısa bir not yazabilirsiniz; sürüm geçmişinde görünür.",
        },
        {
          kind: "compare",
          items: [
            { title: "Taslağı kaydet", tone: "neutral", points: ["Yalnızca kaydeder", "Düzenlemeye devam edersiniz"] },
            {
              title: "İncelemeye gönder",
              tone: "ok",
              points: ["Önce kaydeder, sonra gönderir", "Yazı kategori editörünüze geçer", "Gönderim reddedilirse kaydınız yine de durur"],
            },
          ],
        },
        {
          kind: "p",
          text: "Göndermek için:",
        },
        {
          kind: "list",
          items: [
            "Doğrulanmış imzalı yazar sözleşmeniz olmalı.",
            "İlk teslim yalnızca sayının **Yazı kabul** dönemi açıkken yapılır. Revizyondan sonra yeniden gönderim dönem dışında da olur.",
            "Yayımlanmış bir sayıya yazı gönderilemez.",
          ],
        },
        {
          kind: "note",
          text: "Göndererek o metnin yazar sözleşmesindeki koşullarla yayımlanmasına izin vermiş olursunuz; bu, derginin yazıyı yayımlama taahhüdü değildir. İzin yalnızca gönderdiğiniz metni kapsar: metin sonradan değişirse yeni onay istenir.",
        },
        {
          kind: "p",
          text: "Ekran açıkken bir editör yazıyı kaydettiyse kaydınız reddedilir; metninizi kopyalayıp sayfayı yenileyin. Kaydedilmemiş değişiklikle sayfadan çıkmaya çalışırsanız tarayıcı uyarır.",
        },
      ],
    },
    {
      id: "gonderdikten-sonra",
      title: "Gönderdikten sonra",
      href: "/writer/articles",
      blocks: [
        {
          kind: "p",
          text: "Yazı sırasıyla kategori editörü, ana editör ve yönetimden geçer. Bu sürede metni yalnızca editörler düzenleyebilir; siz yazı sayfasında durumu, editör notlarını, adım geçmişini, sürüm geçmişini ve önizlemeyi görürsünüz.",
        },
        ARTICLE_JOURNEY,
        {
          kind: "list",
          items: [
            "**İncelemede / Ana editör onayında / Yayın kuyruğunda:** beklersiniz.",
            "**Revizyon istendi:** editörün notunu okuyun, düzeltin ve yeniden gönderin. Bu durumda e-posta da alırsınız.",
            "Ana editör yazıyı reddederse gerekçe size e-postayla gelir ve yazı taslak olarak size döner.",
            "**Devir formu bekleniyor:** yazınız kabul edildi; onayınız gerekiyorsa **Eser Onayları** sayfasında görünür.",
            "**Yayına planlandı / Yayınlandı:** yayımlandığında e-posta alırsınız. Geri çekilirse de haber verilir.",
          ],
        },
        {
          kind: "p",
          text: "**Kaynakça** kartı, geri çekilmiş yazılar dışında her durumda açıktır. Kaynakçayı düzenleyip **Kaynakçayı kaydet**e basın; metin değişmediği için yeniden onay gerekmez. Yayımlanmış yazıda değişiklik hemen sayfada görünür.",
        },
      ],
    },
    {
      id: "eser-onaylari",
      title: "Eser Onayları",
      href: "/writer/approvals",
      blocks: [
        {
          kind: "p",
          text: "Bir yazınız için ayrıca onayınız gerekirse (örneğin kabulden sonra metin değiştiyse) burada bekler; e-postayla da haber verilir ve onay verene kadar 3 günde bir hatırlatma gelir. Üstten sayıyı seçebilirsiniz.",
        },
        {
          kind: "steps",
          items: [
            "Satırda kabul edilen metnin özetini ve sözleşme sürümünü kontrol edin.",
            "**Yayın adı**nı seçin: gerçek adınız ya da mahlasınız. Seçim bu eser için sabitlenir.",
            "\"Bu eseri Sözleşme'nin 4. maddesindeki şartlarla ruhsatlıyorum.\" kutusunu işaretleyin.",
            "**Onayla**ya basın. Onay kaydının PDF kopyası e-postanıza gelir.",
          ],
        },
        {
          kind: "compare",
          items: [
            { title: "Onayla", tone: "ok", points: ["Metin sizin izin verdiğiniz metin", "Yayın yolu açılır", "PDF kaydı e-postanıza gelir"] },
            { title: "Reddet", tone: "warn", points: ["Onaylamadığınız bir değişiklik var", "Gerekçe en az 10 karakter", "Yazı revizyona döner"] },
          ],
        },
        {
          kind: "p",
          text: "Metinde onaylamadığınız bir değişiklik varsa **Reddet**e basın, **Ret gerekçesi**ni (en az 10 karakter) yazın ve **Onayı reddet**e basın. Gerekçe editörlere iletilir ve yazı revizyona döner.",
        },
        {
          kind: "note",
          text: "Doğrulanmış güncel sözleşmeniz yoksa ya da yazarlığınız askıdaysa onay veremezsiniz; form devre dışı görünür. **Geçmiş** bölümünde verdiğiniz onaylar ve PDF kayıtları durur.",
        },
      ],
    },
    {
      id: "sozlesme",
      title: "Sözleşmem ve Belgelerim",
      href: "/writer/agreement",
      blocks: [
        {
          kind: "p",
          text: "Yazar sözleşmesini burada okur, imzalar ve yüklersiniz. Hak devri yoktur; mali haklar sizde kalır.",
        },
        {
          kind: "flow",
          steps: ["Oku ve yazdır", "Her sayfaya paraf, sona imza", "Tek PDF olarak yükle", "Yönetici doğrular", "Yazı gönderebilirsin"],
          loop: "Reddedilirse nedeni sayfada yazar; düzeltip yeni PDF yükleyin.",
          caption: "Sözleşmenin yolu.",
        },
        {
          kind: "steps",
          items: [
            "Sözleşme metnini okuyun ve yazdırın. **Her sayfanın** altına paraf atın, son sayfayı imzalayın ve bütün sayfaları tek PDF olarak tarayın (ayrıntı: bir sonraki bölüm).",
            "**İmzalı sözleşme** alanından PDF'i seçin (yalnızca PDF, en çok 4 MB).",
            "**İmzalı PDF'i yükle**ye basın. İncelemede bekleyen bir dosya varken yenisi yüklenemez.",
            "Yönetici doğruladığında sayfada \"İmzalı sözleşmeniz doğrulandı.\" yazar. Reddedilirse nedeni yazılır; düzeltip yeni PDF yükleyin.",
          ],
        },
        {
          kind: "p",
          text: "Size hazırlanmış belgeler varsa **Belgelerim** tablosunda görünür: Genel Katkı Sağlayan Sözleşmesi ve her sayı için Eser Bazlı Kullanım Ruhsatı Formu. Bu durumda imzalı sözleşmeyi de buradan, ilgili satırdan yüklersiniz.",
        },
        {
          kind: "list",
          items: [
            "**İndir** ile belgeyi alın; her sayfasını parafe edip imzalayın, bütün sayfalarını tarayın ve satırdaki **İmzalı PDF** alanından yükleyin. Her belge için ayrı dosya yüklenir.",
            "\"İnceleme gerekiyor\" yazan belge yönetimin kontrolündedir; hazır olunca indirebilirsiniz.",
            "Ruhsat formu iki tarafın imzasıyla yürürlüğe girer. Yüklediğiniz kopya kabul edilmezse satırda \"yeniden yükleyin\" yazar.",
            "Sözleşmeden önce gönderdiğiniz yazılar varsa, sözleşmeniz doğrulandıktan sonra bunlar için **izin beyanını teyit et** düğmesi çıkar.",
          ],
        },
      ],
    },
    SIGNING_SECTION,
    {
      id: "profil",
      title: "Profil ve güvenlik",
      href: "/writer/profile",
      blocks: [
        {
          kind: "list",
          items: [
            "**Profil:** ad soyad, **Mahlas** (yayında bu ad görünür; boşsa ad soyadınız kullanılır), kısa biyografi, telefon (yalnızca yöneticiler ve ana editör görür) ve sosyal medya bağlantıları. **Profili kaydet**e basın. Doğum tarihi kaydedildikten sonra yalnızca yönetici değiştirebilir.",
            "**Şifre:** mevcut ve yeni şifreyi girip **Şifreyi güncelle**ye basın.",
            "**Aktif oturumlar:** tanımadığınız bir oturumu **Kapat**la, diğer tüm cihazları **Diğerlerini kapat**la kapatın.",
          ],
        },
        {
          kind: "p",
          text: "E-posta değişikliği, iki adımlı doğrulama, görev dondurma ve hesap silme Hesabım sayfasındadır. **Görevimi dondur** paneli kapatır; yeniden açılması için yönetici onayı gerekir.",
        },
      ],
    },
  ],
};
