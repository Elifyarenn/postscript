/**
 * The stock photographs the temporary preview pages may use (D-247).
 *
 * Every entry is copied from the source record kept next to the original
 * download (`gorseller/ilk-sayi/<folder>/kaynaklar.md`): the photo's own page,
 * the photographer, and the licence that page was published under. Only
 * Unsplash and Pexels photos whose page and licence were checked are listed.
 * The Hubble pictures (licence not confirmed) and the Storyset drawings (credit
 * required, recoloured) were left out on purpose; being in the folder is not
 * permission.
 *
 * The files in `assets/issue-preview/stock` are these photos shrunk to 1400px
 * on the long edge. They are read on the server only and never served as they
 * are: a reader sees them only inside a page picture of the admin-only issue.
 */

export type StockLicence = "unsplash" | "pexels";

export type StockPhoto = {
  /** File name under `assets/issue-preview/stock`. */
  file: string;
  /** The photo's own page, where its licence was checked. */
  source: string;
  photographer: string;
  licence: StockLicence;
  /** What the photo shows, for the page's alt text and transcript. */
  description: string;
};

export const LICENCE_URL: Record<StockLicence, string> = {
  unsplash: "https://unsplash.com/license",
  pexels: "https://www.pexels.com/license/",
};

const LICENCE_NAME: Record<StockLicence, string> = {
  unsplash: "Unsplash",
  pexels: "Pexels",
};

/** "Fotoğraf: X / Unsplash" — neither licence demands it, but it is owed. */
export function creditLine(photo: StockPhoto): string {
  return `Fotoğraf: ${photo.photographer} / ${LICENCE_NAME[photo.licence]}`;
}

export const STOCK = {
  edisonBulbs: {
    file: "bilim-insanlari-ve-obsesyon--01-edison-bulbs.jpg",
    source: "https://unsplash.com/photos/1NTFSnV-KLs",
    photographer: "Patrick Tomasso",
    licence: "unsplash",
    description: "Karanlıkta asılı Edison tipi ampuller",
  },
  oldNotebooks: {
    file: "bilim-insanlari-ve-obsesyon--03-old-notebooks.jpg",
    source: "https://unsplash.com/photos/fYitW3VDSDw",
    photographer: "Roman",
    licence: "unsplash",
    description: "Üst üste duran eski deri defterler",
  },
  steamingTea: {
    file: "cay-koy-yeniden-baslayalim--01-steaming-tea-glass.jpg",
    source: "https://www.pexels.com/photo/close-up-photo-of-steaming-black-tea-in-glass-1493080/",
    photographer: "Hasan Albari",
    licence: "pexels",
    description: "İnce belli bardakta buharı tüten çay",
  },
  teaInHand: {
    file: "cay-koy-yeniden-baslayalim--02-hand-holding-tea-glass.jpg",
    source: "https://www.pexels.com/photo/a-person-holding-clear-drinking-glass-with-tea-11073329/",
    photographer: "Merve Tülek",
    licence: "pexels",
    description: "Elde tutulan çay bardağı",
  },
  knottedRope: {
    file: "madde-1-hukukun-pesini-birakmadiklari--01-halat-dugum.jpg",
    source: "https://unsplash.com/photos/-yz22gsqAH0",
    photographer: "Robert Zunikoff",
    licence: "unsplash",
    description: "Düğüm atılmış kalın bir halat",
  },
  theatreCurtain: {
    file: "hayali-sahit-takintisi--01-red-theater-curtain.jpg",
    source: "https://unsplash.com/photos/WW1jsInXgwM",
    photographer: "Rob Laughter",
    licence: "unsplash",
    description: "Kapalı kırmızı tiyatro perdesi",
  },
  threePens: {
    file: "uc-kalem--01-uc-farkli-kalem.jpg",
    source: "https://www.pexels.com/photo/three-ball-point-pens-983826/",
    photographer: "Jess Bailey Designs",
    licence: "pexels",
    description: "Yan yana üç farklı tükenmez kalem",
  },
  tiedLetters: {
    file: "uc-kalem--02-baglanmis-mektuplar.jpg",
    source: "https://www.pexels.com/photo/shallow-focus-of-letter-paper-1157151/",
    photographer: "Suzy Hazelwood",
    licence: "pexels",
    description: "İple bağlanmış eski mektuplar",
  },
  clockAtNight: {
    file: "uc-kalem--03-gece-saat.jpg",
    source: "https://www.pexels.com/photo/clock-in-the-dark-18325165/",
    photographer: "Beyzaa Yurtkuran",
    licence: "pexels",
    description: "Karanlıkta bir çalar saat",
  },
  snowflakeMacro: {
    file: "takinti-kar-tanesi-ve-zihnin-sonsuz-fraktali--01-snowflake-macro.jpg",
    source: "https://unsplash.com/photos/5AiWn2U10cw",
    photographer: "Aaron Burden",
    licence: "unsplash",
    description: "Yakın çekim tek bir kar tanesi",
  },
  snowflakeBokeh: {
    file: "takinti-kar-tanesi-ve-zihnin-sonsuz-fraktali--02-snowflake-bokeh.jpg",
    source: "https://unsplash.com/photos/2HqpqSqy0zg",
    photographer: "Damian McCoig",
    licence: "unsplash",
    description: "Bulanık ışıklar önünde kar tanesi",
  },
  snowflakesDark: {
    file: "takinti-kar-tanesi-ve-zihnin-sonsuz-fraktali--03-snowflakes-dark.jpg",
    source: "https://unsplash.com/photos/pXUNmLRF_yw",
    photographer: "Zdeněk Macháček",
    licence: "unsplash",
    description: "Koyu zeminde kar taneleri",
  },
} as const satisfies Record<string, StockPhoto>;

export type StockKey = keyof typeof STOCK;
