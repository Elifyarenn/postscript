import type { GuideSection } from "./types";

/**
 * How to sign, initial, scan and shrink a contract or licence form; shared by
 * the writer and çizer guides because both upload the same documents. The
 * 4 MB figure is MAX_SIGNED_CONTRACT_MB in `src/services/signed-contracts.ts`.
 */
export const SIGNING_SECTION: GuideSection = {
  id: "imza-ve-tarama",
  title: "Belgeyi imzalamak, parafe etmek ve taramak",
  blocks: [
    {
      kind: "p",
      text: "Sözleşme ve ruhsat formları kâğıt üzerinde imzalanır, taranır ve tek bir PDF olarak panele yüklenir. Belgenin bütün sayfaları yüklenmelidir; eksik sayfalı ya da okunmayan kopya kabul edilmez.",
    },
    {
      kind: "figure",
      name: "signed-pages",
      caption: "Her sayfanın altındaki paraf alanına adınızın ve soyadınızın baş harflerini yazın; son sayfayı ayrıca imzalayın.",
    },
    {
      kind: "steps",
      items: [
        "Belgeyi **İndir** ile alın ve bütün sayfalarını yazdırın. Sayfa atlamayın, sırayı bozmayın.",
        "**Her sayfanın** altındaki paraf alanına paraf atın (adınızın ve soyadınızın baş harfleri, her sayfada aynı biçimde). Paraf alanı olmayan bir sayfada sayfanın sağ alt köşesine atın.",
        "Son sayfadaki imza alanını **el yazınızla** imzalayın ve istenen bilgileri (ad soyad, tarih) doldurun. Mavi ya da siyah tükenmez kalem kullanın.",
        "**Bütün sayfaları** sırayla tarayın: ilk sayfadan son sayfaya kadar her sayfa ayrı bir tarama olsun, hepsi **tek bir PDF dosyasında** toplansın.",
        "Taramayı kontrol edin: her sayfa düz, kenarları kesilmemiş, yazı okunur; parafınız ve imzanız görünüyor.",
        "Dosya 4 MB'tan büyükse sıkıştırın (aşağıda).",
        "PDF'i panelde ilgili satırdan yükleyin.",
      ],
    },
    {
      kind: "flow",
      steps: ["Yazdır", "Her sayfaya paraf, sona imza", "Bütün sayfaları tara", "Tek PDF, 4 MB altı", "Panele yükle"],
      caption: "Yazdırmaktan yüklemeye beş adım.",
    },
    {
      kind: "compare",
      items: [
        {
          title: "Kabul edilen kopya",
          tone: "ok",
          points: ["Bütün sayfalar, sırayla, tek PDF", "Her sayfada paraf, sonda imza", "Düz, okunur, kenarlar kesilmemiş"],
        },
        {
          title: "Geri çevrilen kopya",
          tone: "warn",
          points: ["Eksik ya da karışık sayfa", "Paraf ya da imza yok", "Bulanık, eğik ya da yarısı kesik fotoğraf"],
        },
      ],
    },
    {
      kind: "list",
      items: [
        "Fotoğraf değil, **tarama** kullanın: tarama uygulamaları kenarları düzeltir, gölgeyi siler ve sayfaları tek PDF'te birleştirir.",
        "Belgeyi düz, iyi aydınlatılmış bir zemine koyun; flaş parlaması yazıyı okunmaz yapabilir.",
        "Tarama uygulamasında renk yerine \"Gri tonlama\" ya da \"Belge\" filtresini seçmek dosyayı hem okunur hem küçük tutar.",
        "Her belge ayrı dosyadır: sözleşmeyi ve her ruhsat formunu kendi satırından, ayrı ayrı yükleyin.",
      ],
    },
    {
      kind: "links",
      title: "Tarama için uygulamalar",
      items: [
        {
          label: "iPhone / iPad: Notlar ya da Dosyalar uygulaması",
          href: "https://support.apple.com/tr-tr/108963",
          note: "Telefonda hazır gelir, hesap gerekmez. Taramalar cihazınızda kalır; Dosyalar'a tarananlar doğrudan PDF olarak kaydedilir.",
        },
        {
          label: "Android: Google Drive ile tarama",
          href: "https://support.google.com/drive/answer/3145835?hl=tr",
          note: "Drive uygulamasında + → Tara. Birden fazla sayfayı tek PDF'te toplar; dosya Google Drive hesabınıza kaydedilir.",
        },
        {
          label: "Adobe Scan (iPhone ve Android)",
          href: "https://www.adobe.com/acrobat/mobile/scanner-app.html",
          note: "Ücretsiz. Kenar düzeltme ve gölge silme iyi çalışır; Adobe hesabıyla girilir, taramalar Adobe bulutuna yüklenir. Ücretli özelliklere gerek yok.",
        },
      ],
    },
    {
      kind: "links",
      title: "PDF'i küçültmek (4 MB üstü dosyalar için)",
      items: [
        {
          label: "Mac: Önizleme ile PDF'in büyüklüğünü azaltma",
          href: "https://support.apple.com/tr-tr/guide/preview/prvw1509/mac",
          note: "Mac'te hazır gelir; dosya bilgisayarınızdan çıkmaz.",
        },
        {
          label: "Windows: PDF24 Creator",
          href: "https://tools.pdf24.org/tr/creator",
          note: "Ücretsiz masaüstü programı; dosya bilgisayarınızda işlenir, internete yüklenmez.",
        },
        {
          label: "Tarayıcıdan: PDF24 PDF küçültme",
          href: "https://tools.pdf24.org/tr/pdf-sikistirma",
          note: "Kurulum gerektirmez. Dosya Almanya'daki sunuculara şifreli bağlantıyla yüklenir ve PDF24'e göre bir saat içinde silinir.",
        },
        {
          label: "Tarayıcıdan: iLovePDF PDF küçültme",
          href: "https://www.ilovepdf.com/tr/pdf-kucultme",
          note: "Kurulum gerektirmez. iLovePDF'e göre yüklenen dosyalar en geç iki saat içinde silinir.",
        },
      ],
    },
    {
      kind: "note",
      text: "İmzalı belgede adınız, imzanız ve diğer kişisel bilgileriniz bulunur. Mümkünse dosyanın cihazınızda kaldığı yöntemleri (telefonun kendi tarayıcısı, Önizleme, PDF24 Creator) tercih edin. Çevrimiçi bir araç kullanırsanız belgenin o şirketin sunucusuna yükleneceğini bilin ve işiniz bitince dosyayı orada silin. Bu uygulama ve siteler dergiden bağımsızdır; dergi bunlara veri göndermez.",
    },
    {
      kind: "note",
      text: "Takıldığınız bir yer olursa sağ alttaki **Sözleşme veya site sorunu? WhatsApp** düğmesiyle bize yazın. İmzalı belgeyi WhatsApp'tan göndermeyin; belgeler yalnızca paneldeki yükleme alanından iletilir.",
    },
  ],
};
