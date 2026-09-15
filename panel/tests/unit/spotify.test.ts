import { describe, expect, it } from "vitest";
import { readEmbedMessage, spotifyEmbedUrl, spotifyPlaylistId } from "@/lib/spotify";

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

describe("issue 01 playlist", () => {
  it("accepts the link as the owner shared it, tracking parameters and all", () => {
    expect(
      spotifyEmbedUrl(
        "https://open.spotify.com/playlist/5dLgq2RgLa3kR2Gag6EmFS?si=RgUi3lVOSE2xhpQRFewcWQ&utm_source=copy-link&pi=_P6DNt0wSZuS0",
      ),
    ).toBe("https://open.spotify.com/embed/playlist/5dLgq2RgLa3kR2Gag6EmFS");
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

describe("readEmbedMessage (D-126)", () => {
  it("reads the player's handshake and whether the playlist is playing", () => {
    expect(readEmbedMessage({ type: "ready" })).toEqual({ kind: "ready" });
    expect(
      readEmbedMessage({
        type: "playback_update",
        payload: { isPaused: false, isBuffering: true, duration: 29713, position: 0 },
      }),
    ).toEqual({ kind: "playback", playing: true });
    expect(readEmbedMessage({ type: "playback_update", payload: { isPaused: true } })).toEqual({
      kind: "playback",
      playing: false,
    });
  });

  it("ignores anything else", () => {
    expect(readEmbedMessage(null)).toBeNull();
    expect(readEmbedMessage("ready")).toBeNull();
    expect(readEmbedMessage({ type: "playback_update" })).toBeNull();
    expect(readEmbedMessage({ type: "playback_update", payload: { isPaused: "no" } })).toBeNull();
    expect(readEmbedMessage({ type: "playback_started", payload: {} })).toBeNull();
  });
});
