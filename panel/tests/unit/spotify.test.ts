import { describe, expect, it } from "vitest";
import { spotifyEmbedUrl, spotifyPlaylistId } from "@/lib/spotify";

const ID = "37i9dQZF1DXcBWIGoYBM5M";

describe("spotifyPlaylistId (D-117)", () => {
  it("reads the id from a shared playlist link, with or without tracking parameters", () => {
    expect(spotifyPlaylistId(`https://open.spotify.com/playlist/${ID}`)).toBe(ID);
    expect(spotifyPlaylistId(`https://open.spotify.com/playlist/${ID}?si=abc123`)).toBe(ID);
  });

  it("accepts a localised link and an embed link", () => {
    expect(spotifyPlaylistId(`https://open.spotify.com/intl-tr/playlist/${ID}`)).toBe(ID);
    expect(spotifyPlaylistId(`https://open.spotify.com/embed/playlist/${ID}`)).toBe(ID);
  });

  it("refuses anything that is not a Spotify playlist", () => {
    expect(spotifyPlaylistId(null)).toBeNull();
    expect(spotifyPlaylistId("")).toBeNull();
    expect(spotifyPlaylistId("bir liste")).toBeNull();
    expect(spotifyPlaylistId(`http://open.spotify.com/playlist/${ID}`)).toBeNull();
    expect(spotifyPlaylistId(`https://open.spotify.com.example.com/playlist/${ID}`)).toBeNull();
    expect(spotifyPlaylistId(`https://open.spotify.com/album/${ID}`)).toBeNull();
    expect(spotifyPlaylistId(`https://open.spotify.com/user/x/playlist/${ID}`)).toBeNull();
    expect(spotifyPlaylistId("https://open.spotify.com/playlist/kisa")).toBeNull();
    expect(spotifyPlaylistId(`https://open.spotify.com/playlist/${ID}/extra`)).toBeNull();
  });
});

describe("spotifyEmbedUrl", () => {
  it("rebuilds the player address from the id alone", () => {
    expect(spotifyEmbedUrl(`https://open.spotify.com/playlist/${ID}?si=abc&utm_source=x`)).toBe(
      `https://open.spotify.com/embed/playlist/${ID}`,
    );
    expect(spotifyEmbedUrl(null)).toBeNull();
  });
});
