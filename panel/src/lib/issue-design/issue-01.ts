/**
 * Issue 01's designed pages — THE file to edit (D-274).
 *
 * The order of `pages` is the order in the reader. After editing:
 *
 *   1. A new page or a new picture: put the delivered .ai file in a folder and
 *      run  `pnpm render-issue-design -- --source <folder>`
 *      (add `--only <key>,<key>` to redraw only some pages). This writes
 *      `assets/issue-design/sayi-01/<key>.webp` and `renders.json`.
 *   2. Only order, titles, texts or areas changed: no redraw needed.
 *   3. Run `pnpm test`, commit, push. Then in the panel, on Issue 1's pages
 *      screen, press "Tasarım sayfalarını içe aktar / güncelle". Running it
 *      again only changes what changed: same pictures are not uploaded twice,
 *      a page removed from here leaves the issue, a new one is added.
 *
 * Areas (`areas`) use fractions of the page: rect = [x, y, width, height],
 * 0..1 from the top-left corner. Examples, not in use:
 *
 *   { kind: "page", name: "Bilim bölümüne git", rect: [0.1, 0.4, 0.3, 0.05], target: "bilim-acilis" }
 *   { kind: "link", name: "Çalma listesi", rect: [0.6, 0.9, 0.3, 0.05], url: "https://open.spotify.com/..." }
 *   { kind: "info", name: "Not", rect: [0.1, 0.1, 0.2, 0.1], title: "Başlık", body: "Metin" }
 *   { kind: "quiz", name: "Test", rect: [0.1, 0.8, 0.8, 0.1], quizTitle: "Testin panelde yazan tam adı" }
 *
 * Quizzes (`quizzes`) are written into the issue by the same button; their
 * text is in `issue-01-quizzes.ts`. A quiz is shown as a page of its own
 * (`quizPages`, D-309), placed after the picture page named in `after`, with
 * every question on the page; an area can still open one by its title.
 *
 * Why the order is what it is (2026-09-30):
 *  - Within the science section the printed page numbers decide (04 → 05 → 06);
 *    in the delivered file the order was 06, (empty 07–09), 04, 05.
 *  - Every section opener carries the printed number 04 (they were made from
 *    one template) and no contents page was delivered, so the order *between*
 *    sections is not known. It follows the magazine's area list
 *    (`DEFAULT_WRITER_AREAS`) as a changeable preview order, not an editorial one.
 *  - The two covers sit side by side in "POSTSCRIPT 01.ai" the way a wrap-around
 *    cover does: the back on the left, the front on the right. So the front
 *    comes first and the back last.
 */
import { OBSESSION_QUIZ, OBSESSION_QUIZ_TITLE } from "./issue-01-quizzes";
import type { DesignManifest } from "./manifest";

export const ISSUE_01_DESIGN: DesignManifest = {
  issueNumber: 1,
  folder: "sayi-01",
  renderWidth: 2480,
  // Six artboards have a 2–11 px strip at one side where the dark background
  // stops short of the edge (white on fashion, pop culture, sosyal feminizm,
  // tarih, yazar köşesi; a black line on the front cover). Cutting the same
  // ~0.5% from every page removes them and keeps the proportions.
  trim: { x: 12, y: 17 },
  pages: [
    {
      key: "on-kapak",
      source: "POSTSCRIPT 01.ai",
      sourcePage: 2,
      printedNumber: null,
      role: "cover",
      title: "Ön kapak",
      contents: null,
      alt: "PostScript Sayı 01 kapağı: koyu kırmızı elbiseli, siyah saçlı bir kadın göz desenli açık zeminde bir sandığın önünde oturuyor; elinde kirazlı bir kadeh.",
      transcript:
        "POSTSCRIPT. Takıntının Trajedisi — Zihnin Zahir ile imtihanı. Takıntılı Bilim İnsanları — Fizik ve Obsesyon. Sayı 01, Ekim 2026. OBSESSSION",
      areas: [],
    },
    {
      key: "bilim-acilis",
      source: "POSTSCRIPT bilim.ai",
      sourcePage: 5,
      printedNumber: 4,
      role: "page",
      title: "Bilim & Teknoloji açılışı",
      contents: "Bilim & Teknoloji",
      alt: "Bilim & Teknoloji bölüm açılışı: koyu zemin üzerinde halkalı gezegen, roket ve yıldızlarla çevrili hilal içinde bölüm adı.",
      transcript: "POSTSCRIPT. Bilim & Teknoloji. 04",
      areas: [],
    },
    {
      key: "bilim-bir-hap-05",
      source: "POSTSCRIPT bilim.ai",
      sourcePage: 6,
      printedNumber: 5,
      role: "page",
      title: "Bir hap ne zaman fazla? (05)",
      contents: "Bir Hap Ne Zaman Fazla?",
      alt: "Bilim & Teknoloji yazısının açılış sayfası: büyük italik başlık “Bir hap ne zaman fazla?”, altında metin ve köşede yere dökülmüş hap şişesi çizimi.",
      transcript: [
        "BİLİM & TEKNOLOJİ",
        "BİR HAP NE ZAMAN FAZLA?",
        "Reçete'nin öteki yüzü: İlacın tedaviden bağımlılığa uzanan sessiz yolu",
        "İlaçlar hayatımızı değiştirebilir. Peki onları ne kadar süre kullanmamız gerektiğini gerçekten biliyor muyuz?",
        "Eczanenin önünde sırasını bekleyen kadın, elindeki kâğıdı ikinci kez katlayıp açıyor. Reçetede üç ilaç var: biri tansiyonu için, biri uykusu için, biri de sinirleri için. Doktoruyla son görüşmesinde ancak birkaç dakika konuşabilmiş, birkaç dakikanın sonunda da elinde üç kutuyla muayenehaneden çıkmış. Şimdi eczanenin önünde beklerken aklından hep aynı soru geçiyor: “Bunları gerçekten bu kadar uzun süre kullanmam mı gerekiyor?”. Aynı soru Türkiye’nin herhangi bir şehrinde, herhangi bir öğleden sonra, bir başkasının da aklından geçiyordur. Belki aynı reçete başka bir doktorun masasında duruyor, belki başka bir hasta aynı kutuları alıp aynı eczanenin kapısından çıkıyor. Çünkü reçeteler uzaktan bakıldığında yalnızca birkaç ilaç isminden ibarettir: bir kâğıt, birkaç kutu, bir imza. Oysa o kâğıdın eve kadar uzanan başka bir hikâyesi vardır. Bir ilaç ne zaman tedavidir, ne zaman alışkanlığa dönüşür? İnsan, hangi noktadan sonra ilacın kendisinden çok onun yokluğundan korkmaya başlar?",
        "05",
      ].join("\n\n"),
      areas: [],
    },
    {
      key: "bilim-bir-hap-06",
      source: "POSTSCRIPT bilim.ai",
      sourcePage: 1,
      printedNumber: 6,
      role: "page",
      title: "Bir hap ne zaman fazla? (06)",
      contents: null,
      alt: "“Bir hap ne zaman fazla?” yazısının devam sayfası: iki sütun metin, solda italik sorular.",
      transcript: [
        "BİLİM & TEKNOLOJİ",
        "İlaç kullanımındaki artıştan söz edildiğinde çoğu zaman rakamlar konuşulur: sağlık harcamaları, reçete sayıları, kutu satışları, ilaç sektörünün büyüklüğü... Oysa rakamların arkasında çok daha sessiz bir hikâye vardır. İlaçların hayatımızdaki yeri kolayca inkâr edilebilecek bir şey değildir. Bir tansiyon ilacı yıllarca bir insanın hayatını koruyabilir, bir antidepresan, uzun zamandır yardım arayan birinin yeniden günlük hayatına dönmesini sağlayabilir, bir ağrı kesici dayanılmaz bir ağrıyı birkaç saatliğine bile olsa susturabilir.",
        "Modern tıp bize yalnızca hastalıklarla savaşmanın değil, hastalıklarla birlikte yaşamayı mümkün kılmanın da yollarını veriyor. Bazen aynı hikâyenin başka bir yüzü ortaya çıkıyor. Bazı ilaçlar, özellikle yanlış kullanıldığında ya da gereğinden uzun süre kullanıldığında tolerans ve fiziksel bağımlılık gibi sorunlara yol açabiliyor. Burada küçük fakat önemli bir ayrım var, uzun süre ilaç kullanan her insan bağımlı değildir. Özellikle antidepresanlar söz konusu olduğunda ilaç kullanmakla bağımlı olmak aynı şey değildir. Antidepresanların önemli bir bölümü klasik anlamda bağımlılık oluşturmaz, yalnızca bazıları aniden bırakıldığında kesilme belirtilerine yol açabilir. Yani mesele yalnızca ilacın kendisi değildir.",
        "Hangi ilaç? Hangi doz? Ne kadar süre?",
        "En önemlisi: Kim tarafından, nasıl takip edilerek? Türkiye’de ilaç tüketimindeki büyük artış da tam bu noktada düşündürücü hâle geliyor. Özellikle antidepresan kullanımının son yirmi yılda ciddi biçimde yükselmesi, toplumun ruh sağlığıyla kurduğu ilişkinin değiştiğini gösteriyor. Ama bu artışın tamamını “ilaç bağımlılığı” olarak okumak kolaycılık olur. Belki artık ruhsal hastalıkları daha iyi tanıyoruz, belki insanlar psikiyatrik yardım almaktan eskisi kadar çekinmiyor, belki sağlık hizmetlerine erişim arttı ve daha önce tedavi görmeyen insanlar artık tedaviye ulaşabiliyor. Yine de rakamların önümüze bıraktığı başka bir soru var: İnsanlar gerçekten daha mı hasta, yoksa artık her sıkıntının karşılığını bir reçetede mi arıyoruz?",
        "Modern tıp ağrıyı azaltabiliyor, uykuyu düzenleyebiliyor, kaygıyı kontrol altına alabiliyor, kronik hastalıkların ilerlemesini yavaşlatabiliyor. Bunların her biri başlı başına büyük bir başarı. Fakat tıbbın bize sunduğu bu kolaylık, garip bir paradoksu da beraberinde getiriyor: bir ilaç ne kadar kolay ulaşılabilir ve etkiliyse, onu hayatımızdaki her türlü rahatsızlığa karşı ilk çözüm olarak görme ihtimalimiz de o kadar artabiliyor.",
        "06",
      ].join("\n\n"),
      areas: [],
    },
    opener("psikoloji-acilis", "POSTSCRIPT psikoloj.ai", "Psikoloji ve İlişkiler", "karalama çizgilerden oluşan bir kadın başı profili ve yanında düğümlenmiş bir kalp"),
    opener("film-dizi-kitap-acilis", "POSTSCRIPT film dizi kitap.ai", "Film, Dizi & Kitap", "altın rengi süslü bir çerçevenin içinde eski bir televizyon ve üst üste kitaplar"),
    opener("sanat-edebiyat-acilis", "POSTSCRIPT sanat edebiyat.ai", "Sanat & Edebiyat", "açık bir kitabın üzerinde boya kutuları, tüpler, uçuşan harfler ve kırmızı bir heykel figürü"),
    opener("pop-culture-acilis", "POSTSCRIPT pop culture.ai", "Pop Culture", "topuzlu, inci kolyeli bir kadın sakız balonu şişiriyor; çevresinde plaklar, “On Air” tabelası ve damalı şerit"),
    opener("tarih-dunya-acilis", "tarih dünya.ai", "Tarih & Dünya", "eski bir dünya haritası dairesinin içinde Kolezyum, cep saati ve bir asker figürü"),
    opener("sosyal-feminizm-acilis", "sosyal feminizm.ai", "Sosyal & Feminizm", "yan yana duran kadınlar “Women” ve “Break the silence, end violence!” yazılı pankartlar taşıyor, üstte kalkmış bir yumruk"),
    opener("sosyoloji-dusunce-acilis", "POSTSCRIPT sosyoloji düşünce.ai", "Sosyoloji & Düşünce", "dalgalanan bir bayrağın üzerinde Düşünen Adam heykeli ve konuşma balonu"),
    opener("fashion-lifestyle-acilis", "POSTSCRIPT fashion.ai", "Fashion & Lifestyle", "kabarık etekli bir terzi mankeni silüetinin içinde askıda kırmızı elbise ve alışveriş çantaları"),
    opener("yazar-kosesi-acilis", "yazar köşesi.ai", "Yazar Köşesi: PostScript", "bir kadın başı silüetinin içinde eski bir daktilo; kâğıtta “Yazar Köşesi: PostScript” yazıyor"),
    // The quiz is the page after this one (`quizPages`), not a hidden area on it (D-309)
    opener("eglence-dedikodu-acilis", "eğlence dedikodu.ai", "Eğlence & Dedikodu", "büyük bir yıldızın önünde eski tip bir telefon ve “Have Fun” yazısı"),
    {
      key: "arka-kapak",
      source: "POSTSCRIPT 01.ai",
      sourcePage: 1,
      printedNumber: null,
      role: "back_cover",
      title: "Arka kapak",
      contents: null,
      alt: "Arka kapak: kırmızı bir koltukta telefonun başında bir kadın, duvarda notlarla dolu bir pano, önde buruşuk kâğıtlarla dolu çöp kutusu. Altta “The things left unsaid”.",
      transcript: "Kapak Çizerleri: Tua ve Aysalita. The things left unsaid",
      areas: [],
    },
  ],
  quizzes: [OBSESSION_QUIZ],
  // No quiz page was designed, so the reader draws it in the magazine's type
  quizPages: [
    {
      key: "eglence-dedikodu-test",
      after: "eglence-dedikodu-acilis",
      title: "Test: Hangi kurgusal karakterin takıntısına sahipsin?",
      contents: OBSESSION_QUIZ_TITLE,
      section: "Eğlence & Dedikodu",
      quizTitle: OBSESSION_QUIZ_TITLE,
    },
  ],
  excluded: [
    { source: "POSTSCRIPT 01.ai", pages: [3, 4, 5, 6], reason: "Tamamen boş beyaz sayfa." },
    {
      source: "POSTSCRIPT bilim.ai",
      pages: [2, 3, 4],
      reason: "Boş şablon (07/08/09): yalnızca üst başlık, kırmızı yay ve sayfa numarası.",
    },
    ...[
      "POSTSCRIPT fashion.ai",
      "POSTSCRIPT film dizi kitap.ai",
      "POSTSCRIPT pop culture.ai",
      "POSTSCRIPT psikoloj.ai",
      "POSTSCRIPT sanat edebiyat.ai",
      "POSTSCRIPT sosyoloji düşünce.ai",
      "eğlence dedikodu.ai",
      "sosyal feminizm.ai",
      "tarih dünya.ai",
      "yazar köşesi.ai",
    ].map((source) => ({
      source,
      pages: [1, 2, 3, 4, 6],
      reason:
        "Bilim dosyasındaki boş şablonun piksel piksel aynısı (07/08, “BİLİM & TEKNOLOJİ” başlıklı, içerik yok).",
    })),
  ],
};

/** A section opener: page 5 of its file, printed number 04 in every file. */
function opener(key: string, source: string, section: string, picture: string): DesignManifest["pages"][number] {
  return {
    key,
    source,
    sourcePage: 5,
    printedNumber: 4,
    role: "page",
    title: `${section} açılışı`,
    contents: section,
    alt: `${section} bölüm açılışı: koyu zemin üzerinde ${picture}.`,
    transcript: `POSTSCRIPT. ${section}. 04`,
    areas: [],
  };
}
