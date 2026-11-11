import { ARTICLE_JOURNEY, CHANGE_TYPE, EDITOR_ROLES, ISSUE_WINDOWS } from "./shared";
import type { PanelGuide } from "./types";

/** The admin panel, including the editorial pages the admin sidebar links to. */
export const ADMIN_GUIDE: PanelGuide = {
  title: "Yönetim paneli kullanım rehberi",
  intro:
    "Yönetim kenar çubuğundaki her sayfa: kullanıcılar ve roller, yayın akışı, sayılar, sözleşme ve belgeler, topluluk moderasyonu ve sistem ayarları. Her panel sayfasının üst çubuğundaki **Bu sayfanın rehberi** düğmesi o sayfayı anlatan bölümü açar.",
  sections: [
    {
      id: "giris",
      title: "Giriş ve iki adımlı doğrulama",
      href: "/account",
      blocks: [
        {
          kind: "p",
          text: "Yönetim paneli iki adımlı doğrulama ister; kurulu değilse Hesabım sayfasına yönlendirilirsiniz. **İki adımlı doğrulama** kartında QR kodu taratın, **Mevcut şifre** ve **Doğrulama kodu**nu girip **Doğrulamayı aç**a basın, ardından **Kurtarma kodları oluştur** ile kodlarınızı alıp saklayın.",
        },
        {
          kind: "note",
          text: "Editörler de iki adımlı doğrulama kurmadan panele giremez. Bir editörün durumu kullanıcı sayfasında \"İki adımlı doğrulama: Açık / Kapalı\" satırında görünür.",
        },
      ],
    },
    {
      id: "genel-bakis",
      title: "Genel bakış",
      href: "/admin",
      blocks: [
        {
          kind: "list",
          items: [
            "**Bekleyen işler:** açık içerik bildirimleri, yönetim onayı bekleyen yazar başvuruları ve yayın kuyruğunda onay bekleyen yazılar. Her sayaç ilgili listeyi açar.",
            "24 saati geçen bir içerik bildirimi varsa kırmızı uyarı çıkar: 5651 sayılı Kanun'un 24 saatlik cevap süresi aşılmıştır, hemen inceleyin.",
            "Süren sayıların konu ve teslim süreci, rol sayaçları (Kullanıcı, Yazar, Editör, Tasarımcı, Yönetici) ve çerçeve sözleşmeyi onaylayan / bekleyen yazar sayısı.",
            "**Mahlası olmayanlar:** bu yazarların yazıları isimsiz yayımlanır. **Terfiye hazır okuyucular:** yazarlık ön koşullarını sağlayan okuyucular.",
            "Ana editör yoksa ya da birden fazla kişi ana editör işaretliyse uyarı çıkar.",
          ],
        },
      ],
    },
    {
      id: "kullanicilar",
      title: "Kullanıcılar",
      href: "/admin/users",
      pages: [
        "/admin/users/writers",
        "/admin/users/editors",
        "/admin/users/illustrators",
        "/admin/users/yetkililer",
        "/admin/users/readers",
      ],
      blocks: [
        {
          kind: "p",
          text: "Alt bağlantılar hesap türüne göre süzer: Hepsi, Yazarlar, Editörler, Tasarımcılar, Yetkililer ve Kullanıcılar (rolü olmayan okuyucular). **Ara** alanına ad ya da e-posta yazıp **Uygula**ya basın. Hepsi listesindeki **Ekip üyeliklerini indir** ekip üyeliklerini dosya olarak indirir.",
        },
      ],
    },
    {
      id: "kullanici-detayi",
      title: "Bir kullanıcıyı yönetmek",
      href: "/admin/users",
      pages: ["/admin/users/"],
      blocks: [
        {
          kind: "p",
          text: "Listede bir isme tıklayınca kullanıcının sayfası açılır. **Kayıt bilgileri** kartı e-posta doğrulaması, telefon, doğum tarihi, KVKK onayı, alanlar ve yazı sayısı gibi bilgileri hesap türüne göre gösterir.",
        },
        {
          kind: "list",
          items: [
            "**Tasarımcı olarak işaretle:** çizer paneli açılır. Rol değildir; denetim kaydına yazılır.",
            "**Yetkili olarak işaretle:** yalnızca bir işarettir; panel ya da içerik yetkisi vermez.",
            "**Yazar alanları:** yazarın 1. ve 2. alanını seçip **Alanları güncelle**ye basın. İki alan farklı olmalı, kontenjanı dolu alan seçilemez. Yazar alanlarını kendisi değiştiremez.",
            "**Sayıya yazı gönderme izni:** yeni yazıya kapalı bir sayıyı (örnek sayı ya da planlaması bitmiş sayı) yalnızca bu yazara açar. Dönemi olan sayılarda verilmez.",
            "**Geçici alan (sayıya özel):** yazara bir sayı için ek alan verir; kendi alanları ve kontenjan değişmez.",
          ],
        },
        {
          kind: "p",
          text: "Editör görevleri iki türdür:",
        },
        EDITOR_ROLES,
        {
          kind: "p",
          text: "**Editör görevleri** kartında editöre en çok üç alan atanır (her alanın tek editörü olur) ve **Ana editör** kutusu işaretlenir; **Görevleri güncelle**ye basın. Ana editör tek kişidir: başka biri ana editörse sistem önce onun işaretini kaldırmanızı ister. Aynı karttaki **Yazar yap** editörü \"Editor & Yazar\" yapar; rolü değişmez, panel anahtarıyla iki panel arasında geçer.",
        },
        {
          kind: "p",
          text: "**Rol ve durum** kartı:",
        },
        {
          kind: "flow",
          steps: ["Okuyucu (user)", "Yazar (writer)", "Editör (editor)", "Yönetici (admin)"],
          caption: "Roller sıralıdır: her rol bir öncekinin yetkilerini kapsar. Tasarımcı ve yetkili rol değil, işarettir.",
        },
        {
          kind: "compare",
          items: [
            {
              title: "Okuyucudan yukarı her rol için",
              tone: "ok",
              points: ["E-posta doğrulanmış", "Doğum tarihi girilmiş, 18 yaş", "KVKK aydınlatma metni onaylanmış", "Yasaklı değil"],
            },
            {
              title: "Editör ve yönetici için ayrıca",
              tone: "neutral",
              points: ["İki adımlı doğrulama kurulmadan panele giremez"],
            },
          ],
        },
        {
          kind: "list",
          items: [
            "**Rolü değiştir:** rol ve not girin. Kendi rolünüzü değiştiremezsiniz. Okuyucu dışındaki her rol için ön koşullar yeniden denetlenir: e-posta doğrulanmış, doğum tarihi girilmiş, 18 yaşını doldurmuş, KVKK onaylanmış, yasaklı değil. Eksik varsa işlem reddedilir. Her değişiklik **Rol değişikliği geçmişi**ne yazılır ve silinmez.",
            "Editörlükten çıkan kişinin alanları ve ana editör işareti silinir; okuyucuya düşürülen kişinin oturumları hemen kapanır.",
            "**Yazar durumunu değiştir:** Sözleşme bekliyor / Aktif / Donduruldu. Dondurmak paneli kapatır, imzalı kayıtlar yerinde kalır.",
            "**Editör durumunu değiştir:** dondurulan editör rolünü ve kayıtlarını korur, yalnızca paneli kapanır.",
          ],
        },
        {
          kind: "p",
          text: "**Hesap işlemleri** kartı:",
        },
        {
          kind: "list",
          items: [
            "**Yasakla:** gerekçe zorunlu; tüm oturumlar kapanır. **Yasağı kaldır** ile geri alınır.",
            "**Doğum tarihini güncelle:** doğum tarihini yalnızca yönetici değiştirebilir.",
            "**Kullanıcıyı sil:** gerekçe ve onay kutusu zorunlu. Kişisel veriler anonimleştirilir; imzalı kayıtlar saklanır. Geri alınamaz.",
            "**Tüm oturumlarını kapat:** kişiyi bütün cihazlardan çıkarır.",
          ],
        },
      ],
    },
    {
      id: "basvurular",
      title: "Yazar başvuruları",
      href: "/admin/applications",
      blocks: [
        {
          kind: "p",
          text: "**Yönetim onayı bekleyenler** listesinde başvurunun cevaplarını ve varsa örnek eseri görürsünüz.",
        },
        {
          kind: "flow",
          steps: ["Başvuru", "Editör incelemesi", "Yönetim onayı · sözleşme tanımlanır", "İmzalı sözleşme yüklenir", "Doğrula → hesap yazar olur"],
          loop: "Reddet her aşamada mümkün; gerekçe başvuru sahibine e-postayla gider.",
          caption: "Bir okuyucunun yazar olma yolu.",
        },
        {
          kind: "list",
          items: [
            "**Onayla ve sözleşme tanımla:** başvuruya güncel sözleşme sürümü tanımlanır ve başvuru sahibi imzaya davet edilir.",
            "**Reddet:** **Ret gerekçesi** zorunlu; başvuru sahibine e-postayla gider.",
            "Başvuru sahibi imzalı sözleşmeyi yükler; siz **Sözleşme sürümleri** sayfasında **Doğrula**ya basınca hesap yazar olur.",
            "Aynı işlemler kullanıcı sayfasındaki **Yazarlık süreci** kartında da vardır; ön koşullar orada ✓/✗ ile listelenir.",
          ],
        },
      ],
    },
    {
      id: "alanlar",
      title: "Yazı alanları",
      href: "/admin/categories",
      blocks: [
        {
          kind: "list",
          items: [
            "**Yeni alan:** **Alan adı** ve **Kontenjan** (1–99, varsayılan 3) girip **Alan ekle**ye basın.",
            "Her satırda ad, kontenjan, sıra ve **Kayıt formunda gösterilsin** kutusunu değiştirip **Kaydet**e basın. Kontenjan alandaki yazar sayısının altına düşürülemez.",
            "**Alanı sil:** yalnızca yazarı olmayan ve bir editöre atanmamış alan silinir; yazarı olan alan pasife alınır.",
          ],
        },
      ],
    },
    {
      id: "duyurular",
      title: "Duyurular",
      href: "/admin/announcements",
      blocks: [
        {
          kind: "steps",
          items: [
            "**Yeni duyuru** formunda **Başlık** ve **Metin (markdown)** girin.",
            "**Hedef kitle**yi (Yazarlar / Editörler / Tüm ekip) ve **Önem seviyesi**ni seçin.",
            "Gerekirse **Onay gerektirir** ve **Listenin en üstüne sabitle** kutularını işaretleyin.",
            "**Taslak oluştur**a, ardından listede **Yayınla**ya basın.",
          ],
        },
        {
          kind: "compare",
          items: [
            { title: "Bilgilendirme / Önemli", tone: "neutral", points: ["Onay kutusu işaretliyse onay ister", "Değilse okunması yeter"] },
            { title: "Kritik", tone: "warn", points: ["Her zaman onay ister", "Onaylanana kadar yazar sayfaları kapalı"] },
          ],
        },
        {
          kind: "note",
          text: "Onay gerektiren duyuru onaylanana kadar yazarın diğer panel sayfaları kapalı kalır. Kritik seviyedeki duyurular kutu işaretli olmasa da her zaman onay ister. Yayınlanmış duyurunun **Okunma raporu** kimin okuyup onayladığını gösterir.",
        },
      ],
    },
    {
      id: "cizimler",
      title: "Çizimler",
      href: "/admin/cizimler",
      blocks: [
        {
          kind: "list",
          items: [
            "Çizerlerin gönderdiği çizimler çizere göre gruplanır; üstteki sekmeler kategoriye göre süzer. Bu sayfayı yalnızca yöneticiler görür. Her yeni çizimde yöneticilere panel bildirimi gelir.",
            "Her çizimde bir yazı alanı seçip **Kategoriyi kaydet**e basın. Kategori ruhsat formuna yazılmaz.",
            "**Kaldır:** dosya silinir, çizer de göremez; gönderilmemiş ruhsat formu da silinir. Geri alınamaz.",
            "Ruhsat formu, **Sözleşme sürümleri** sayfasındaki **Bir sayının ruhsat formlarını hazırla** ile hazırlanır: bir çizerin bir sayıdaki çizimleri için tek form.",
          ],
        },
      ],
    },
    {
      id: "goruntulenme",
      title: "Sayı görüntülenmeleri",
      href: "/admin/views",
      blocks: [
        {
          kind: "p",
          text: "Her sayının son 7 gün, son 30 gün ve toplam görüntülenmesi; altında gün gün tablo. Aynı tarayıcının aynı sayıyı açması günde bir kez sayılır, editör ve yönetici açılışları sayılmaz. Sayım 21 Ekim 2026'da başladı.",
        },
      ],
    },
    {
      id: "topluluk",
      title: "Topluluk yönetimi",
      href: "/admin/community",
      blocks: [
        {
          kind: "p",
          text: "Okuyucu yorumları ve topluluk sohbeti bakımından yer sağlayıcıyız; bir kaldırma başvurusu en geç 24 saatte cevaplanmalıdır. Ön sayfa açık bildirimleri, yeni anonim mesajları, toplulukları ve son gönderileri sayar.",
        },
        {
          kind: "timeline",
          segments: [
            { label: "0–18 saat", detail: "Bildirim kuyrukta; kalan süre her satırda yazar." },
            { label: "18. saat", detail: "Yöneticilere bir kez daha e-posta gider." },
            { label: "24. saat", detail: "5651 sayılı Kanun'un cevap süresi biter; genel bakışta kırmızı uyarı çıkar." },
          ],
          caption: "Bir içerik bildiriminin saati, geldiği andan başlar.",
        },
        {
          kind: "list",
          items: [
            "**Bildirimler:** en eskisi üstte, kalan süreyle. 6 saatten az kalanlar ve süresi geçenler renklidir; 18 saati geçen bildirim için yöneticilere bir kez daha e-posta gider. Kararı seçin (**İçeriği kaldır** ya da **Kurallara aykırı değil**), isterseniz not yazın ve **Sonuçlandır**a basın. Karar aynı içerikle ilgili bütün açık bildirimleri kapatır ve bildirenlere sonucu iletir.",
            "**Anonim kutu:** dedikodu bölümü için gelen anonim mesajlar. **Arşivle** ya da **Kaldır**. Gerçek kişiyi teşhir eden, +18 ya da siyasi içerik yayımlanmaz.",
            "**Topluluklar:** ad ve açıklama girip **Topluluk aç**. Arşivlenen topluluk okunur ama yeni üye ve gönderi almaz.",
            "**Gönderiler** ile **Yorumlar ve sohbet:** en yeni içerikler; uygunsuz olanı **Kaldır**.",
            "**Yasaklı kelimeler:** eklenen kelimeler yorumlarda ve sohbette otomatik yıldızlanır; büyük/küçük harf ve ekli biçimler de yakalanır.",
          ],
        },
      ],
    },
    {
      id: "yayin-akisi",
      title: "Makaleler ve yayın kuyruğu",
      href: "/editor/articles",
      pages: ["/editor/articles/"],
      blocks: [
        {
          kind: "p",
          text: "Onay zincirinin bütün kademeleri ve yayın kuyruğu. Liste editör sayfasıyla aynıdır (sayı, arama, durum, kategori, yazar ve sıralama filtreleri; **Yeni makale kaydı**). Yazı sayfasında yalnızca yapılabilecek geçişler düğme olarak görünür.",
        },
        ARTICLE_JOURNEY,
        {
          kind: "steps",
          items: [
            "Ana editör onayındaki yazıya siz de karar verebilirsiniz: **Onayla**, **Yazardan revizyon iste**, **Kategori editöründen revizyon iste** ya da **Reddet** (gerekçe zorunlu).",
            "Yayın kuyruğundaki yazıda **Kabul Et**e basın. Yazı \"Devir formu bekleniyor\" durumuna geçer; yazarın onayı gerekiyorsa ondan istenir.",
            "Onay tamamlanınca **Yayına Al** ile planlayın. **Yayın zamanı** Türkiye saatidir; planlanan yazılar her sabah 06.00 civarında yayına alınır. Tam saatinde yayın için o saatte **Hemen Yayınla**ya basın.",
            "Gerekirse **Arşivle** ya da **Geri Çek** (gerekçe zorunlu). Geri çekilmiş yazı son durumdur; okurlara \"kaldırıldı\" olarak görünür.",
          ],
        },
        {
          kind: "p",
          text: "Sistem bir yazının planlanmasını ya da yayımlanmasını aşağıdaki üç koşul sağlanmadan kabul etmez:",
        },
        {
          kind: "flow",
          steps: ["Yazarın o metin için yayın izni var", "Metin izin verilen metinle aynı (ya da fark kayıtlı düzeltme)", "Bağlı her görselin lisans türü girilmiş", "Yayına Al / Hemen Yayınla"],
          caption: "Biri eksikse sistem işlemi reddeder ve nedenini yazar; metin farklıysa yazardan yeni Eser Onayı alınmalıdır.",
        },
        {
          kind: "p",
          text: "Metni düzenlerken **Değişikliğin türü**nü doğru seçin:",
        },
        CHANGE_TYPE,
      ],
    },
    {
      id: "sayilar",
      title: "Sayılar",
      href: "/editor/issues",
      blocks: [
        ISSUE_WINDOWS,
        {
          kind: "list",
          items: [
            "**Aktif sayı:** sayıyı seçip **Aktif sayı yap**a basın. Seçilmezse yayımlanmamış en küçük numaralı sayı aktiftir. Yazarların yeni yazıları yalnızca aktif sayıya bağlanır.",
            "**Yeni sayı:** numara, başlık, tema, planlanan yayın tarihi, tanıtım yazısı ve iki dönem (**Konu belirleme**, **Yazı kabul**; her biri başlangıç ve bitiş) girip **Sayı oluştur**a basın. Dönemler girilen saatlerde kendiliğinden açılıp kapanır ve yazarlara e-posta gider.",
            "Sayı kartında **Bilgiler** formuyla bilgileri ve kapak görselini güncelleyip **Kaydet**e basın.",
            "**Durumu değiştir:** Planlanıyor / Üretimde / Yayınlandı / Arşivlendi. Yayınlandı yapılınca yayın tarihi atanır ve sayı okurlara açılır.",
            "**İçindekiler**de yazıları **Yukarı taşı / Aşağı taşı** ile sıralayıp **Sıralamayı kaydet**e basın.",
            "\"Yalnızca iki admin — örnek sayı\" rozetli sayı okurlara kapalıdır; yalnızca yöneticiler görür.",
          ],
        },
      ],
    },
    {
      id: "sayfalar",
      title: "Sayı sayfaları ve testler",
      href: "/editor/issues",
      pages: ["/editor/issues/"],
      blocks: [
        {
          kind: "p",
          text: "Sayı kartındaki **Sayfalar** bağlantısı, okuyucuda (sayfa çevirmeli görünüm) gösterilen sayfaları yönetir. **Okuyucuda önizle** sonucu hemen gösterir.",
        },
        {
          kind: "flow",
          steps: ["Tasarım sayfalarını içe aktar", "Sırayı ve sayfa bilgilerini kontrol et", "Etkileşim alanlarını çiz", "Okuyucuda önizle", "Sayıyı yayınla"],
          caption: "Bir sayının sayfalarını hazırlamak.",
        },
        {
          kind: "list",
          items: [
            "**Tasarım sayfalarını içe aktar / güncelle:** koda eklenmiş tasarım sayfalarını sıra, içindekiler ve etkileşim alanlarıyla aktarır. Tekrar basmak yalnızca değişeni günceller. Yayındaki sayıda değişiklik okurlara hemen görünür.",
            "İlk aktarımda önceki sayfalar yedeklenir; **Önceki sayfalara geri dön** ile geri getirilebilir.",
            "**Sayfa görseli yükle:** PNG, JPG ya da WEBP sürükleyin; geniş görsellerde **Çift sayfa — ortadan böl** seçeneği çıkar.",
            "Her sayfada **Yukarı taşı**, **Aşağı taşı**, **Çoğalt**, **Kaldır**; sıra değişince **Sıralamayı kaydet**. Sayfa etiketi, erişilebilir açıklama ve içindekiler başlığını girip **Sayfa bilgilerini kaydet**e basın.",
            "**Etkileşim alanları:** görselin üzerine dikdörtgen çizip türünü seçin (Dış bağlantı / Dergi içi geçiş / Bilgi kutusu / Test) ve **Etkileşimleri kaydet**e basın.",
            "**Testler:** test türü, başlık, sorular ve seçenekler. **Eser sahibi** alanına testi hazırlayanın hesap e-postasını yazın; ruhsat formu buna göre hazırlanır.",
          ],
        },
      ],
    },
    {
      id: "konular",
      title: "Konu önerileri",
      href: "/editor/topics",
      blocks: [
        {
          kind: "p",
          text: "Ana editörün de kullandığı sayfa. Bir öneride **Kabul et**, **Değişiklik iste** ya da **Reddet**i seçip **Yazara not** yazın (değişiklik ve retlerde zorunlu) ve **Kararı kaydet**e basın. Reddedilmiş bir konuyu yalnızca yönetici yeniden açabilir: **Konuyu yeniden aç** → **Yeniden aç ve kabul et**; yazara bildirim gider. Kimse kendi konusuna karar veremez.",
        },
      ],
    },
    {
      id: "gecici-alan",
      title: "Geçici alan",
      href: "/editor/gecici-alan",
      blocks: [
        {
          kind: "p",
          text: "Bir yazara, kendi alanı olmayan bir alanı yalnızca bir sayı için verir. Sayıyı seçin, **Yazar** ve **Alan**ı belirleyip **Geçici alanı ver ve e-posta gönder**e basın. **Geri al** alanı kaldırır; açılmış konu ve yazılar yerinde kalır. Yayımlanmış sayı için verilemez. Yöneticiler de seçilebilir.",
        },
      ],
    },
    {
      id: "eser-onayi",
      title: "Eser Onayı takibi",
      href: "/editor/approvals",
      blocks: [
        {
          kind: "p",
          text: "Yazarın onayı olmadan hiçbir eser yayımlanamaz. **Bekleyen onaylar** tablosu seçili sayıda onay bekleyen eserleri, açılış tarihini (gecikmişse \"gecikmiş\") ve son hatırlatmayı gösterir. **Hatırlatma gönder**, üç günden uzun süredir bekleyen ve son üç günde hatırlatılmamış onaylara e-posta gönderir. Hatırlatmalar ayrıca kendiliğinden de gider.",
        },
      ],
    },
    {
      id: "medya",
      title: "Medya kütüphanesi",
      href: "/editor/media",
      blocks: [
        {
          kind: "p",
          text: "Dosyayı seçin (JPEG, PNG, GIF, WEBP en çok 10 MB; PDF en çok 20 MB), **Lisans türü**nü (zorunlu), **Lisans kaynağı**nı ve **Alternatif metin**i girip **Yükle**ye basın. Lisansı eksik görseller kırmızı \"Eksik\" ile görünür; **Lisans bilgisini düzelt** formundan düzeltin. Lisanssız görsel yazıya eklenemez ve bağlı olduğu yazı yayımlanamaz.",
        },
      ],
    },
    {
      id: "sozlesmeler",
      title: "Sözleşme sürümleri ve belgeler",
      href: "/admin/agreements",
      pages: ["/admin/agreements/documents/"],
      blocks: [
        {
          kind: "p",
          text: "Yazar sözleşmesinin sürümleri, katkı sağlayanlara hazırlanan belgeler ve imzalı sözleşmelerin doğrulanması bu sayfadadır.",
        },
        {
          kind: "flow",
          steps: ["Belgeleri hazırla", "Mail kuyruğuna al", "Kuyruğu şimdi işle", "Kişi imzalayıp yükler", "Doğrula"],
          loop: "Kuyruktaki mailler gönderilmeden geri alınabilir; imzalamayanlara arşiv sayfasından hatırlatma gider.",
          caption: "Bir belgenin hazırlanmaktan doğrulanmaya kadar yolu.",
        },
        {
          kind: "list",
          items: [
            "**Şablon** kartı: **Şablondan sürüm oluştur**, ardından **Bu sürümü yayınla**. Yeni sürüm yayınlanınca aktif yazarlar yeni sürümü imzalayıp yükleyene kadar \"sözleşme bekliyor\" durumuna geçer. Yayıncı bilgileri eksikse ya da şablonda tanımsız yer tutucu varsa yayın engellenir.",
            "**Ruhsat formlarında ticari kullanım:** Hariç / Dahil seçip **Kaydet**. Seçim yalnızca bundan sonra hazırlanan formlara uygulanır; ruhsat her durumda bedelsizdir.",
            "**Bir sayının ruhsat formlarını hazırla:** sayıyı (ve isterseniz tek kişiyi) seçip **Ruhsat formlarını hazırla**ya basın. O sayının ruhsat formları ve yazarlarının eksik genel sözleşmesi hazırlanır; e-posta gitmez. Bir kişinin aynı sayıdaki eserleri tek formda toplanır.",
            "**Belgeleri hazırla (e-posta gönderilmez):** bütün eksik belgeleri hazırlar. Kayıtlarda eksik ya da şüpheli bilgi varsa belge \"İnceleme gerekiyor\" olarak bekler; adına tıklayıp nedenini görün.",
            "**Gönderilmemiş hazır belgeleri mail kuyruğuna al**, ya da kişi başına **Belgelerini mail gönder**. Gönderim **E-posta kuyruğu**ndaki **Kuyruğu şimdi işle** ile yapılır.",
            "**Kuyruktaki belge maillerini geri al:** henüz gönderilmemiş belge e-postalarını kuyruktan siler. **Gönderilmemiş belgelerin hepsini sil** ile belgeleri silip yeniden hazırlayabilirsiniz; gönderilmiş ve imzalı belgelere dokunmaz.",
          ],
        },
        {
          kind: "p",
          text: "**İmzalı sözleşme doğrulaması** kartında yüklenen PDF'i açıp inceleyin:",
        },
        {
          kind: "list",
          items: [
            "**Doğrula:** yükleme güncel sürüm için olmalı; kendi sözleşmenizi doğrulayamazsınız. Başvurusu onaylanmış okuyucu yazar olur, sözleşme bekleyen yazar aktifleşir.",
            "**Reddet:** üyenin göreceği **Ret nedeni** zorunlu.",
            "**Doğrulamayı geri al:** neden zorunlu; kayıt yeniden \"inceleniyor\" olur, rol ve yazar durumu değişmez.",
          ],
        },
      ],
    },
    {
      id: "imza-arsivi",
      title: "İmzalı sözleşme arşivi",
      href: "/admin/agreements/imza",
      blocks: [
        {
          kind: "p",
          text: "Doğrulanan sözleşme onaylanmış sayılır. Dergi tarafından imzalanmış kopya yalnızca arşiv içindir; yüklenmemesi hiçbir işlemi engellemez. Sayfa beş gruptan oluşur:",
        },
        {
          kind: "list",
          items: [
            "**İmzalamayanlar:** belgesi gönderilmiş ama imzalı kopyasını yüklememiş kişiler. **Hatırlatma maili** (ya da hepsine) kuyruğa hatırlatma ekler; her basış yeni bir hatırlatmadır. Kişi imzalı PDF'i size gönderdiyse **Kişi adına yükle** ile yükleyin.",
            "**Doğrulama bekleyenler:** doğrulama Sözleşme sürümleri sayfasından yapılır.",
            "**Dergi imzalı yüklenmeyen belgeler:** **Hepsini indir (ZIP)**, imzalayın ve belge başına yükleyin.",
            "**İki tarafça imzalı belgeler:** arşiv; toplu ZIP indirme ve **Yenisiyle değiştir**.",
            "**Dergiden ayrılanlar:** yazarlıktan okura dönenlerin belgeleri.",
          ],
        },
      ],
    },
    {
      id: "denetim",
      title: "Denetim kaydı",
      href: "/admin/audit",
      blocks: [
        {
          kind: "p",
          text: "Paneldeki önemli her işlem burada kalır; kayıtlar eklenir, değiştirilemez ve silinemez. **Eylem** (örneğin article.status), **Varlık** (örneğin articles) ve tarih aralığıyla süzüp **Uygula**ya basın. Her satırda zaman, eylem, işlemi yapan ve IP görünür.",
        },
      ],
    },
    {
      id: "e-posta",
      title: "E-posta kuyruğu",
      href: "/admin/mail",
      blocks: [
        {
          kind: "flow",
          steps: ["E-posta kuyruğa yazılır", "Gönderilir", "Başarısızsa 6 kez yeniden denenir", "İçerik silinir, kayıt 30 gün"],
          caption: "Sistemin her e-postası bu yoldan geçer.",
        },
        {
          kind: "list",
          items: [
            "Her e-posta önce kuyruğa yazılır; başarısız gönderim en çok 6 kez, artan aralıklarla yeniden denenir. Gönderilen iletinin içeriği hemen silinir, kayıt 30 gün tutulur.",
            "**Kuyruğu şimdi işle** bekleyenleri hemen gönderir (bir seferde yaklaşık 4 dakika); sığmayanlar sonraki çalışmaya kalır. Kuyruk her yeni e-postadan sonra ve günlük işte de işlenir.",
            "**Önizle** iletinin alıcının göreceği hâlini, **Yeniden dene** başarısız iletiyi tekrar gönderir.",
            "Ana editör de bu sayfayı kendi panelinden kullanır.",
          ],
        },
      ],
    },
    {
      id: "sistem",
      title: "Sistem",
      href: "/admin/settings",
      blocks: [
        {
          kind: "list",
          items: [
            "**Yayıncı bilgileri:** ortakların adları, tebligat adresi, dergi e-posta adresi, yayın alan adı ve yetkili mahkeme şehri. Hepsi zorunludur; biri boşsa sözleşme oluşturulamaz ve kimse yazar yapılamaz. **Yayıncı bilgilerini kaydet**e basın.",
            "**KVKK aydınlatma metni:** başlığı ve metni girip **Yeni sürüm yayınla**ya basın. Yeni sürüm her üyeye panelde bir kez gösterilir; **Esaslı değişiklik** kutusu işaretliyse üyelere bildirim ve e-posta da gider. Metin, kodun fiilen işlediği veriyi anlatmalıdır.",
            "**E-posta şablonları:** sistemin gönderdiği e-postaların örnek değerlerle önizlemesi.",
          ],
        },
      ],
    },
  ],
};
