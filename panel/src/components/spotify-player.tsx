"use client";

/**
 * The front page playlist's player (D-117, D-126).
 *
 * Spotify's embedded player is loaded only when the reader presses play. Until
 * then no request reaches Spotify, so opening the front page sends nobody's IP
 * address or browser details abroad; the note beside the button says what the
 * press does before it is made. Without a playlist link the player is drawn as
 * designed and stays empty.
 *
 * Once open, the player tells the page when the playlist plays or pauses, and
 * the record on the turntable turns while it plays. Those messages stay in the
 * reader's browser; nothing about them reaches the site's server.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { FastForward, Music, Play, Rewind } from "lucide-react";
import { readEmbedMessage, SPOTIFY_ORIGIN } from "@/lib/spotify";
import { cn } from "@/lib/utils";

function Turntable({ playing }: { playing: boolean }) {
  return (
    <div className="turntable" aria-hidden>
      <span className={cn("turntable-deck", playing && "is-playing")} />
      <span className={cn("turntable-record", playing && "is-spinning")} />
    </div>
  );
}

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
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const soon = embedUrl ? "Spotify çalarında kullanılır" : "Çalma listesi yakında";

  useEffect(() => {
    if (!open) return;

    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow;
      // Only the player this component opened may move the record
      if (event.origin !== SPOTIFY_ORIGIN || !frame || event.source !== frame) return;

      const message = readEmbedMessage(event.data);
      if (message?.kind === "ready") {
        // Spotify's own iframe API answers the handshake; the player reports playback only after it
        frame.postMessage({ command: "load_complete_ack" }, SPOTIFY_ORIGIN);
      } else if (message?.kind === "playback") {
        setPlaying(message.playing);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open]);

  if (embedUrl && open) {
    return (
      <div className="player-frame">
        {header}
        <div className="player-embed">
          <iframe
            ref={frameRef}
            src={embedUrl}
            title={title}
            width="100%"
            height="352"
            loading="lazy"
            // The reader has already pressed play here; autoplay lets that press start the music
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        </div>
        <div className="player-deck">
          <Turntable playing={playing} />
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
          <Turntable playing={false} />
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
