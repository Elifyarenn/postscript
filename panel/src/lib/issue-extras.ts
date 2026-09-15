/**
 * The front page's "movie, series, book and artwork of the issue" cards and its
 * playlist (D-112, D-120).
 *
 * The designs fill them for issue 01 only and the database has no place for
 * them, so they live here, keyed by issue number, until an editor screen needs
 * them. An issue without an entry shows no panels.
 */

export type IssueCardKind = "movie" | "series" | "book" | "artwork";

/** One of the bundled pictures in `src/assets/design`. */
export type IssueCardImage =
  | "black-swan"
  | "you"
  | "masumiyet-muzesi"
  | "weiss-obsession";

export type IssueCard = {
  kind: IssueCardKind;
  title: string;
  /** The author, director, creators or artist, as the heading names them. */
  credit: string;
  year: number;
  text: string;
  image: IssueCardImage;
  /**
   * The language of the title and credit. Headings are set in capitals, and
   * Turkish capitals would print "Weiss" as "WEİSS".
   */
  lang?: string;
};

export type IssueExtras = {
  /** In the design's order, left to right; the rail opens at the last one. */
  cards?: IssueCard[];
  playlist?: {
    /**
     * The issue's playlist on Spotify, as its share link
     * (https://open.spotify.com/playlist/…). Null until the playlist is made:
     * the player is then drawn but stays empty (D-117). The site itself never
     * plays audio; Spotify's own player does, once the reader asks for it.
     */
    spotifyUrl: string | null;
  };
};

const ISSUE_EXTRAS: Record<number, IssueExtras> = {
  1: {
    // Texts are the designer's, read from the Illustrator file's own text
    // layer, including the cards placed outside its artboard (D-120)
    cards: [
      {
        kind: "movie",
        title: "Black Swan",
        credit: "Darren Aronofsky",
        year: 2010,
        image: "black-swan",
        lang: "en",
        text:
          "Black Swan, bale sanatçısı Nina’nın kusursuz olma arzusuyla giderek takıntı, baskı ve " +
          "psikolojik çöküş içine sürüklenmesini anlatır. Nina’nın mükemmellik arayışı, özellikle " +
          "Beyaz Kuğu ve Siyah Kuğu arasındaki çatışma üzerinden kendi karanlık tarafıyla " +
          "yüzleşmesine dönüşür. Film; takıntı, mükemmeliyetçilik, rekabet ve kimlik temalarını işler.",
      },
      {
        kind: "series",
        title: "You",
        credit: "Greg Berlanti & Sera Gamble",
        // The design says 2008; the series first aired in 2018 (D-120)
        year: 2018,
        image: "you",
        lang: "en",
        text:
          "You, Joe Goldberg adlı bir adamın, âşık olduğu kadınlara karşı geliştirdiği takıntılı " +
          "ve kontrolcü davranışları anlatır. Joe, aşkını koruduğunu düşünerek kişilerin " +
          "hayatlarını gizlice takip eder ve giderek daha tehlikeli davranışlarda bulunur. Dizi; " +
          "takıntı, saplantılı aşk, manipülasyon ve gizlilik temalarını işler.",
      },
      {
        kind: "book",
        title: "Masumiyet Müzesi",
        credit: "Orhan Pamuk",
        year: 2008,
        image: "masumiyet-muzesi",
        text:
          "Roman, Kemal’in Füsun’a duyduğu yoğun aşkın zamanla bir takıntıya dönüşmesini anlatır. " +
          "Kemal, Füsun’la ilgili eşyaları biriktirerek geçmişe ve ona olan bağlılığını korumaya " +
          "çalışır. Kitap; aşk, özlem, saplantı ve kaybetme korkusu temalarını işler.",
      },
      {
        kind: "artwork",
        title: "Obsession",
        credit: "Wojciech Weiss",
        year: 1899,
        image: "weiss-obsession",
        lang: "en",
        text:
          "Koyu ve karanlık tonların hâkim olduğu bu tabloda, takıntı, melankoli ve içsel " +
          "huzursuzluk duyguları öne çıkar. Figürün duruşu ve yüz ifadesi, yoğun bir düşünceye " +
          "veya duygusal saplantıya hapsolmuşluk hissi verir. Karanlık atmosfer ve güçlü " +
          "kontrastlar, eserin psikolojik ve rahatsız edici havasını güçlendirir.",
      },
    ],
    playlist: { spotifyUrl: null },
  },
};

export function issueExtrasFor(issueNumber: number): IssueExtras | null {
  return ISSUE_EXTRAS[issueNumber] ?? null;
}
