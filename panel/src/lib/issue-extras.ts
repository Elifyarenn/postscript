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

export type PlaylistTrack = {
  title: string;
  artist: string;
  /** As Spotify shows it, minutes and seconds ("4:13"). */
  duration: string;
};

export type IssueExtras = {
  /**
   * When the issue comes out, with Turkey's offset (D-192). The issues page
   * counts down to it until the issue is published.
   */
  release?: { at: string; title: string };
  /** In the design's order, left to right; the rail opens at the first one (D-121). */
  cards?: IssueCard[];
  playlist?: {
    /**
     * The issue's playlist on Spotify, as its share link
     * (https://open.spotify.com/playlist/…). Null until the playlist is made:
     * the player is then drawn but stays empty (D-117). The site itself never
     * plays audio; Spotify's own player does, once the reader asks for it.
     */
    spotifyUrl: string | null;
    /**
     * The playlist's name and songs as Spotify lists them, copied here when the
     * playlist changes (D-131). The closed player shows them without asking
     * Spotify, so the front page still sends it nothing before play is pressed.
     */
    name?: string;
    tracks?: PlaylistTrack[];
  };
};

const ISSUE_EXTRAS: Record<number, IssueExtras> = {
  1: {
    // The owner's date: 1 October, 17.00 Turkey time (D-192)
    release: { at: "2026-10-01T17:00:00+03:00", title: "Obsession" },
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
    // Live since D-125; the whole list was read from Spotify's own player on 2026-09-21 (D-220)
    playlist: {
      spotifyUrl: "https://open.spotify.com/playlist/5dLgq2RgLa3kR2Gag6EmFS",
      name: "Obsession",
      tracks: [
        { title: "Every Breath You Take", artist: "The Police", duration: "4:13" },
        { title: "Hysteria", artist: "Muse", duration: "3:47" },
        { title: "He's My Man", artist: "Luvcat", duration: "3:52" },
        { title: "An Unhealthy Obsession", artist: "The Blake Robinson Synthetic Orchestra", duration: "2:58" },
        { title: "Forever", artist: "The Little Dippers", duration: "2:18" },
        { title: "Creep", artist: "Radiohead", duration: "3:58" },
        { title: "Paparazzi", artist: "Lady Gaga", duration: "3:28" },
        { title: "Obsessed", artist: "Mariah Carey", duration: "4:02" },
        { title: "Killing Me Softly With His Song", artist: "Fugees, Ms. Lauryn Hill", duration: "4:58" },
        { title: "You Are My Destiny", artist: "Paul Anka", duration: "2:48" },
        { title: "Somebody's Watching Me", artist: "Rockwell", duration: "4:58" },
        { title: "my strange addiction", artist: "Billie Eilish", duration: "2:59" },
        { title: "Animals", artist: "Maroon 5", duration: "3:51" },
        { title: "Geyser", artist: "Mitski", duration: "2:23" },
        { title: "Heathens", artist: "Twenty One Pilots", duration: "3:15" },
        { title: "DNA", artist: "Little Mix", duration: "3:58" },
        { title: "One by One", artist: "The New Shining", duration: "3:06" },
        { title: "Paradise", artist: "The Neighbourhood", duration: "3:29" },
        { title: "Wires", artist: "The Neighbourhood", duration: "3:13" },
        { title: "Hijo de la Luna", artist: "Mecano", duration: "4:19" },
        { title: "Heaven", artist: "The Neighbourhood", duration: "3:25" },
        { title: "LET THE WORLD BURN", artist: "Chris Grey", duration: "2:43" },
        { title: "Dollhouse", artist: "Melanie Martinez", duration: "3:51" },
        { title: "The Winner Takes It All", artist: "ABBA", duration: "4:54" },
        { title: "Face-off", artist: "Jimin", duration: "3:49" },
        { title: "Are You Satisfied?", artist: "MARINA", duration: "3:18" },
        { title: "Oh No!", artist: "MARINA", duration: "3:02" },
        { title: "Look What You Made Me Do", artist: "Taylor Swift", duration: "3:31" },
        { title: "Borderline", artist: "SUNMI", duration: "2:54" },
        { title: "Little Miss Perfect", artist: "Write Out Loud, Taylor Louderman, Joriah Kwamé", duration: "3:18" },
        { title: "Speechless", artist: "Memphis May Fire", duration: "3:23" },
        { title: "THE DEATH OF PEACE OF MIND", artist: "Bad Omens", duration: "4:01" },
        { title: "Map of the Problematique", artist: "Muse", duration: "4:18" },
        { title: "One Way Or Another", artist: "Blondie", duration: "3:37" },
        { title: "Primadonna", artist: "MARINA", duration: "3:41" },
        { title: "A Little Piece of Heaven", artist: "Avenged Sevenfold", duration: "8:00" },
        { title: "All The Things She Said", artist: "t.A.T.u.", duration: "3:34" },
        { title: "Post Blue", artist: "Placebo", duration: "3:11" },
        { title: "Climbing Up the Walls", artist: "Radiohead", duration: "4:45" },
        { title: "Lovesong", artist: "The Cure", duration: "3:26" },
        { title: "Something I Can Never Have", artist: "Nine Inch Nails", duration: "5:54" },
        { title: "Digital Bath", artist: "Deftones", duration: "4:15" },
        { title: "All I Wanted", artist: "Paramore", duration: "3:45" },
        { title: "obsessed", artist: "Olivia Rodrigo", duration: "2:50" },
        { title: "Gitme Sana Muhtacım", artist: "Zeki Müren", duration: "4:31" },
      ],
    },
  },
};

export function issueExtrasFor(issueNumber: number): IssueExtras | null {
  return ISSUE_EXTRAS[issueNumber] ?? null;
}
