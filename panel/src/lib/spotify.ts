/**
 * Spotify playlist links for the front page player (D-117).
 *
 * Only a playlist on open.spotify.com is accepted, and the player address is
 * rebuilt from the playlist id alone: whatever is pasted into the data file,
 * the frame can never be pointed at another page or carry extra parameters.
 */

/** Spotify ids are 22 characters of base-62. */
const PLAYLIST_ID = /^[A-Za-z0-9]{22}$/;

/** The id in a playlist link, or null when the link is not a Spotify playlist. */
export function spotifyPlaylistId(link: string | null | undefined): string | null {
  if (!link) return null;

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;

  // "/playlist/<id>", optionally after a locale ("/intl-tr") or "/embed"
  const parts = url.pathname.split("/").filter(Boolean);
  const at = parts.indexOf("playlist");
  if (at < 0 || at > 1) return null;
  if (at === 1 && !(parts[0] === "embed" || parts[0]?.startsWith("intl-"))) return null;

  const id = parts[at + 1];
  return id && parts.length === at + 2 && PLAYLIST_ID.test(id) ? id : null;
}

/** The embedded player's address for a playlist link, or null. */
export function spotifyEmbedUrl(link: string | null | undefined): string | null {
  const id = spotifyPlaylistId(link);
  return id ? `https://open.spotify.com/embed/playlist/${id}` : null;
}
