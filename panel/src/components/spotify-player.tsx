"use client";

/**
 * The front page playlist's player (D-117, D-126, D-127, D-129).
 *
 * Spotify's embedded player is loaded only when the reader presses play. Until
 * then no request reaches Spotify, so opening the front page sends nobody's IP
 * address or browser details abroad. Only signed-in members, who accepted the
 * privacy notice when they joined, get the player at all; a visitor sees the
 * playlist's songs and a link to sign in (D-132). Without a playlist link the
 * player is drawn as designed and stays empty.
 *
 * Once open, the record settles onto the turntable, and the player tells the
 * page when the playlist plays or pauses so the record turns while it plays.
 * Those messages stay in the reader's browser; nothing about them reaches the
 * site's server.
 *
 * The title bar's buttons work on the open player: the cross closes Spotify's
 * player and brings back the drawn one, and the speaker silences the playlist.
 * Spotify's player takes no volume command from the page, so silencing pauses
 * it and turning the sound back on resumes it where it stopped.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { FastForward, Music, Play, Rewind, Volume2, VolumeX, X } from "lucide-react";
import type { PlaylistTrack } from "@/lib/issue-extras";
import { readEmbedMessage, SPOTIFY_ORIGIN } from "@/lib/spotify";
import { cn } from "@/lib/utils";

function Turntable({ seated, playing }: { seated: boolean; playing: boolean }) {
  return (
    <div className="turntable" aria-hidden>
      <span className={cn("turntable-deck", playing && "is-playing")} />
      <span className={cn("turntable-record", seated && "is-seated", playing && "is-spinning")} />
    </div>
  );
}

export function SpotifyPlayer({
  embedUrl,
  title,
  heading,
  headingId,
  listName,
  tracks = [],
  locked = false,
}: {
  /** Built by `spotifyEmbedUrl`, so it can only be a Spotify playlist player. */
  embedUrl: string | null;
  /** Names the player frame for screen readers. */
  title: string;
  /** The title bar's words, rendered on the server. */
  heading: ReactNode;
  /** Lets the surrounding article take its name from the title bar. */
  headingId: string;
  /** The playlist's name, shown on the closed player. */
  listName?: string;
  /** The playlist's songs; the closed player lists the first three. */
  tracks?: PlaylistTrack[];
  /** There is a playlist, but only a signed-in member may open it. */
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seated, setSeated] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closedByReader = useRef(false);
  const soon = embedUrl
    ? "Spotify çalarında kullanılır"
    : locked
      ? "Çalmak için giriş yapın"
      : "Çalma listesi yakında";

  const sendCommand = (command: "pause" | "resume") => {
    frameRef.current?.contentWindow?.postMessage({ command }, SPOTIFY_ORIGIN);
  };

  const closePlayer = () => {
    closedByReader.current = true;
    setOpen(false);
    setReady(false);
    setPlaying(false);
    setMuted(false);
    setSeated(false);
  };

  const toggleSound = () => {
    sendCommand(muted ? "resume" : "pause");
    setMuted(!muted);
  };

  // Closing removes the focused frame, so keyboard focus goes back to the play button
  useEffect(() => {
    if (!open && closedByReader.current) {
      closedByReader.current = false;
      openButtonRef.current?.focus();
    }
  }, [open]);

  // The record is drawn beside the deck first, so its move onto the platter can be seen
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setSeated(true), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

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
        setReady(true);
      } else if (message?.kind === "playback") {
        setPlaying(message.playing);
        // Pressing play inside Spotify's player brings the sound back too
        if (message.playing) setMuted(false);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open]);

  const bar = (
    <div className="player-bar">
      <h3 id={headingId} className="player-bar-title">
        {heading}
      </h3>
      <div className="player-bar-icons">
        <button
          type="button"
          onClick={toggleSound}
          // There is sound to silence only while the playlist plays, or back to bring once silenced
          disabled={!open || !ready || !(playing || muted)}
          aria-label="Sesi kapat"
          aria-pressed={muted}
          title={muted ? "Sesi aç: çalma kaldığı yerden sürer" : "Sesi kapat: çalma duraklar"}
        >
          {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
        </button>
        <button
          type="button"
          onClick={closePlayer}
          disabled={!open}
          aria-label="Spotify çalarını kapat"
          title="Spotify çalarını kapat"
        >
          <X aria-hidden />
        </button>
      </div>
    </div>
  );

  if (embedUrl && open) {
    return (
      <div className="player-frame">
        {bar}
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
          <Turntable seated={seated} playing={playing} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="player-frame">
        {bar}
        <div className="player-body">
          <div className="player-tracks">
            {(embedUrl || locked) && tracks.length > 0 ? (
              <>
                {listName && <p className="player-list-name">{listName}</p>}
                <ol className="player-track-list" aria-label="İlk şarkılar">
                  {tracks.slice(0, 3).map((track, index) => (
                    <li key={`${track.title}-${track.artist}`}>
                      <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                      <span>
                        {track.title}
                        <small>{track.artist}</small>
                      </span>
                      <span>{track.duration}</span>
                    </li>
                  ))}
                </ol>
                {locked && (
                  <p className="player-signin">
                    <Link href="/login" className="underline">
                      Dinlemek için giriş yap
                    </Link>
                  </p>
                )}
              </>
            ) : locked ? (
              <p className="player-message">
                <Link href="/login" className="underline">
                  Dinlemek için giriş yap
                </Link>
              </p>
            ) : embedUrl ? (
              <p className="player-message">Çal düğmesine basınca çalma listesi açılır.</p>
            ) : (
              <p className="player-message">Bu sayının çalma listesi çok yakında burada.</p>
            )}
          </div>
          <span className="player-scroll" aria-hidden />
          <Turntable seated={false} playing={false} />
        </div>
      </div>

      <div className="player-controls">
        <button type="button" disabled title={soon} aria-label="Önceki şarkı">
          <Rewind aria-hidden fill="currentColor" />
        </button>
        <button
          ref={openButtonRef}
          type="button"
          disabled={!embedUrl}
          onClick={() => setOpen(true)}
          title={embedUrl ? "Spotify çalarını aç" : soon}
          aria-label={embedUrl ? "Spotify çalarını aç" : locked ? "Çalmak için giriş yapın" : "Çal (yakında)"}
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
