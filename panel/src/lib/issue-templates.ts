/**
 * The page layouts an issue is built from (D-234).
 *
 * One list drives everything: the choices in the panel, which fields each page
 * asks for, what the reader draws and what the contents page lists. Adding a
 * layout is adding an entry here and a branch in `IssuePageView`.
 *
 * `fields` is what the panel offers for that layout. A page keeps whatever was
 * typed even if the layout changes later, so nothing is lost by trying one.
 */

export type PageField =
  | "heading"
  | "standfirst"
  | "byline"
  | "body"
  | "image"
  | "caption"
  | "article"
  | "section";

export type PageTemplate = {
  id: string;
  label: string;
  /** One line in the panel saying what the layout is for. */
  hint: string;
  fields: readonly PageField[];
  /** A cover or a divider has no business in the contents list. */
  inContentsByDefault: boolean;
  /** Full-bleed layouts drop the page's paper margins. */
  bleed?: boolean;
};

export const PAGE_TEMPLATES = [
  {
    id: "cover",
    label: "Kapak",
    hint: "Sayının kapağı: tema, alt başlık ve kapak görseli.",
    fields: ["heading", "standfirst", "image"],
    inContentsByDefault: false,
    bleed: true,
  },
  {
    id: "masthead",
    label: "Künye",
    hint: "Kim hazırladı: ekip, iletişim ve yasal satırlar.",
    fields: ["heading", "body"],
    inContentsByDefault: true,
  },
  {
    id: "editorial",
    label: "Editörden",
    hint: "Sayıyı açan yazı; imza satırıyla.",
    fields: ["heading", "standfirst", "byline", "body", "image"],
    inContentsByDefault: true,
  },
  {
    id: "contents",
    label: "İçindekiler",
    hint: "Sayfaları kendisi listeler; ayrıca metin girmek gerekmez.",
    fields: ["heading", "standfirst"],
    inContentsByDefault: false,
  },
  {
    id: "theme_opening",
    label: "Tema açılışı",
    hint: "Temayı büyük tipografiyle duyuran tam sayfa.",
    fields: ["heading", "standfirst", "image"],
    inContentsByDefault: true,
  },
  {
    id: "section_opening",
    label: "Bölüm açılışı",
    hint: "Bir kategoriye geçişi işaretler.",
    fields: ["heading", "standfirst", "section", "image"],
    inContentsByDefault: true,
  },
  {
    id: "article_opening",
    label: "Yazı açılışı",
    hint: "Standart yazı başlangıcı: başlık, spot, imza, ilk sütun.",
    fields: ["heading", "standfirst", "byline", "body", "image", "caption", "article", "section"],
    inContentsByDefault: true,
  },
  {
    id: "article_continued",
    label: "Yazı devamı",
    hint: "Uzun yazının sonraki sayfası; başlık tekrar edilmez.",
    fields: ["heading", "body", "image", "caption", "article"],
    inContentsByDefault: false,
  },
  {
    id: "visual_article",
    label: "Görsel ağırlıklı yazı",
    hint: "Büyük görsel, yanında kısa metin.",
    fields: ["heading", "standfirst", "byline", "body", "image", "caption", "article"],
    inContentsByDefault: true,
  },
  {
    id: "collage_opening",
    label: "Kolajlı açılış",
    hint: "Kontrollü kolaj detaylarıyla açılan yazı.",
    fields: ["heading", "standfirst", "byline", "body", "image", "article", "section"],
    inContentsByDefault: true,
  },
  {
    id: "full_bleed",
    label: "Tam sayfa görsel",
    hint: "Görsel mola: kenarlıksız görsel ve altyazısı.",
    fields: ["image", "caption", "heading"],
    inContentsByDefault: false,
    bleed: true,
  },
  {
    id: "picks",
    label: "Sayının seçkisi",
    hint: "Film, dizi, kitap ve eser; sayının kendi seçki kaynağından gelir.",
    fields: ["heading", "standfirst"],
    inContentsByDefault: true,
  },
  {
    id: "playlist",
    label: "Çalma listesi",
    hint: "Sayının Spotify listesi; mevcut çalar bileşeniyle.",
    fields: ["heading", "standfirst"],
    inContentsByDefault: true,
  },
  {
    id: "interactive",
    label: "Etkileşimli alan",
    hint: "Soru-cevap, quiz ya da galeri gibi blokların sayfası.",
    fields: ["heading", "standfirst", "body"],
    inContentsByDefault: true,
  },
  {
    id: "ps_closing",
    label: "P.S. kapanışı",
    hint: "Sayıyı kapatan kısa not.",
    fields: ["heading", "standfirst", "byline", "body"],
    inContentsByDefault: true,
  },
  {
    id: "back_cover",
    label: "Arka kapak",
    hint: "Kapanış görseli ya da tek bir cümle.",
    fields: ["heading", "standfirst", "image"],
    inContentsByDefault: false,
    bleed: true,
  },
] as const satisfies readonly PageTemplate[];

export type PageTemplateId = (typeof PAGE_TEMPLATES)[number]["id"];

export const PAGE_TEMPLATE_IDS = PAGE_TEMPLATES.map((template) => template.id) as [
  PageTemplateId,
  ...PageTemplateId[],
];

export function templateOf(id: string): PageTemplate {
  return PAGE_TEMPLATES.find((template) => template.id === id) ?? PAGE_TEMPLATES[0];
}

export function templateAsks(id: string, field: PageField): boolean {
  return (templateOf(id).fields as readonly PageField[]).includes(field);
}

/** The placeholder the preview shows where content will go (D-234). */
export const FIELD_PLACEHOLDERS: Record<PageField, string> = {
  heading: "[Başlık]",
  standfirst: "[Spot]",
  byline: "[Yazar]",
  body: "[Metin alanı]",
  image: "[Görsel alanı]",
  caption: "[Görsel açıklaması]",
  article: "[Bağlı yazı]",
  section: "[Bölüm]",
};
