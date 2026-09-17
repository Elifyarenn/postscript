/**
 * Team avatars (D-194, D-195): the asset registry and its validation, reading
 * old records, the layered renderer, undo/redo, the file name, the ZIP writer
 * and who may use the builder.
 */
import { describe, expect, it } from "vitest";
import {
  AVATAR_CONFIG_VERSION,
  CATEGORIES,
  DEFAULT_AVATAR_CONFIG,
  FIELDS,
  PRESETS,
  avatarConfigSchema,
  avatarFileName,
  describeConfig,
  parseStoredConfig,
  randomAvatarConfig,
  teamAvatarDetailsSchema,
  type FieldKey,
} from "@/lib/avatar/registry";
import { LAYER_ORDER, renderAvatarLayers, renderAvatarSvg } from "@/lib/avatar/render";
import { HISTORY_LIMIT, historyReducer, type History } from "@/lib/avatar/history";
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

describe("the asset registry", () => {
  it("puts every field in a category, and nothing else", () => {
    const inCategories = new Set(CATEGORIES.flatMap((category) => category.fields as readonly string[]));
    expect([...inCategories].sort()).toEqual(Object.keys(FIELDS).sort());
  });

  it("gives every option a unique id and a label within its field", () => {
    for (const [key, field] of Object.entries(FIELDS)) {
      const ids = field.options.map((option) => option.id);
      expect(new Set(ids).size, key).toBe(ids.length);
      expect(field.options.every((option) => option.label.trim().length > 0), key).toBe(true);
    }
  });

  it("keeps every example avatar valid", () => {
    for (const preset of PRESETS) {
      expect(avatarConfigSchema.safeParse(preset.config).success, preset.label).toBe(true);
    }
  });
});

describe("avatarConfigSchema", () => {
  it("accepts the default avatar", () => {
    expect(avatarConfigSchema.parse(DEFAULT_AVATAR_CONFIG)).toEqual(DEFAULT_AVATAR_CONFIG);
  });

  it("refuses an option that is not in the catalogue", () => {
    expect(avatarConfigSchema.safeParse({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "mohawk" }).success).toBe(false);
  });

  it("refuses unknown keys, so nothing free-form can reach the SVG", () => {
    expect(avatarConfigSchema.safeParse({ ...DEFAULT_AVATAR_CONFIG, fill: "url(javascript:1)" }).success).toBe(false);
  });

  it("stores sets once each, in catalogue order", () => {
    const parsed = avatarConfigSchema.parse({
      ...DEFAULT_AVATAR_CONFIG,
      piercings: ["noseStud", "helix", "noseStud"],
      extras: ["pencil", "cap"],
    });
    expect(parsed.piercings).toEqual(["helix", "noseStud"]);
    expect(parsed.extras).toEqual(["cap", "pencil"]);
  });

  it("gives every random avatar a valid configuration with at most one hat", () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let index = 0; index < 60; index += 1) {
      const config = randomAvatarConfig(random);
      expect(avatarConfigSchema.safeParse(config).success).toBe(true);
      expect(config.extras.filter((id) => ["cap", "beanie", "beret"].includes(id)).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("parseStoredConfig", () => {
  it("keeps the valid choices of a record with one broken key", () => {
    const parsed = parseStoredConfig({ ...DEFAULT_AVATAR_CONFIG, hairColor: "blue", mouth: "removed-option" });
    expect(parsed.hairColor).toBe("blue");
    expect(parsed.mouth).toBe(DEFAULT_AVATAR_CONFIG.mouth);
  });

  it("carries a first-version record over to the current parts", () => {
    const parsed = parseStoredConfig({
      v: 1,
      skinTone: "tone7",
      faceShape: "square",
      eyeShape: "upturned",
      hairStyle: "afro",
      hairTexture: "coily",
      hairColor: "copper",
      top: "hoodie",
      topColor: "navy",
      piercing: "helix",
      extras: ["blush", "pencil"],
    });
    expect(parsed).toMatchObject({
      v: AVATAR_CONFIG_VERSION,
      skinTone: "tone7",
      face: "softSquare",
      eyes: "cat",
      hairStyle: "volume",
      hairTexture: "coily",
      hairColor: "copper",
      clothing: "hoodie",
      clothingColor: "navy",
      piercings: ["helix"],
      blush: "soft",
      extras: ["pencil"],
    });
  });

  it("falls back to the default for garbage", () => {
    expect(parseStoredConfig("nope")).toEqual(DEFAULT_AVATAR_CONFIG);
  });
});

describe("describeConfig", () => {
  it("lists every field once, with Turkish labels", () => {
    const rows = describeConfig({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "ponytail", piercings: ["helix", "septum"] });
    expect(rows).toHaveLength(Object.keys(FIELDS).length);
    expect(rows).toContainEqual({ label: "Saç Modeli", value: "At kuyruğu" });
    expect(rows).toContainEqual({ label: "Piercing", value: "Helix, Septum" });
    expect(rows).toContainEqual({ label: "Ekstra", value: "Yok" });
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

describe("renderAvatarSvg", () => {
  it("draws a square canvas with no background, so the PNG is transparent", () => {
    const svg = renderAvatarSvg(DEFAULT_AVATAR_CONFIG);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"')).toBe(true);
    expect(svg).not.toMatch(/<rect[^>]*width="(100%|1024)"/);
    expect(svg).not.toContain("<image");
  });

  it("is deterministic", () => {
    expect(renderAvatarSvg(DEFAULT_AVATAR_CONFIG)).toBe(renderAvatarSvg(DEFAULT_AVATAR_CONFIG));
  });

  it("draws the layers in the fixed order", () => {
    const svg = renderAvatarSvg(DEFAULT_AVATAR_CONFIG);
    const positions = LAYER_ORDER.map((layer) => svg.indexOf(`data-layer="${layer}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("renders every option of every field without broken numbers", () => {
    for (const key of Object.keys(FIELDS) as FieldKey[]) {
      const field = FIELDS[key];
      for (const option of field.options) {
        const value = field.kind === "set" ? [option.id] : option.id;
        const svg = renderAvatarSvg(avatarConfigSchema.parse({ ...DEFAULT_AVATAR_CONFIG, [key]: value }));
        expect(svg, `${key}=${option.id}`).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });

  it("leaves the other layers alone when one part changes", () => {
    const before = renderAvatarLayers(DEFAULT_AVATAR_CONFIG);
    const after = renderAvatarLayers({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "bob" });
    const changed = after
      .filter((part) => before.find((old) => old.layer === part.layer)?.svg !== part.svg)
      .map((part) => part.layer);
    expect(changed.sort()).toEqual(["backHair", "frontHair"]);
  });

  it("lets straight hair fall in front of the ears and tucks wavy hair behind them", () => {
    const layer = (texture: "straight" | "wavy", name: string) =>
      renderAvatarLayers({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "long", hairTexture: texture }).find(
        (part) => part.layer === name,
      )!.svg;
    const count = (svg: string) => svg.split("<path").length;
    // The side locks move from the back layer to the front one
    expect(count(layer("straight", "frontHair"))).toBeGreaterThan(count(layer("wavy", "frontHair")));
    expect(count(layer("straight", "backHair"))).toBeLessThan(count(layer("wavy", "backHair")));
  });

  it("crops a thumbnail and can leave layers out", () => {
    const svg = renderAvatarSvg(DEFAULT_AVATAR_CONFIG, { view: "hair", size: 180, omit: ["eyes", "mouth"] });
    expect(svg).toContain('viewBox="92 20 840 840" width="180" height="180"');
    expect(svg).not.toContain('data-layer="eyes"');
  });
});

describe("historyReducer", () => {
  const start: History = { past: [], present: DEFAULT_AVATAR_CONFIG, future: [] };
  const bob = { ...DEFAULT_AVATAR_CONFIG, hairStyle: "bob" as const };
  const bun = { ...DEFAULT_AVATAR_CONFIG, hairStyle: "bun" as const };

  it("undoes and redoes, and a new change clears the redo steps", () => {
    let state = historyReducer(start, { type: "set", config: bob });
    state = historyReducer(state, { type: "set", config: bun });
    state = historyReducer(state, { type: "undo" });
    expect(state.present.hairStyle).toBe("bob");
    state = historyReducer(state, { type: "redo" });
    expect(state.present.hairStyle).toBe("bun");
    state = historyReducer(state, { type: "undo" });
    state = historyReducer(state, { type: "set", config: DEFAULT_AVATAR_CONFIG });
    expect(state.future).toEqual([]);
  });

  it("adds no step for picking what is already chosen, and ignores undo at the start", () => {
    expect(historyReducer(start, { type: "set", config: { ...DEFAULT_AVATAR_CONFIG } })).toBe(start);
    expect(historyReducer(start, { type: "undo" })).toBe(start);
  });

  it("keeps a bounded history", () => {
    let state = start;
    for (let index = 0; index < HISTORY_LIMIT + 10; index += 1) {
      state = historyReducer(state, {
        type: "set",
        config: { ...DEFAULT_AVATAR_CONFIG, hairStyle: index % 2 ? "bob" : "bun" },
      });
    }
    expect(state.past).toHaveLength(HISTORY_LIMIT);
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
