"use client";

/**
 * The front page playlist's player (D-117).
 *
 * Spotify's embedded player is loaded only when the reader presses play. Until
 * then no request reaches Spotify, so opening the front page sends nobody's IP
 * address or browser details abroad; the note beside the button says what the
 * press does before it is made. Without a playlist link the player is drawn as
 * designed and stays empty.
 */
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { FastForward, Music, Play, Rewind } from "lucide-react";

export function SpotifyPlayer({
  embedUrl,
  title,
  header,
}: {
  /** Built by `spotifyEmbedUrl`, so it can only be a Spotify playlist player. */
  embedUrl: string | null;
  /** Names the player frame for screen readers. */
  title: string;
  /** The player's title bar, rendered on the server. */
  header: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const soon = embedUrl ? "Spotify çalarında kullanılır" : "Çalma listesi yakında";

  if (embedUrl && open) {
    return (
      <div className="player-frame">
        {header}
        <div className="player-embed">
          <iframe
            src={embedUrl}
            title={title}
            width="100%"
            height="352"
            loading="lazy"
            allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="player-frame">
        {header}
        <div className="player-body">
          <div className="player-tracks">
            {embedUrl ? (
              <p className="player-message">
                Çalar Spotify tarafından sunulur ve çal düğmesine bastığınızda yüklenir. Spotify bu
                sırada IP adresinizi ve tarayıcı bilgilerinizi alır, kendi çerezlerini kullanabilir.{" "}
                <Link href="/kvkk" className="underline">
                  Ayrıntılar
                </Link>
              </p>
            ) : (
              <p className="player-message">Bu sayının çalma listesi çok yakında burada.</p>
            )}
          </div>
          <span className="player-scroll" aria-hidden />
          <div className="turntable" aria-hidden>
            <span className="turntable-deck" />
            <span className="turntable-record" />
          </div>
        </div>
      </div>

      <div className="player-controls">
        <button type="button" disabled title={soon} aria-label="Önceki şarkı">
          <Rewind aria-hidden fill="currentColor" />
        </button>
        <button
          type="button"
          disabled={!embedUrl}
          onClick={() => setOpen(true)}
          title={embedUrl ? "Spotify çalarını aç" : soon}
          aria-label={embedUrl ? "Spotify çalarını aç" : "Çal (yakında)"}
          className="player-play"
        >
          <Play aria-hidden fill="currentColor" />
        </button>
        <button type="button" disabled title={soon} aria-label="Sonraki şarkı">
          <FastForward aria-hidden fill="currentColor" />
        </button>
        <span className="player-slider" aria-hidden />
        <Music aria-hidden className="player-note" />
      </div>
    </>
  );
}
