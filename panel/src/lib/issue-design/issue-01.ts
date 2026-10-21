/**
 * Issue 01's designed pages — THE file to edit (D-274, D-323, D-342).
 *
 * The order of `pages` is the order in the reader. After editing:
 *
 *   1. A new page or a new picture: put the delivered .ai file in a folder and
 *      run  `pnpm render-issue-design -- --source <folder>`
 *      (add `--only <key>,<key>` to redraw only some pages), then
 *      `pnpm issue-design-variants`. This writes
 *      `assets/issue-design/sayi-01/<key>.webp`, its smaller copies and
 *      `renders.json`.
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
 * Why the order is what it is (the revision delivered 2026-10-21, D-342):
 *  - The articles were reset to fit fewer pages, so the printed numbers now
 *    run 08–55 and every section has one unnumbered illustration page
 *    ("Çizer"). With no number to place it by, the illustration closes its
 *    section.
 *  - Within a file the artboards are not in page order (the opener is the 5th
 *    artboard, the page after it the 6th, then the 1st–4th); the printed
 *    number wins over the artboard order.
 *  - Unused white artboards and a leftover blank template page are left out
 *    (`excluded`).
 *  - The front matter has no printed numbers. The memorial page stays right
 *    after the cover, where an admin put it by hand after the first import
 *    (D-324), then the letter, the two contents pages and the new masthead.
 *    The new "next issue" page comes last, before the back cover.
 *  - The two covers sit side by side in "POSTSCRIPT 01.ai" the way a wrap-around
 *    cover does: the back on the left, the front on the right. So the front
 *    comes first and the back last.
 */
import { OBSESSION_QUIZ, OBSESSION_QUIZ_TITLE } from "./issue-01-quizzes";
import { ISSUE_01_TRANSCRIPTS } from "./issue-01-transcripts";
import type { DesignManifest } from "./manifest";

type Page = DesignManifest["pages"][number];

export const ISSUE_01_DESIGN: DesignManifest = {
  issueNumber: 1,
  folder: "sayi-01",
  renderWidth: 2480,
  // Some artboards have a 2–11 px strip at one side where the dark background
  // stops short of the edge. Cutting the same ~0.5% from every page removes
  // them and keeps the proportions.
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
      alt: "PostScript Sayı 01 kapağı: kırmızı kazaklı, uzun sarı saçlı, yeşil gözlü bir kadın gözyaşları içinde gülümsüyor, iki elini göğsünde yumruk yapmış.",
      transcript:
        "POSTSCRIPT. Takıntının Trajedisi — Zihnin Zahir ile imtihanı. Takıntılı Bilim İnsanları — Fizik ve Obsesyon. Sayı 01, Ekim 2026. OBSESSSION",
      areas: [],
    },
    {
      key: "anma",
      source: "POSTSCRIPT 01.ai",
      sourcePage: 8,
      printedNumber: null,
      role: "page",
      title: "Hayatı yarım bırakılanlar için",
      contents: "Hayatı Yarım Bırakılanlar İçin",
      alt: "Siyah zeminde kırmızı yazılarla bir anma metni; altında bir kadın sembolünün içinde kalkmış yumruk.",
      transcript: [
        "BU SAYFA HAYATI YARIM BIRAKILANLAR İÇİN.",
        "Hikâyesini anlatamayan, yazısını tamamlayamayan, sesini duyuramayan, adı bir haberde birkaç satıra sığdırılan kız kardeşlerimiz için bu sayfayı boş bırakıyoruz.",
        "Çünkü burada olması gereken sözleri onların yazması gerekiyordu.",
      ].join("\n\n"),
      areas: [],
    },
    {
      key: "sunus",
      source: "POSTSCRIPT 01.ai",
      sourcePage: 5,
      printedNumber: null,
      role: "page",
      title: "Sunuş: Merhaba!",
      contents: "Sunuş",
      alt: "Sunuş yazısı: mum, eski anahtarlar ve kuru çiçeklerle çevrili bordo bir zarfın içinde PostScript logolu bir mektup; altında “The things left unsaid…” yazısı.",
      transcript: [
        "POSTSCRIPT",
        "Merhaba!",
        "Bu sayıyı hazırlarken en çok şunu düşündük: Biz nasıl bir dergi okumak isterdik? İçinde merak ettiğimiz konuların, farklı fikirlerin ve “Bunu ben de düşünüyorum!” diyeceğimiz yazıların olduğu bir dergi…",
        "Bu sorudan yola çıktık; konuştuk, yazdık, sildik ve yeniden denedik. Her birimizden bir şeyler taşıyan bu sayfaları şimdi sizinle paylaşıyoruz.",
        "Umarız okurken kendinize yakın bir ses bulur, belki de daha önce hiç düşünmediğiniz bir konuya takılırsınız. Umarız söyleyemediğiniz cümleleri burada sizin için söyleyebiliyoruzdur. Bu derginin hazırlanmasında bizim kadar, okunmasında da sizin payınız var.",
        "İyi ki buradasınız. Keyifli okumalar!",
        "Postscript Ekibi",
        "The things left unsaid…",
      ].join("\n\n"),
      areas: [],
    },
    {
      key: "icindekiler-1",
      source: "POSTSCRIPT 01.ai",
      sourcePage: 3,
      printedNumber: null,
      role: "page",
      title: "İçindekiler (1/2)",
      contents: "İçindekiler",
      alt: "İçindekiler sayfasının ilki: mum ışığında bir büst, eski kitaplar ve kuru çiçeklerle dolu karanlık bir masanın üzerinde 01 Bilim & Teknoloji'den 05 Pop Culture'a bölümler ve yazı başlıkları.",
      transcript: [
        "İÇİNDEKİLER",
        "01 — BİLİM & TEKNOLOJİ: Çekimin Saplantılı Hali: Karadelikler ve Toksik İlişkiler. Bilim İnsanları ve Obsesyon. Reçetenin Öteki Yüzü: İlacın Tedaviden Bağımlılığa Uzanan Sessiz Yolu. Almanya'nın Volkswagen Takıntısı.",
        "02 — PSİKOLOJİ & İLİŞKİLER: İyileşmek Öyle Değil, Böyle Olur! Düşünmemeye Çalıştıkça Neden Daha Çok Düşünürüz? Büyük Dansa Karşı Koymak.",
        "03 — FİLM, DİZİ & KİTAP: Saplantının Çekici Yüzü: Gudd'ın 41 Ödüllü Travması. Başarmak Uğruna Nelerden Vazgeçebilirsin? Eşyaların Gölgesinde Saklanan Bir Cinnet: Masumiyet Müzesi ve Kemal'in Takıntısı.",
        "04 — SANAT & EDEBİYAT: Bir Başkasının Umudu, Bir Başkasının Kabusu: Ron Francis ve Takıntının Anatomisi. Üç Kalem. Girilmez. Şiir Köşesi.",
        "05 — POP CULTURE: Stalker? Stan? Gözümüz Üzerinizde: Diana'dan Algoritmalara Röntgen Kültürü. Ne Zamana Kadar Benlesin?",
      ].join("\n\n"),
      areas: [],
    },
    {
      key: "icindekiler-2",
      source: "POSTSCRIPT 01.ai",
      sourcePage: 4,
      printedNumber: null,
      role: "page",
      title: "İçindekiler (2/2)",
      contents: null,
      alt: "İçindekiler sayfasının ikincisi: mum, oyun kartları, kilit ve anahtarlarla dolu karanlık bir masanın üzerinde 06 Tarih & Dünya'dan 11 Eğlence & Dedikodu'ya bölümler ve yazı başlıkları.",
      transcript: [
        "İÇİNDEKİLER",
        "06 — TARİH & DÜNYA: Yıkımdan İkona: Ananke'nin Hikayesi. Potsdam Devleri ve Kusursuzluk Hastalığı. Ölmek ya da Ölmemek — İşte Tüm Takıntı Bu.",
        "07 — SOSYAL & FEMİNİZM: Zayıflık Takıntısı. Mükemmel Kadınlığın Cenderesi. Meta, Metalaştırmak, Metalaştırılmak!",
        "08 — SOSYOLOJİ & DÜŞÜNCE: İlgi ile İhlal Arasında. Eskiden Her Şey Gerçekten Daha mı Güzeldi?: Hiç Yaşamadığımız Günlerin Özlemi. Obsessio' Zihinsel Abluka.",
        "09 — LIFESTYLE & FASHION: Dijital Takıntı. Bir Parçanın Peşinden Gitmek. El Alem Ne Giyer?",
        "10 — YAZAR KÖŞESİ: “P.S.”: Takıntı: Kar Tanesi ve Zihnin Sonsuz Fraktalı. Susamayan Zihinlerin Yankısı. Takıntının Trajedisi: Zihnin Zahir'le İmtihanı.",
        "11 — EĞLENCE & DEDİKODU: Hangi Takıntılı Karaktersin? QUIZ! Başarı Takıntısı Grubun Önüne Geçer mi? Çay Koy Yeniden Başlayalım: Bir Fincandaki Gizli Şifa.",
      ].join("\n\n"),
      areas: [],
    },
    {
      key: "kunye",
      source: "POSTSCRIPT 01.ai",
      sourcePage: 6,
      printedNumber: null,
      role: "page",
      title: "Künye",
      contents: "Künye",
      alt: "Künye: mum ışığında bordo perdeler, eski kitaplar ve anahtarlar arasında oval bir çerçevenin içinde dergi ekibinin adları.",
      transcript: [
        "Genel Yayın Yönetmenleri: Tuanna Demir & Elif Yaren Çekiç",
        "Editör: Beyza Gündüz, Sıla Çapan, Şevval Adıgüzel, Ezgi Apaydın",
        "Çizer: Tuanna Demir, Berkin Akkır, Yasemin Akbaş",
        "Grafik Tasarım: Tuanna Demir",
      ].join("\n\n"),
      areas: [],
    },
    ...section("bilim", "POSTSCRIPT bilim.ai", "Bilim & Teknoloji", "halkalı gezegen, roket ve yıldızlarla çevrili bir hilal",
      [
        [6, 9, "Çekimin Saplantılı Hali: Karadelikler ve Toksik İlişkiler"],
        [1, 10, "Bilim İnsanları ve Obsesyon"],
        [2, 11, "Reçetenin Öteki Yüzü: İlacın Tedaviden Bağımlılığa Uzanan Sessiz Yolu"],
        [3, 12, null],
        [4, 13, "Almanya'nın Volkswagen Takıntısı"],
      ],
      [7, "Berkin Akkır", "Başarmanın Stresi", "bir adam, kâğıtlar ve kıvılcım saçan bir deney düzeneğiyle dolu masasında başını elleri arasına almış"]),
    ...section("psikoloji", "POSTSCRIPT psikoloj.ai", "Psikoloji & İlişkiler", "karalama çizgilerden oluşan bir kadın başı profili ve yanında düğümlenmiş bir kalp",
      [
        [6, 15, "İyileşmek Öyle Değil, Böyle Olur!"],
        [1, 16, "Düşünmemeye Çalıştıkça Neden Daha Çok Düşünürüz?"],
        [2, 17, "Büyük Dansa Karşı Koymak"],
        [3, 18, null],
      ],
      [4, "Yasemin Akbaş", "Ya Benimsin Ya da Benim", "bordo elbiseli sarışın bir kadın ile mavi giysili bir figür birbirine zincirle bağlanmış"]),
    ...section("film-dizi-kitap", "POSTSCRIPT film dizi kitap.ai", "Film, Dizi & Kitap", "altın rengi süslü bir çerçevenin içinde eski bir televizyon ve üst üste kitaplar",
      [
        [6, 20, "Başarmak Uğruna Nelerden Vazgeçebilirsin?"],
        [1, 21, "Saplantının Çekici Yüzü: Gudd'ın 41 Ödüllü Travması"],
        [2, 22, "Eşyaların Gölgesinde Saklanan Bir Cinnet: Masumiyet Müzesi ve Kemal'in Takıntısı"],
      ],
      [3, "Berkin Akkır", "Sonsuza Dek Takıntılı", "makyajı akmış, koyu saçlı bir kadın karanlıkta ürkütücü biçimde gülümsüyor"]),
    ...section("sanat-edebiyat", "POSTSCRIPT sanat edebiyat.ai", "Sanat & Edebiyat", "açık bir kitabın üzerinde boya kutuları, tüpler, uçuşan harfler ve kırmızı bir heykel figürü",
      [
        [6, 24, "Bir Başkasının Umudu, Bir Başkasının Kabusu: Ron Francis ve Takıntının Anatomisi"],
        [1, 25, "Üç Kalem"],
        [2, 26, "Girilmez"],
        [3, 27, "Şiir Köşesi"],
      ],
      [4, "Berkin Akkır", "Takıntıya Bağlılık", "koyu bordo zeminde, havada savrulan çıplak, soluk tenli bir figür"]),
    ...section("pop-culture", "POSTSCRIPT pop culture.ai", "Pop Culture", "topuzlu, inci kolyeli bir kadın sakız balonu şişiriyor; çevresinde plaklar, “On Air” tabelası ve damalı şerit",
      [
        [6, 29, "Stalker? Stan?"],
        [1, 30, "Gözümüz Üzerinizde: Diana'dan Algoritmalara Röntgen Kültürü"],
        [2, 31, "Ne Zamana Kadar Benlesin?"],
      ],
      [3, "Berkin Akkır", "Hayranın Tükettiği Sanatçı", "üstte pembe elbiseli bir figür, altta yüzü görünmeyen çıplak bir beden siyah bir mikrofonu iki eliyle göğsüne bastırıyor"]),
    ...section("tarih-dunya", "tarih dünya.ai", "Tarih & Dünya", "eski bir dünya haritası dairesinin içinde Kolezyum, cep saati ve bir asker figürü",
      [
        [6, 33, "Yıkımdan İkona: Ananke'nin Hikayesi"],
        [1, 34, "Potsdam Devleri ve Kusursuzluk Hastalığı"],
        [2, 35, "Ölmek ya da Ölmemek — İşte Tüm Takıntı Bu"],
      ],
      [3, "Berkin Akkır", "Fatih'in Viyana'ya Takıntısı", "loş bir sarayda, pencereden giren ışığın altında oturan sarıklı, kürk kaftanlı bir padişah"]),
    ...section("sosyal-feminizm", "sosyal feminizm.ai", "Sosyal & Feminizm", "yan yana duran kadınlar “Women” ve “Break the silence, end violence!” yazılı pankartlar taşıyor, üstte kalkmış bir yumruk",
      [
        [6, 37, "Zayıflık Takıntısı"],
        [1, 38, "Mükemmel Kadınlığın Cenderesi"],
        [2, 39, "Meta, Metalaştırmak, Metalaştırılmak!"],
      ],
      [3, "Berkin Akkır", "Gerçekten Biz miyiz?", "bordo bir halenin içinde beyaz bir kadın figürü; aşağıdan uzanan eller ona ruj, tava ve ev aletleri uzatıyor"]),
    ...section("sosyoloji-dusunce", "POSTSCRIPT sosyoloji düşünce.ai", "Sosyoloji & Düşünce", "dalgalanan bir bayrağın üzerinde Düşünen Adam heykeli ve uçuşan harfler",
      [
        [6, 41, "İlgi ile İhlal Arasında"],
        [1, 42, "Eskiden Her Şey Gerçekten Daha mı Güzeldi?: Hiç Yaşamadığımız Günlerin Özlemi"],
        [2, 43, "Obsessio' Zihinsel Abluka"],
      ],
      [3, "Yasemin Akbaş", "Herkes Düşünüyorsa Doğrudur", "aynaya bakan sarışın bir kadın: aynadaki yansıması kusursuz, kendisinin dudağı kanıyor"]),
    ...section("fashion-lifestyle", "POSTSCRIPT fashion.ai", "Fashion & Lifestyle", "kabarık etekli bir terzi mankeni silüetinin içinde askıda kırmızı elbise ve alışveriş çantaları",
      [
        [6, 45, "Dijital Takıntı"],
        [1, 46, "Bir Parçanın Peşinden Gitmek"],
        [2, 47, "“Aesthetic” Hayatlar"],
        [3, 48, "El Alem Ne Giyer?"],
      ],
      [4, "Yasemin Akbaş", "Pinterest Kızı", "pembe zeminde, yeşil bir içecek bardağının kenarında oturan kırmızı elbiseli sarışın bir kadın"]),
    ...section("yazar-kosesi", "yazar köşesi.ai", "Yazar Köşesi: PostScript", "bir kadın başı silüetinin içinde eski bir daktilo; kâğıtta “Yazar Köşesi: PostScript” yazıyor",
      [
        [6, 50, "Takıntı: Kar Tanesi ve Zihnin Sonsuz Fraktalı"],
        [1, 51, "Susamayan Zihinlerin Yankısı"],
        [2, 52, "Takıntının Trajedisi: Zihnin Zahir'le İmtihanı"],
      ],
      [3, "Yasemin Akbaş", "Seni İzliyorum", "karanlık bir odada ekranın mavi ışığına bakan bir silüet; masada kapağında bir kadın olan bir PostScript dergisi"]),
    // The quiz is the page after the opener (`quizPages`), not a hidden area on it (D-309)
    ...section("eglence-dedikodu", "eğlence dedikodu.ai", "Eğlence & Dedikodu", "büyük bir yıldızın önünde eski tip bir telefon ve “Have Fun” yazısı",
      [
        [6, 54, "Başarı Takıntısı Grubun Önüne Geçer mi?"],
        [1, 55, "Çay Koy Yeniden Başlayalım: Bir Fincandaki Gizli Şifa"],
      ],
      [2, "Yasemin Akbaş", "Alo?", "yeşil gözlü sarışın bir kadın, mor bir telefon ahizesini yüzüne yaslamış, geniş geniş gülümsüyor"]),
    {
      key: "gelecek-sayi",
      source: "POSTSCRIPT 01.ai",
      sourcePage: 7,
      printedNumber: null,
      role: "page",
      title: "Gelecek sayı: Gothic",
      contents: "Gelecek Sayı",
      alt: "Gelecek sayı duyurusu: krem zeminde süslü bir çerçevenin içinde “Next Issue”, ortada uzun, süslü bir anahtar; altta telif notu.",
      transcript: [
        "NEXT ISSUE",
        "Gelecek Sayı: GOTHIC",
        "Yayın Tarihi: 05 Kasım",
        "Tüm hakları saklıdır. Bu dergide yer alan yazı, görsel ve tasarımların izin alınmadan kısmen veya tamamen çoğaltılması, kopyalanması ve yayımlanması yasaktır.",
        "© 2026 PostscriptMagazine.",
      ].join("\n\n"),
      areas: [],
    },
    {
      key: "arka-kapak",
      source: "POSTSCRIPT 01.ai",
      sourcePage: 1,
      printedNumber: null,
      role: "back_cover",
      title: "Arka kapak",
      contents: null,
      alt: "Arka kapak: kırmızı tişörtlü, dağınık koyu saçlı bir genç dehşet içinde bağırıyor; arkasındaki duvarda kırmızı iplerle birbirine bağlanmış notlar ve fotoğraflar. Altta “The things left unsaid”.",
      transcript: "The things left unsaid. Kapak Çizeri: Tuanna Demir",
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
    { source: "POSTSCRIPT film dizi kitap.ai", pages: [4], reason: "Boş, beyaz çizim alanı." },
    { source: "POSTSCRIPT pop culture.ai", pages: [4], reason: "Boş, beyaz çizim alanı." },
    { source: "tarih dünya.ai", pages: [4], reason: "Boş, beyaz çizim alanı." },
    { source: "sosyal feminizm.ai", pages: [4], reason: "Boş, beyaz çizim alanı." },
    { source: "POSTSCRIPT sosyoloji düşünce.ai", pages: [4], reason: "Boş, beyaz çizim alanı." },
    { source: "eğlence dedikodu.ai", pages: [3, 4], reason: "Boş, beyaz çizim alanları." },
    {
      source: "yazar köşesi.ai",
      pages: [4],
      reason: "Yalnızca bölüm başlığı ve 51 numarası olan boş şablon; 51 numaralı yazı 1. çizim alanında.",
    },
  ],
};

/** A written page: [artboard, printed number, its line in the reader's contents or null]. */
type Written = [sourcePage: number, printed: number, contents: string | null];
/** The section's illustration: [artboard, illustrator, the title on the picture, what it shows]. */
type Illustration = [sourcePage: number, artist: string, title: string, picture: string];

/**
 * A section of the revision delivered on 2026-10-21 (D-342): the opener (the
 * 5th artboard, printed one number before the first written page), its
 * written pages in printed order, then the illustration page, which carries
 * no number. Every text is in `issue-01-transcripts.ts` under the page's key.
 */
function section(
  prefix: string,
  source: string,
  name: string,
  openerPicture: string,
  written: Written[],
  [cizerPage, artist, cizerTitle, cizerPicture]: Illustration,
): Page[] {
  const openerNumber = written[0]![1] - 1;
  const opener: Page = {
    key: `${prefix}-acilis`,
    source,
    sourcePage: 5,
    printedNumber: openerNumber,
    role: "page",
    title: `${name} açılışı`,
    contents: name,
    alt: `${name} bölüm açılışı: desenli bordo halı zemin üzerinde PostScript logosu ve ${openerPicture}.`,
    transcript: `POSTSCRIPT. ${name}. ${pad(openerNumber)}`,
    areas: [],
  };
  const pages = written.map(([sourcePage, printed, contents]): Page => {
    const key = `${prefix}-${pad(printed)}`;
    return {
      key,
      source,
      sourcePage,
      printedNumber: printed,
      role: "page",
      title: contents ? `${name} · ${pad(printed)} · ${contents}`.slice(0, 90) : `${name} · ${pad(printed)} (devam)`,
      contents,
      alt: contents
        ? `${name} bölümünün ${pad(printed)} numaralı sayfası: “${contents}” yazısı; metni ekran okuyucu metninde.`
        : `${name} bölümünün ${pad(printed)} numaralı sayfası: önceki yazının devamı; metni ekran okuyucu metninde.`,
      transcript: textOf(key),
      areas: [],
    };
  });
  const key = `${prefix}-cizer`;
  const illustration: Page = {
    key,
    source,
    sourcePage: cizerPage,
    printedNumber: null,
    role: "page",
    title: `${name} · çizim: ${cizerTitle}`,
    contents: null,
    alt: `${artist} imzalı “${cizerTitle}” çizimi: ${cizerPicture}. Üstte bir alıntı; metni ekran okuyucu metninde.`,
    transcript: textOf(key),
    areas: [],
  };
  return [opener, ...pages, illustration];
}

function textOf(key: string): string {
  const text = ISSUE_01_TRANSCRIPTS[key];
  if (!text) throw new Error(`"${key}" sayfasının metni issue-01-transcripts.ts içinde yok.`);
  return text;
}

function pad(number: number): string {
  return String(number).padStart(2, "0");
}
