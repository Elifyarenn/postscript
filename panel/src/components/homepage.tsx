/**
 * The magazine's front page (D-112), drawn from the "ana sayfa" designs: the
 * issue over the collage, the writing areas with their pictures and the
 * issue's movie, series, book and artwork cards beside its playlist.
 *
 * A server component; the header and the member menu come from `SiteShell`.
 * Of the session one fact reaches this file: whether the reader is a signed-in
 * member, the only kind of reader who may open the playlist (D-132).
 */
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import heroCollage from "@/assets/design/hero-collage.webp";
import artworkWeiss from "@/assets/design/artwork-weiss-obsession.webp";
import bookMasumiyet from "@/assets/design/book-masumiyet-muzesi.webp";
import movieBlackSwan from "@/assets/design/movie-black-swan.webp";
import seriesYou from "@/assets/design/series-you.webp";
import type { IssueCard, IssueCardImage, IssueCardKind, IssueExtras } from "@/lib/issue-extras";
import { formatIssueNumber } from "@/lib/site";
import { spotifyEmbedUrl } from "@/lib/spotify";
import { IssueCardRail } from "./issue-card-rail";
import { SpotifyPlayer } from "./spotify-player";
import { CategoryCard } from "./category-card";
import { Sparkle } from "./site-ui";

const CARD_IMAGES: Record<IssueCardImage, StaticImageData> = {
  "black-swan": movieBlackSwan,
  you: seriesYou,
  "masumiyet-muzesi": bookMasumiyet,
  "weiss-obsession": artworkWeiss,
};

const CARD_LABELS: Record<IssueCardKind, string> = {
  movie: "Sayının filmi",
  series: "Sayının dizisi",
  book: "Sayının kitabı",
  artwork: "Sayının eseri",
};

function cardImageAlt(card: IssueCard): string {
  const name = `${card.title} (${card.year})`;
  if (card.kind === "book") return `${card.credit}, ${name} kitap kapağı`;
  if (card.kind === "artwork") return `${card.credit}, ${name}`;
  return `${name} afişi`;
}

export type HomeIssue = {
  number: number;
  /** False for the announced issue before it is out: nothing to read yet (D-187). */
  published: boolean;
  title: string;
  theme: string | null;
  href: string;
  /** The title's language when it is not Turkish; it is set in capitals. */
  titleLang?: string;
};

export function HomePage({
  issue,
  areas,
  extras,
  member,
}: {
  issue: HomeIssue;
  /** Active writing area names, in the admin's order. */
  areas: string[];
  extras: IssueExtras | null;
  /** A signed-in member, who accepted the privacy notice on joining. */
  member: boolean;
}) {
  const playlistEmbed = extras?.playlist ? spotifyEmbedUrl(extras.playlist.spotifyUrl) : null;
  const cards = extras?.cards ?? [];
  const hasExtras = extras !== null && (cards.length > 0 || Boolean(extras.playlist));

  return (
    <>
      <h1 className="sr-only">PostScript Dergi</h1>

      <section className="home-hero" aria-labelledby="home-issue-title">
        <Image
          src={heroCollage}
          alt=""
          fill
          sizes="(min-width: 1320px) 1320px, 100vw"
          className="home-hero-art"
          placeholder="blur"
          loading="eager"
          fetchPriority="high"
        />

        <div className="home-hero-copy">
          <p className="hero-issue">Sayı {formatIssueNumber(issue.number)}</p>
          <h2 id="home-issue-title" className="hero-title fit-line" lang={issue.titleLang}>
            {issue.title}
          </h2>
          {issue.theme && <p className="hero-theme">{issue.theme}</p>}
          <Link href={issue.href} className="site-outline-button">
            {issue.published ? "Hemen oku!" : "Çok yakında"}
          </Link>
        </div>

        <div className="hero-side">
          <Sparkle className="hero-star" />
          {areas.length > 0 && (
            <ul className="hero-categories" aria-label="Yazı alanları">
              {areas.slice(0, 4).map((name) => (
                <li key={name}>
                  <Link href={`/magazine?kategori=${encodeURIComponent(name)}`}>{name}</Link>
                </li>
              ))}
              {areas.length > 4 && (
                <li>
                  <Link href="/kategoriler">Ve dahası…</Link>
                </li>
              )}
            </ul>
          )}
        </div>
      </section>

      <section className="home-section" id="kategoriler" aria-labelledby="home-categories-title">
        <div className="site-section-head">
          <h2 id="home-categories-title" className="site-caps-title fit-line">
            Kategoriler
          </h2>
          <Link href="/kategoriler" className="site-more">
            Tümünü gör <ArrowRight aria-hidden />
          </Link>
        </div>

        {areas.length === 0 ? (
          <p className="home-empty">Yazı alanları çok yakında burada.</p>
        ) : (
          <ul className="category-rail">
            {areas.map((name, index) => (
              <li key={name}>
                <CategoryCard name={name} index={index} sizes="(min-width: 768px) 16rem, 70vw" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasExtras && (
        // The design keeps the playlist still at the right while the issue's cards slide
        // past it; on a phone the playlist drops below the rail (D-119)
        <section className="issue-extras-row" aria-label={`Sayı ${formatIssueNumber(issue.number)} seçkisi`}>
          {cards.length > 0 && (
            // Opens at the first card; the reader slides on to the rest (D-121).
            // The rail carries its own dots and moves on by itself (D-225)
            <IssueCardRail count={cards.length}>
              {cards.map((card) => {
                const image = CARD_IMAGES[card.image];
                // Posters and covers stand upright; the painting lies flat and gets a wider card
                const upright = image.height > image.width;
                return (
                  <article
                    key={`${card.kind}-${card.title}`}
                    className={`extra-panel ${upright ? "extra-poster" : "extra-art"}`}
                  >
                    <div className="extra-artwork">
                      <Image
                        src={image}
                        alt={cardImageAlt(card)}
                        sizes={upright ? "(min-width: 640px) 14rem, 90vw" : "(min-width: 1000px) 26rem, 90vw"}
                      />
                      <div className="space-y-4">
                        <h3 className="extra-heading" lang={card.lang}>
                          {card.title} ({card.year}) - {card.credit}
                        </h3>
                        <p className="extra-text">{card.text}</p>
                      </div>
                    </div>
                    <p className="extra-label">{CARD_LABELS[card.kind]}</p>
                  </article>
                );
              })}
            </IssueCardRail>
          )}

          {extras.playlist && (
            <article className="extra-player" aria-labelledby="player-title">
              <SpotifyPlayer
                // A visitor is never handed the player's address, so nothing of theirs reaches Spotify
                embedUrl={member ? playlistEmbed : null}
                locked={!member && playlistEmbed !== null}
                title={`Sayı ${formatIssueNumber(issue.number)} çalma listesi (Spotify)`}
                headingId="player-title"
                listName={extras.playlist.name}
                tracks={extras.playlist.tracks}
                heading={
                  <>
                    <Star aria-hidden fill="currentColor" /> Çalma listesi
                  </>
                }
              />
            </article>
          )}
        </section>
      )}
    </>
  );
}
