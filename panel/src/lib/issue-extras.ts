/**
 * The front page's "book, artwork and playlist of the issue" panels (D-112).
 *
 * The designs fill them for issue 01 only and the database has no place for
 * them, so they live here, keyed by issue number, until an editor screen needs
 * them. An issue without an entry shows no panels.
 */

export type IssueExtras = {
  book?: { title: string; author: string; year: number; text: string };
  artwork?: {
    title: string;
    artist: string;
    year: number;
    text: string;
    /** Picks one of the bundled pictures in `src/assets/design`. */
    image: "weiss-obsession";
    /**
     * The language of the title and name. Headings are set in capitals, and
     * Turkish capitals would print "Weiss" as "WEİSS".
     */
    lang?: string;
  };
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
    // The design cuts this card off at the page edge; the missing words were
    // filled in from the visible fragments and confirmed by the owner (D-115)
    book: {
      title: "Masumiyet Müzesi",
      author: "Orhan Pamuk",
      year: 2008,
      text:
        "Kemal’in Füsun’a duyduğu yoğun aşkın zamanla bir takıntıya dönüşmesini anlatır. " +
        "Kemal, Füsun’la ilgili eşyaları biriktirerek geçmişe bağlılığını korumaya çalışır. " +
        "Kitap; aşk, özlem, takıntı ve kaybetme korkusu temalarını işler.",
    },
    artwork: {
      title: "Obsession",
      artist: "Wojciech Weiss",
      year: 1899,
      image: "weiss-obsession",
      lang: "en",
      text:
        "Koyu ve karanlık tonların hâkim olduğu bu tabloda, takıntı, melankoli ve içsel " +
        "huzursuzluk duyguları öne çıkar. Figürün duruşu ve yüz ifadesi, yoğun bir düşünceye " +
        "veya duygusal saplantıya hapsolmuşluk hissi verir. Karanlık atmosfer ve güçlü " +
        "kontrastlar, eserin psikolojik ve rahatsız edici havasını güçlendirir.",
    },
    playlist: { spotifyUrl: null },
  },
};

export function issueExtrasFor(issueNumber: number): IssueExtras | null {
  return ISSUE_EXTRAS[issueNumber] ?? null;
}
