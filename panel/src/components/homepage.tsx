/**
 * The magazine's front page (D-112), drawn from the "ana sayfa" designs: the
 * issue over the collage, the writing areas with their pictures and the
 * issue's movie, series, book and artwork cards beside its playlist.
 *
 * A server component; the header and the member menu come from `SiteShell`,
 * so nothing of the session reaches this file at all.
 */
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import heroCollage from "@/assets/design/hero-collage.webp";
import categoryArt from "@/assets/design/category-art.webp";
import categoryAuthor from "@/assets/design/category-author.webp";
import categoryBooks from "@/assets/design/category-books.webp";
import categoryFeminism from "@/assets/design/category-feminism.webp";
import categoryGossip from "@/assets/design/category-gossip.webp";
import categoryHistory from "@/assets/design/category-history.webp";
import categoryLifestyle from "@/assets/design/category-lifestyle.webp";
import categoryPop from "@/assets/design/category-pop.webp";
import categoryPsychology from "@/assets/design/category-psychology.webp";
import categoryScience from "@/assets/design/category-science.webp";
import categoryThought from "@/assets/design/category-thought.webp";
import artworkWeiss from "@/assets/design/artwork-weiss-obsession.webp";
import bookMasumiyet from "@/assets/design/book-masumiyet-muzesi.webp";
import movieBlackSwan from "@/assets/design/movie-black-swan.webp";
import seriesYou from "@/assets/design/series-you.webp";
import type { IssueCard, IssueCardImage, IssueCardKind, IssueExtras } from "@/lib/issue-extras";
import { categoryImageKey, formatIssueNumber, type CategoryImageKey } from "@/lib/site";
import { spotifyEmbedUrl } from "@/lib/spotify";
import { SpotifyPlayer } from "./spotify-player";
import { Sparkle, Swoosh } from "./site-ui";

const CATEGORY_IMAGES: Record<CategoryImageKey, StaticImageData> = {
  art: categoryArt,
  science: categoryScience,
  psychology: categoryPsychology,
  lifestyle: categoryLifestyle,
  pop: categoryPop,
  books: categoryBooks,
  thought: categoryThought,
  feminism: categoryFeminism,
  history: categoryHistory,
  author: categoryAuthor,
  gossip: categoryGossip,
};

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
}: {
  issue: HomeIssue;
  /** Active writing area names, in the admin's order. */
  areas: string[];
  extras: IssueExtras | null;
}) {
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
          <h2 id="home-issue-title" className="hero-title" lang={issue.titleLang}>
            {issue.title}
          </h2>
          {issue.theme && <p className="hero-theme">{issue.theme}</p>}
          <Link href={issue.href} className="site-outline-button">
            Hemen oku!
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
                  <Link href="/#kategoriler">Ve dahası…</Link>
                </li>
              )}
            </ul>
          )}
        </div>
      </section>

      <section className="home-section" id="kategoriler" aria-labelledby="home-categories-title">
        <div className="site-section-head">
          <h2 id="home-categories-title" className="site-caps-title">
            Kategoriler
          </h2>
          <Link href="/magazine" className="site-more">
            Tümünü gör <ArrowRight aria-hidden />
          </Link>
        </div>

        {areas.length === 0 ? (
          <p className="home-empty">Yazı alanları çok yakında burada.</p>
        ) : (
          <ul className="category-rail">
            {areas.map((name, index) => (
              <li key={name}>
                <Link href={`/magazine?kategori=${encodeURIComponent(name)}`} className="category-card">
                  <span className="category-card-art">
                    <Image
                      src={CATEGORY_IMAGES[categoryImageKey(name, index)]}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 16rem, 70vw"
                    />
                  </span>
                  <span className="category-name">{name}</span>
                  <Swoosh className="category-swoosh" />
                </Link>
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
            // Opens at the first card; the reader slides on to the rest (D-121). The
            // focusable region lets a keyboard reach the cards beyond the edge
            <div className="extras-rail" role="region" aria-label="Sayının kartları" tabIndex={0}>
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
            </div>
          )}

          {extras.playlist && (
            <article className="extra-player" aria-labelledby="player-title">
              <SpotifyPlayer
                embedUrl={spotifyEmbedUrl(extras.playlist.spotifyUrl)}
                title={`Sayı ${formatIssueNumber(issue.number)} çalma listesi (Spotify)`}
                headingId="player-title"
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
