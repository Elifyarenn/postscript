/**
 * Team avatars (D-194): the catalogue and its validation, the renderer, the
 * file name, the ZIP writer and who may use the builder.
 */
import { describe, expect, it } from "vitest";
import {
  AVATAR_CATEGORIES,
  DEFAULT_AVATAR_CONFIG,
  EXTRAS,
  avatarConfigSchema,
  avatarFileName,
  optionLabel,
  parseStoredConfig,
  randomAvatarConfig,
  teamAvatarDetailsSchema,
} from "@/lib/avatar/options";
import { AVATAR_LAYERS, renderAvatarSvg } from "@/lib/avatar/render";
import { crc32, uniqueEntryNames, zipToBuffer } from "@/lib/zip";
import { canCreateTeamAvatar, canManageTeamAvatars, type Actor } from "@/lib/auth/rbac";

const actor = (overrides: Partial<Actor> = {}): Actor => ({
  id: "00000000-0000-0000-0000-000000000001",
  role: "user",
  writerStatus: null,
  editorStatus: null,
  emailVerifiedAt: new Date(),
  isBanned: false,
  ...overrides,
});

describe("avatarConfigSchema", () => {
  it("accepts the default avatar", () => {
    expect(avatarConfigSchema.parse(DEFAULT_AVATAR_CONFIG)).toEqual(DEFAULT_AVATAR_CONFIG);
  });

  it("refuses an option that is not in the catalogue", () => {
    expect(avatarConfigSchema.safeParse({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "mohawk" }).success).toBe(false);
  });

  it("refuses unknown keys, so nothing free-form can reach the SVG", () => {
    expect(
      avatarConfigSchema.safeParse({ ...DEFAULT_AVATAR_CONFIG, skinTone: "tone1", fill: "url(javascript:1)" }).success,
    ).toBe(false);
  });

  it("stores extras once each, in catalogue order", () => {
    const parsed = avatarConfigSchema.parse({ ...DEFAULT_AVATAR_CONFIG, extras: ["pencil", "blush", "pencil"] });
    expect(parsed.extras).toEqual(["blush", "pencil"]);
  });

  it("gives every random avatar a valid configuration", () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let index = 0; index < 50; index += 1) {
      expect(avatarConfigSchema.safeParse(randomAvatarConfig(random)).success).toBe(true);
    }
  });
});

describe("parseStoredConfig", () => {
  it("keeps the valid choices of a record with one broken key", () => {
    const stored = { ...DEFAULT_AVATAR_CONFIG, hairColor: "blue", mouth: "removed-option" };
    const parsed = parseStoredConfig(stored);
    expect(parsed.hairColor).toBe("blue");
    expect(parsed.mouth).toBe(DEFAULT_AVATAR_CONFIG.mouth);
  });

  it("falls back to the default for garbage", () => {
    expect(parseStoredConfig("nope")).toEqual(DEFAULT_AVATAR_CONFIG);
  });
});

describe("team details", () => {
  it("trims and bounds the name and the role", () => {
    expect(teamAvatarDetailsSchema.parse({ displayName: "  Ada  ", teamRole: " Çizer " })).toEqual({
      displayName: "Ada",
      teamRole: "Çizer",
    });
    expect(teamAvatarDetailsSchema.safeParse({ displayName: "A", teamRole: "Editör" }).success).toBe(false);
    expect(teamAvatarDetailsSchema.safeParse({ displayName: "Ada", teamRole: "x".repeat(61) }).success).toBe(false);
  });
});

describe("avatarFileName", () => {
  it("builds isim-soyisim-avatar.png with Turkish letters transliterated", () => {
    expect(avatarFileName("Elif Yaren Çekiç")).toBe("elif-yaren-cekic-avatar.png");
    expect(avatarFileName("Işıl Öğüt")).toBe("isil-ogut-avatar.png");
  });

  it("never produces an empty name", () => {
    expect(avatarFileName("!!!")).toBe("ekip-uyesi-avatar.png");
  });
});

describe("optionLabel", () => {
  it("returns the Turkish label of a stored id", () => {
    expect(optionLabel("hairStyle", "ponytail")).toBe("At kuyruğu");
    expect(optionLabel("glasses", "none")).toBe("Yok");
  });
});

describe("renderAvatarSvg", () => {
  it("draws a square canvas with no background, so the PNG is transparent", () => {
    const svg = renderAvatarSvg(DEFAULT_AVATAR_CONFIG);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"')).toBe(true);
    expect(svg).not.toMatch(/<rect[^>]*width="100%"/);
    expect(svg).not.toContain("<image");
  });

  it("is deterministic", () => {
    expect(renderAvatarSvg(DEFAULT_AVATAR_CONFIG)).toBe(renderAvatarSvg(DEFAULT_AVATAR_CONFIG));
  });

  it("draws every layer in order", () => {
    const svg = renderAvatarSvg(DEFAULT_AVATAR_CONFIG);
    const positions = AVATAR_LAYERS.map((layer) => svg.indexOf(`data-layer="${layer.name}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("renders every option of every category without broken numbers", () => {
    for (const category of AVATAR_CATEGORIES) {
      for (const option of category.options) {
        const svg = renderAvatarSvg({ ...DEFAULT_AVATAR_CONFIG, [category.key]: option.id });
        expect(svg, `${category.key}=${option.id}`).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
    const allExtras = renderAvatarSvg({ ...DEFAULT_AVATAR_CONFIG, extras: EXTRAS.map((extra) => extra.id) });
    expect(allExtras).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("changes the drawing when a choice changes", () => {
    const base = renderAvatarSvg(DEFAULT_AVATAR_CONFIG);
    expect(renderAvatarSvg({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "afro" })).not.toBe(base);
    expect(renderAvatarSvg({ ...DEFAULT_AVATAR_CONFIG, hairTexture: "coily" })).not.toBe(base);
  });

  it("crops to a thumbnail view box", () => {
    expect(renderAvatarSvg(DEFAULT_AVATAR_CONFIG, { viewBox: "376 364 272 272", size: 132 })).toContain(
      'viewBox="376 364 272 272" width="132" height="132"',
    );
  });
});

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
  });

  it("writes local headers, a central directory and the end record", async () => {
    const data = new TextEncoder().encode("PNG!");
    const zip = await zipToBuffer([
      { name: "ada-avatar.png", data, modified: new Date(2026, 8, 17, 12, 0, 0) },
      { name: "çınar-avatar.png", data },
    ]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);

    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralOffset = view.getUint32(end + 16, true);
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    // The stored bytes follow the first header and its name
    const firstName = view.getUint16(26, true);
    expect(new TextDecoder().decode(zip.slice(30 + firstName, 30 + firstName + 4))).toBe("PNG!");
  });

  it("keeps entry names unique", () => {
    expect(uniqueEntryNames(["a-avatar.png", "b-avatar.png", "a-avatar.png"])).toEqual([
      "a-avatar.png",
      "b-avatar.png",
      "a-avatar-2.png",
    ]);
  });
});

describe("team avatar permissions", () => {
  it("opens the builder to the team and closes it to readers", () => {
    expect(canCreateTeamAvatar(actor({ role: "writer", writerStatus: "active" }), false)).toBe(true);
    expect(canCreateTeamAvatar(actor({ role: "editor", editorStatus: "active" }), false)).toBe(true);
    expect(canCreateTeamAvatar(actor({ role: "admin" }), false)).toBe(true);
    expect(canCreateTeamAvatar(actor(), true)).toBe(true);
    expect(canCreateTeamAvatar(actor(), false)).toBe(false);
  });

  it("closes it to banned and unverified accounts", () => {
    expect(canCreateTeamAvatar(actor({ role: "writer", isBanned: true }), false)).toBe(false);
    expect(canCreateTeamAvatar(actor({ emailVerifiedAt: null }), true)).toBe(false);
  });

  it("lets only admins manage the avatars", () => {
    expect(canManageTeamAvatars(actor({ role: "admin" }))).toBe(true);
    expect(canManageTeamAvatars(actor({ role: "editor", editorStatus: "active" }))).toBe(false);
  });
});
