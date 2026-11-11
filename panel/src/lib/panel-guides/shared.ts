import type { GuideBlock, GuideSection } from "./types";

/**
 * Blocks and sections more than one guide shows (D-384). One copy, so the
 * writer and the editors read the same journey and the same rules.
 */

export const ARTICLE_JOURNEY: GuideBlock = {
  kind: "flow",
  steps: [
    "Taslak",
    "İncelemede · kategori editörü",
    "Ana editör onayında",
    "Yayın kuyruğunda",
    "Kabul · Eser Onayı",
    "Yayına planlandı",
    "Yayınlandı",
  ],
  loop: "Revizyon istenirse yazı yazara döner; yazar düzeltip yeniden gönderir. Ana editör yazıyı kategori editörüne de geri yollayabilir.",
  caption: "Bir yazının panelden geçtiği duraklar.",
};

export const ISSUE_WINDOWS: GuideBlock = {
  kind: "timeline",
  segments: [
    { label: "Konu belirleme", detail: "Yazar konusunu gönderir, ana editör karar verir." },
    { label: "Yazı kabul", detail: "Kabul edilen konunun yazısı teslim edilir; son 24 saatte hatırlatma gelir." },
    { label: "İnceleme ve yayın", detail: "Editörler inceler, yönetim yayına alır." },
  ],
  caption: "Her sayının dönemleri; tarihler sayı sayfasında yazar, saatler Türkiye saatidir.",
};

export const WORD_BUDGET: GuideBlock = {
  kind: "figure",
  name: "word-budget",
  caption:
    "Bir kategorinin bir sayıdaki bütün yazılarının toplamı 1.600 kelimeyi geçemez; yazı başına 500 kelime yalnızca öneridir.",
};

export const CHANGE_TYPE: GuideBlock = {
  kind: "compare",
  items: [
    {
      title: "Düzeltme",
      tone: "ok",
      points: ["Yazım, noktalama, dil, biçim", "Yazarın onayı geçerli kalır", "Yazı yoluna devam eder"],
    },
    {
      title: "İçerik değişikliği",
      tone: "warn",
      points: ["Anlam, üslup ya da yapı değişti", "Yazarın onayı iptal olur", "Yazardan yeni Eser Onayı istenir"],
    },
  ],
};

export const EDITOR_ROLES: GuideBlock = {
  kind: "compare",
  items: [
    {
      title: "Kategori editörü",
      tone: "neutral",
      points: [
        "En çok 3 alan, her alanın tek editörü",
        "Yalnızca kendi alanlarındaki ve kendisine gönderilen yazılar",
        "İlk onay: Onayla ve Ana Editöre Gönder",
      ],
    },
    {
      title: "Ana editör",
      tone: "neutral",
      points: [
        "Tek kişi; bütün kategoriler",
        "İkinci onay, ret ve yazıyı başka editöre gönderme",
        "Konu önerileri, geçici alan, e-posta kuyruğu, ekip iletişimi",
      ],
    },
  ],
};

export const TWO_FACTOR_SECTION: GuideSection = {
  id: "giris",
  title: "Panele giriş ve iki adımlı doğrulama",
  href: "/account",
  blocks: [
    {
      kind: "p",
      text: "Editör paneline yalnızca rolü editör olan, e-postası doğrulanmış, yasaklı ya da görevi dondurulmuş olmayan kullanıcılar girer. Ayrıca **iki adımlı doğrulama zorunludur**; açık değilse panel sizi Hesabım sayfasına gönderir.",
    },
    {
      kind: "flow",
      steps: ["Hesabım → İki adımlı doğrulama", "QR kodu uygulamayla tara", "Şifre + 6 haneli kod", "Yeniden giriş", "Kurtarma kodlarını sakla"],
      caption: "İki adımlı doğrulamayı bir kez kurarsınız; sonra her girişte uygulamadaki kodu yazarsınız.",
    },
    {
      kind: "steps",
      items: [
        "Hesabım sayfasındaki **İki adımlı doğrulama** kartını açın.",
        "QR kodu bir doğrulama uygulamasıyla (Google Authenticator, Authy vb.) taratın. Taratamıyorsanız karttaki bağlantıyı ya da **Gizli anahtar**ı elle girin.",
        "**Mevcut şifre** ve uygulamadaki 6 haneli **Doğrulama kodu**nu yazıp **Doğrulamayı aç**a basın.",
        "Kurulumdan sonra yeniden giriş yapmanız istenir.",
        "Ardından **Kurtarma kodları oluştur** ile kodlarınızı alın ve güvenli bir yerde saklayın. Telefonunuzu kaybederseniz kurtarma kodu, doğrulama kodunun yerine geçer. Yeni kod oluşturmak eskilerini geçersiz kılar.",
      ],
    },
    {
      kind: "note",
      text: "Hem editör hem yazar olan kullanıcılar üst çubuktaki **Yazar Paneli / Editör Paneli** düğmesiyle iki panel arasında geçer. Her panel sayfasının üst çubuğundaki **Bu sayfanın rehberi** düğmesi, o sayfayı anlatan bölümü açar.",
    },
  ],
};

export const MEDIA_SECTION: GuideSection = {
  id: "medya",
  title: "Medya kütüphanesi",
  href: "/editor/media",
  blocks: [
    {
      kind: "p",
      text: "Yazılarda kullanılan görseller. Lisans bilgisi girilmemiş görsel yazıya eklenemez; bağlı görsellerden birinin lisansı eksik olan yazı yayına alınamaz.",
    },
    {
      kind: "flow",
      steps: ["Dosyayı seç", "Lisans türü (zorunlu)", "Lisans kaynağı + alternatif metin", "Yükle"],
      caption: "Lisans türü girilmeden görsel kullanılamaz.",
    },
    {
      kind: "steps",
      items: [
        "**Yükle** bölümünden dosyayı seçin: JPEG, PNG, GIF, WEBP (en çok 10 MB) ya da PDF (en çok 20 MB). Dosya türü içeriğinden doğrulanır.",
        "**Lisans türü**nü seçin (zorunlu): Kendi eserimiz, CC0, CC BY, Lisanslı stok, İzin yazısı var ya da Diğer.",
        "**Lisans kaynağı**na bağlantıyı ya da kısa açıklamayı, **Alternatif metin**e görme engelli okurlar için görselin tarifini yazın.",
        "**Yükle**ye basın.",
      ],
    },
    {
      kind: "p",
      text: "**Kütüphane** tablosu son 100 kaydı gösterir; lisansı eksik olanlar kırmızı \"Eksik\" ile işaretlidir. Düzeltmek için **Lisans bilgisini düzelt** formunda görseli seçip bilgileri girin ve **Güncelle**ye basın.",
    },
  ],
};
