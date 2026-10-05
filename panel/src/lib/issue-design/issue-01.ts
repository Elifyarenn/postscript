/**
 * Issue 01's designed pages — THE file to edit (D-274, D-323).
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
 * Why the order is what it is (2026-10-05, the files delivered that day):
 *  - Every page of the twelve files is in, the empty ones too (D-323): a
 *    section's unwritten pages are its numbered blank template pages.
 *  - The pages carry their printed numbers 04–69 and the two contents pages
 *    list the sections 01–11 in the same order, so both decide.
 *  - Within a file the artboards are not in page order (the opener is the 5th
 *    artboard, the page after it the 6th, then the 1st–4th); the printed
 *    number wins over the artboard order.
 *  - Psychology is the one section whose numbers were not updated: its opener
 *    still says 04 and its pages 07/08 under a "BİLİM & TEKNOLOJİ" header.
 *    It sits where its contents number (02) and the gap 10–15 put it, and its
 *    pages follow the text, which runs on from one page to the next.
 *  - The front matter has no printed numbers. Its order is the one an admin
 *    set by hand in the panel after the first import (D-324): the memorial
 *    page right after the cover, then the letter and the two contents pages.
 *  - The two covers sit side by side in "POSTSCRIPT 01.ai" the way a wrap-around
 *    cover does: the back on the left, the front on the right. So the front
 *    comes first and the back last.
 */
import { OBSESSION_QUIZ, OBSESSION_QUIZ_TITLE } from "./issue-01-quizzes";
import { ISSUE_01_SECTION_TRANSCRIPTS } from "./issue-01-section-transcripts";
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
      sourcePage: 5,
      printedNumber: null,
      role: "page",
      title: "Hayatı yarım bırakılanlar için",
      contents: "Hayatı Yarım Bırakılanlar İçin",
      alt: "Siyah zeminde kırmızı yazılarla bir anma metni; altında iki kadın sembolünün içinde kalkmış yumruk.",
      transcript: [
        "BU SAYFA HAYATI YARIM BIRAKILANLAR İÇİN.",
        "Hikâyesini anlatamayan, yazısını tamamlayamayan, sesini duyuramayan, adı bir haberde birkaç satıra sığdırılan kız kardeşlerimiz için bu sayfayı boş bırakıyoruz.",
        "Çünkü burada olması gereken sözleri onların yazması gerekiyordu.",
      ].join("\n\n"),
      areas: [],
      // The file has the text twice, the 2nd copy 316 pt lower over the symbol (D-324)
      omitTextObjects: [3, 4],
    },
    {
      key: "sunus",
      source: "POSTSCRIPT 01.ai",
      sourcePage: 6,
      printedNumber: null,
      role: "page",
      title: "Sunuş: Merhaba!",
      contents: "Sunuş",
      alt: "Sunuş yazısı: koyu bordo zeminde PostScript logosu, altında çerçeve içinde ekibin okura mektubu ve “The things left unsaid…” yazısı.",
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
      alt: "İçindekiler sayfasının ilki: açık zeminde 01 Bilim & Teknoloji'den 05 Pop Culture'a bölümler ve yazı başlıkları.",
      transcript: [
        "İÇİNDEKİLER",
        "01 — BİLİM & TEKNOLOJİ: Bilim İnsanları ve Obsesyon. Çekimin Saplantılı Hali: Karadelikler ve Toksik İlişkiler. Reçetenin Öteki Yüzü: İlacın Tedaviden Bağımlılığa Uzanan Sessiz Yolu. Almanya'nın Volkswagen Takıntısı.",
        "02 — PSİKOLOJİ & İLİŞKİLER: İyileşmek Öyle Değil, Böyle Olur! Düşünmemeye Çalıştıkça Neden Daha Çok Düşünürüz? Büyük Dansa Karşı Koymak.",
        "03 — FİLM, DİZİ & KİTAP: Eşyaların Gölgesinde Saklanan Bir Cinnet: Masumiyet Müzesi ve Kemal'in Takıntısı. Saplantının Çekici Yüzü: Gudd'ın 41 Ödüllü Travması. Başarmak Uğruna Nelerden Vazgeçebilirsin?",
        "04 — SANAT & EDEBİYAT: Girilmez. Bir Başkasının Umudu, Bir Başkasının Kabusu: Ron Francis ve Takıntının Anatomisi. Üç Kalem. Ayın Şiiri.",
        "05 — POP CULTURE: Ne Zamana Kadar Benlesin? Stalker? Stan? Gözümüz Üzerinizde: Diana'dan Algoritmalara Röntgen Kültürü.",
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
      alt: "İçindekiler sayfasının ikincisi: açık zeminde 06 Tarih & Dünya'dan 11 Eğlence & Dedikodu'ya bölümler ve yazı başlıkları.",
      transcript: [
        "İÇİNDEKİLER",
        "06 — TARİH & DÜNYA: Yıkımdan İkona: Ananke'nin Hikayesi. Potsdam Devleri ve Kusursuzluk Hastalığı. Ölmek ya da Ölmemek — İşte Tüm Takıntı Bu.",
        "07 — SOSYAL & FEMİNİZM: Zayıflık Takıntısı. Meta, Metalaştırmak, Metalaştırılmak! Mükemmel Kadınlığın Cenderesi.",
        "08 — SOSYOLOJİ & DÜŞÜNCE: Obsessio' Zihinsel Abluka. Eskiden Her Şey Gerçekten Daha mı Güzeldi?: Hiç Yaşamadığımız Günlerin Özlemi. İlgi ile İhlal Arasında.",
        "09 — LIFESTYLE & FASHION: El Alem Ne Giyer? Bir Parçanın Peşinden Gitmek. “Aesthetic” Hayatlar. Skincare: Cilt Bakımı mı, Cilt Takıntısı mı. Parfüm: Bir Takıntının Kokusu. Dijital Takıntı. Takıntıdan Dönüşen Stil: Streetwear.",
        "10 — YAZAR KÖŞESİ: “P.S.”: Takıntının Trajedisi: Zihnin Zahir'le İmtihanı. Takıntı: Kar Tanesi ve Zihnin Sonsuz Fraktalı. Susamayan Zihinlerin Yankısı.",
        "11 — EĞLENCE & DEDİKODU: Başarı Takıntısı Grubun Önüne Geçer mi? Çay Koy Yeniden Başlayalım: Bir Fincandaki Gizli Şifa. Hangi Takıntılı Karaktersin? QUIZ!",
      ].join("\n\n"),
      areas: [],
    },
    opener("bilim-acilis", "POSTSCRIPT bilim.ai", 5, 4, "Bilim & Teknoloji", "halkalı gezegen, roket ve yıldızlarla çevrili hilal içinde bölüm adı"),
    article("bilim-karadelik-05", "POSTSCRIPT bilim.ai", 6, 5, "Ya bir karadeliğe değil, bir ilişkiye çekiliyorsanız?",
      "Çekimin Saplantılı Hali: Karadelikler ve Toksik İlişkiler",
      "Bilim & Teknoloji yazısı “Ya bir karadeliğe değil, bir ilişkiye çekiliyorsanız?”: solda başlık ve metin, sağ üstte bordo yarım daire içinde yazının girişi, altta iki sütun metin."),
    article("bilim-takinti-basari-06", "POSTSCRIPT bilim.ai", 1, 6, "Takıntı, başarının sırrı olabilir mi?",
      "Bilim İnsanları ve Obsesyon",
      "Bilim & Teknoloji yazısı “Takıntı, başarının sırrı olabilir mi?”: sol üstte bordo yarım daire içinde yazının girişi, sağda başlık, iki sütun metin."),
    article("bilim-bir-hap-07", "POSTSCRIPT bilim.ai", 2, 7, "Bir hap ne zaman fazla?",
      "Reçetenin Öteki Yüzü: İlacın Tedaviden Bağımlılığa Uzanan Sessiz Yolu",
      "Önceki yazının sonu ve “Bir hap ne zaman fazla?” yazısının başlangıcı: iki sütun metin, sağ altta yere dökülmüş hap şişesi çizimi."),
    article("bilim-bir-hap-08", "POSTSCRIPT bilim.ai", 3, 8, "Bir hap ne zaman fazla? (devam)", null,
      "“Bir hap ne zaman fazla?” yazısının devamı: sol üstte bordo yarım daire içinde yazının girişi, iki sütun metin ve iki vurgulu soru satırı."),
    article("bilim-volkswagen-09", "POSTSCRIPT bilim.ai", 4, 9, "Volkswagen Almanya için sadece bir otomobil mi?",
      "Almanya'nın Volkswagen Takıntısı",
      "Bilim & Teknoloji yazısı “Volkswagen Almanya için sadece bir otomobil mi?”: sağ üstte bordo yarım daire içinde yazının girişi, küçük puntoyla iki sütun metin."),
    // Printed numbers below are what the page says (04, 07, 08), not where it stands (10–15)
    opener("psikoloji-acilis", "POSTSCRIPT psikoloj.ai", 5, 4, "Psikoloji ve İlişkiler", "karalama çizgilerden oluşan bir kadın başı profili ve yanında düğümlenmiş bir kalp"),
    article("psikoloji-iyilesmek-11", "POSTSCRIPT psikoloj.ai", 6, 7, "İyileşmek ne zaman yeni bir baskıya dönüştü?",
      "İyileşmek Öyle Değil, Böyle Olur!",
      "Psikoloji yazısı “İyileşmek ne zaman yeni bir baskıya dönüştü?”: solda başlık, sağ üstte bordo yarım daire içinde yazının girişi, iki sütun metin."),
    article("psikoloji-dusunmemeye-12", "POSTSCRIPT psikoloj.ai", 1, 8, "Düşünmemeye çalıştıkça neden daha çok düşünüyoruz?",
      "Düşünmemeye Çalıştıkça Neden Daha Çok Düşünürüz?",
      "Psikoloji yazısı “Düşünmemeye çalıştıkça neden daha çok düşünüyoruz?”: sol üstte bordo yarım daire içinde yazının girişi, sağda başlık, iki sütun metin."),
    article("psikoloji-dusunmemeye-13", "POSTSCRIPT psikoloj.ai", 2, 7, "Düşünmemeye çalıştıkça… (devam) / Büyük dansa karşı koymak",
      "Büyük Dansa Karşı Koymak",
      "Önceki yazının sonu ve kaynakları; ardından “Ya kontrol takıntısı, kontrolünü kaybetmenin ta kendisiyse?” başlıklı öykünün başlangıcı."),
    article("psikoloji-buyuk-dans-14", "POSTSCRIPT psikoloj.ai", 3, 8, "Büyük dansa karşı koymak (devam)", null,
      "“Büyük Dansa Karşı Koymak” öyküsünün devamı: sol üstte bordo yarım daire içinde öykünün girişi, iki sütun metin."),
    article("psikoloji-buyuk-dans-15", "POSTSCRIPT psikoloj.ai", 4, 7, "Büyük dansa karşı koymak (son)", null,
      "“Büyük Dansa Karşı Koymak” öyküsünün sonu: sağ üstte bordo yarım daire, iki sütun metin."),
    ...section("film-dizi-kitap", "POSTSCRIPT film dizi kitap.ai", 18, "Film, Dizi & Kitap", "FİLM, DİZİ & KİTAP", "altın rengi süslü bir çerçevenin içinde eski bir televizyon ve üst üste kitaplar"),
    ...section("sanat-edebiyat", "POSTSCRIPT sanat edebiyat.ai", 24, "Sanat & Edebiyat", "SANAT & EDEBİYAT", "açık bir kitabın üzerinde boya kutuları, tüpler, uçuşan harfler ve kırmızı bir heykel figürü"),
    ...section("pop-culture", "POSTSCRIPT pop culture.ai", 30, "Pop Culture", "POP CULTURE", "topuzlu, inci kolyeli bir kadın sakız balonu şişiriyor; çevresinde plaklar, “On Air” tabelası ve damalı şerit"),
    ...section("tarih-dunya", "tarih dünya.ai", 36, "Tarih & Dünya", "TARİH & DÜNYA", "eski bir dünya haritası dairesinin içinde Kolezyum, cep saati ve bir asker figürü"),
    ...section("sosyal-feminizm", "sosyal feminizm.ai", 42, "Sosyal & Feminizm", "SOSYAL & FEMİNİZM", "yan yana duran kadınlar “Women” ve “Break the silence, end violence!” yazılı pankartlar taşıyor, üstte kalkmış bir yumruk"),
    ...section("sosyoloji-dusunce", "POSTSCRIPT sosyoloji düşünce.ai", 48, "Sosyoloji & Düşünce", "SOSYOLOJİ & DÜŞÜNCE", "dalgalanan bir bayrağın üzerinde Düşünen Adam heykeli ve konuşma balonu"),
    ...section("fashion-lifestyle", "POSTSCRIPT fashion.ai", 54, "Fashion & Lifestyle", "FASHION & LİFESTYLE", "kabarık etekli bir terzi mankeni silüetinin içinde askıda kırmızı elbise ve alışveriş çantaları"),
    ...section("yazar-kosesi", "yazar köşesi.ai", 60, "Yazar Köşesi: PostScript", "YAZAR KÖŞESİ: “P.S.”", "bir kadın başı silüetinin içinde eski bir daktilo; kâğıtta “Yazar Köşesi: PostScript” yazıyor"),
    // The quiz is the page after the opener (`quizPages`), not a hidden area on it (D-309)
    ...section("eglence-dedikodu", "eğlence dedikodu.ai", 66, "Eğlence & Dedikodu", "EĞLENCE & DEDİKODU", "büyük bir yıldızın önünde eski tip bir telefon ve “Have Fun” yazısı"),
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
  // Every page of the twelve delivered files is used (D-323)
  excluded: [],
};

/** A section opener: the 5th artboard of its file. */
function opener(key: string, source: string, sourcePage: number, printed: number, section: string, picture: string): Page {
  return {
    key,
    source,
    sourcePage,
    printedNumber: printed,
    role: "page",
    title: `${section} açılışı`,
    contents: section,
    alt: `${section} bölüm açılışı: koyu zemin üzerinde ${picture}.`,
    transcript: `POSTSCRIPT. ${section}. ${pad(printed)}`,
    areas: [],
  };
}

/** A written page; its text is in `issue-01-transcripts.ts` under the same key. */
function article(
  key: string,
  source: string,
  sourcePage: number,
  printed: number,
  title: string,
  contents: string | null,
  alt: string,
): Page {
  const transcript = ISSUE_01_TRANSCRIPTS[key];
  if (!transcript) throw new Error(`"${key}" sayfasının metni issue-01-transcripts.ts içinde yok.`);
  return { key, source, sourcePage, printedNumber: printed, role: "page", title, contents, alt, transcript, areas: [] };
}

/**
 * A section of the files re-delivered on 2026-10-05 evening (D-327): its
 * opener (printed number `first`) and the five pages after it. A page with a
 * text in `issue-01-section-transcripts.ts` is a written page; one without is
 * still the numbered blank template. In every one of these files the opener
 * is the 5th artboard, the page after it the 6th, and the four after that the
 * 1st–4th.
 */
function section(prefix: string, source: string, first: number, name: string, header: string, picture: string): Page[] {
  const pages = [6, 1, 2, 3, 4].map((sourcePage, index): Page => {
    const printed = first + 1 + index;
    const key = `${prefix}-${pad(printed)}`;
    const text = ISSUE_01_SECTION_TRANSCRIPTS[key];
    const common = { key, source, sourcePage, printedNumber: printed, role: "page" as const, contents: null, areas: [] };
    if (text) {
      return {
        ...common,
        title: `${name} · ${pad(printed)}`,
        alt: `${name} bölümünün ${pad(printed)} numaralı sayfası: yazı sayfası; metni ekran okuyucu metninde.`,
        transcript: text,
      };
    }
    return {
      ...common,
      title: `${name} · boş sayfa ${pad(printed)}`,
      alt: `${name} bölümünün ${pad(printed)} numaralı sayfası, henüz boş: üstte bölüm adı, köşede bordo yarım daire, altta sayfa numarası.`,
      transcript: `${header}. ${pad(printed)}`,
    };
  });
  return [opener(`${prefix}-acilis`, source, 5, first, name, picture), ...pages];
}

function pad(number: number): string {
  return String(number).padStart(2, "0");
}
