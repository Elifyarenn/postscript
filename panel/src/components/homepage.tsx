/**
 * The magazine's front page (D-112), drawn from the "ana sayfa" designs: the
 * issue over the collage, the writing areas with their pictures and the
 * issue's book, artwork and playlist.
 *
 * A server component; the header and the member menu come from `SiteShell`,
 * so nothing of the session reaches this file at all.
 */
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRight, Star, Volume2, VolumeX, X } from "lucide-react";
import heroCollage from "@/assets/design/hero-collage.webp";
import categoryArt from "@/assets/design/category-art.webp";
import categoryLifestyle from "@/assets/design/category-lifestyle.webp";
import categoryPop from "@/assets/design/category-pop.webp";
import categoryPsychology from "@/assets/design/category-psychology.webp";
import categoryScience from "@/assets/design/category-science.webp";
import artworkWeiss from "@/assets/design/artwork-weiss-obsession.webp";
import type { IssueExtras } from "@/lib/issue-extras";
import { categoryImageKey, formatIssueNumber, type CategoryImageKey } from "@/lib/site";
import { spotifyEmbedUrl } from "@/lib/spotify";
import { RailEnd } from "./rail-end";
import { SpotifyPlayer } from "./spotify-player";
import { Sparkle, Swoosh } from "./site-ui";

const CATEGORY_IMAGES: Record<CategoryImageKey, StaticImageData> = {
  art: categoryArt,
  science: categoryScience,
  psychology: categoryPsychology,
  lifestyle: categoryLifestyle,
  pop: categoryPop,
};

const ARTWORK_IMAGES: Record<NonNullable<IssueExtras["artwork"]>["image"], StaticImageData> = {
  "weiss-obsession": artworkWeiss,
};

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
  const hasExtras =
    extras !== null && (Boolean(extras.book) || Boolean(extras.artwork) || Boolean(extras.playlist));

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
                      sizes="(min-width: 768px) 20rem, 80vw"
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
          {(extras.book || extras.artwork) && (
            <RailEnd className="extras-rail" label="Sayının kartları">
              {extras.book && (
                <article className="extra-panel extra-book">
                  <h3 className="extra-heading">
                    {extras.book.title} ({extras.book.year}) - {extras.book.author}
                  </h3>
                  <p className="extra-text">{extras.book.text}</p>
                  <p className="extra-label">Sayının kitabı</p>
                </article>
              )}

              {extras.artwork && (
                <article className="extra-panel extra-art">
                  <div className="extra-artwork">
                    <Image
                      src={ARTWORK_IMAGES[extras.artwork.image]}
                      alt={`${extras.artwork.artist}, ${extras.artwork.title} (${extras.artwork.year})`}
                      sizes="(min-width: 1000px) 26rem, 90vw"
                    />
                    <div className="space-y-4">
                      <h3 className="extra-heading" lang={extras.artwork.lang}>
                        {extras.artwork.title} ({extras.artwork.year}) - {extras.artwork.artist}
                      </h3>
                      <p className="extra-text">{extras.artwork.text}</p>
                    </div>
                  </div>
                  <p className="extra-label">Sayının eseri</p>
                </article>
              )}
            </RailEnd>
          )}

          {extras.playlist && (
            <article className="extra-player" aria-labelledby="player-title">
              <div className="player-top" aria-hidden>
                <VolumeX />
              </div>

              <SpotifyPlayer
                embedUrl={spotifyEmbedUrl(extras.playlist.spotifyUrl)}
                title={`Sayı ${formatIssueNumber(issue.number)} çalma listesi (Spotify)`}
                header={
                  <h3 id="player-title" className="player-bar">
                    <Star aria-hidden fill="currentColor" /> Çalma listesi
                    <span className="player-bar-icons" aria-hidden>
                      <Volume2 />
                      <X />
                    </span>
                  </h3>
                }
              />
            </article>
          )}
        </section>
      )}
    </>
  );
}
