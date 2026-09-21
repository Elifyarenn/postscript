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
import { isImageHair } from "@/lib/avatar/assets/hair-images";
import { HAIR_TEXTURES } from "@/lib/avatar/assets/hair";
import { torso } from "@/lib/avatar/assets/face";
import { CLOTHING_STATIC } from "@/lib/avatar/assets/clothing-static";
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
      hairStyle: "messy",
      hairTexture: "curly",
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

  it("draws the static back hair behind the head and the front over the face", () => {
    const parts = renderAvatarLayers({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "long" });
    const back = parts.find((part) => part.layer === "backHair")!.svg;
    const front = parts.find((part) => part.layer === "frontHair")!.svg;
    expect(back).toContain("<path");
    expect(front).toContain('fill="#241c1e"');
    expect(front).toContain("clip-path");
  });

  it("crops a thumbnail and can leave layers out", () => {
    const svg = renderAvatarSvg(DEFAULT_AVATAR_CONFIG, { view: "hair", size: 180, omit: ["eyes", "mouth"] });
    expect(svg).toContain('viewBox="92 20 840 840" width="180" height="180"');
    expect(svg).not.toContain('data-layer="eyes"');
  });
});

describe("corrected static hair (D-215)", () => {
  it("keeps straight01 in the catalogue and paints it with the chosen hair colour", () => {
    const ids = FIELDS.hairStyle.options.map((option) => option.id);
    expect(ids).toContain("straight01");

    const blonde = renderAvatarSvg(avatarConfigSchema.parse({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "straight01", hairColor: "blonde" }));
    const black = renderAvatarSvg(avatarConfigSchema.parse({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "straight01", hairColor: "black" }));
    expect(blonde).toContain('fill="#e3c283"');
    expect(black).not.toContain('fill="#e3c283"');
  });

  it("draws the sheen inside the front shape through a per-layer clip", () => {
    const svg = renderAvatarSvg(
      avatarConfigSchema.parse({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "messy", hairTexture: "straight" }),
    );
    expect(svg).toContain('<clipPath id="frontHair-surface">');
    expect(svg).toContain('clip-path="url(#frontHair-surface)"');
  });

  it("offers two textures, one per drawn set (D-218)", () => {
    // Dalgalı and Kıvırcık drew the same set, so the choice said nothing
    expect(HAIR_TEXTURES.map((texture) => texture.id)).toEqual(["straight", "curly"]);
  });

  it("draws the bukle set for bukleli and the base set for düz", () => {
    const layer = (texture: "straight" | "curly") =>
      renderAvatarLayers({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "long", hairTexture: texture }).find(
        (part) => part.layer === "frontHair",
      )!.svg;
    const straight = layer("straight");
    expect(straight).not.toBe(layer("curly"));
    // The bukle set clips its curl locks per layer; the base set has none
    expect(straight).not.toContain("curl");
    expect(layer("curly")).toContain("curl");
  });

  it("carries a stored dalgalı over to bukleli instead of dropping it (D-218)", () => {
    const stored = parseStoredConfig({ ...DEFAULT_AVATAR_CONFIG, v: 4, hairTexture: "wavy" });
    expect(stored.hairTexture).toBe("curly");
  });
});

describe("the body under the clothes (D-223, D-224)", () => {
  /** The on-curve points of an "M … C … C …" outline, control points aside. */
  const outline = (d: string): [number, number][] => {
    const n = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const points: [number, number][] = [[n[0]!, n[1]!]];
    let from: [number, number] = [n[0]!, n[1]!];
    for (let index = 2; index + 5 < n.length; index += 6) {
      const [c1x, c1y, c2x, c2y, toX, toY] = n.slice(index, index + 6) as number[];
      for (let step = 1; step <= 40; step += 1) {
        const t = step / 40;
        const u = 1 - t;
        points.push([
          u ** 3 * from[0] + 3 * u * u * t * c1x! + 3 * u * t * t * c2x! + t ** 3 * toX!,
          u ** 3 * from[1] + 3 * u * u * t * c1y! + 3 * u * t * t * c2y! + t ** 3 * toY!,
        ]);
      }
      from = [toX!, toY!];
    }
    return points;
  };

  /** How far right an outline reaches at a given height. */
  const rightAt = (points: [number, number][], y: number): number | null => {
    let best: number | null = null;
    for (const [x, py] of points) {
      if (Math.abs(py - y) > 6) continue;
      if (best === null || x > best) best = x;
    }
    return best;
  };

  it("keeps the shoulders inside every garment that is meant to cover them", () => {
    const body = outline(torso([[440, 760], [512, 748], [584, 760]]));
    for (const style of CLOTHING_STATIC) {
      // The tank top bares the shoulders on purpose; the rest must not
      if (style.id === "tank") continue;
      const cloth = outline(style.body.match(/<path d="([^"]+)"/)![1]!.split("Z")[0]! + "Z");
      for (let y = 760; y <= 1020; y += 4) {
        const skin = rightAt(body, y);
        const garment = rightAt(cloth, y);
        if (skin === null || garment === null) continue;
        // A wider body showed as a strip of bare skin down the outside of
        // both shoulders; checked row by row, not just at the widest point
        expect(skin, `${style.id} at y=${y}`).toBeLessThanOrEqual(garment);
      }
    }
  });
  it("colours a hat apart from the clothes", () => {
    const svg = renderAvatarSvg(
      avatarConfigSchema.parse({
        ...DEFAULT_AVATAR_CONFIG,
        extras: ["beanie"],
        headwearColor: "red",
        clothing: "sweater",
        clothingColor: "black",
      }),
    );
    // The hat used to take the clothing colour, so the two could never differ
    expect(svg).toContain("#b8463c");
  });
});

describe("neck headphones (D-222)", () => {
  const wearing = avatarConfigSchema.parse({ ...DEFAULT_AVATAR_CONFIG, extras: ["headphones"] });
  const layerOf = (layer: string) =>
    renderAvatarLayers(wearing).find((part) => part.layer === layer)?.svg ?? "";

  it("passes the band behind the body and hangs only the cups in front", () => {
    // Drawn before the body, the band disappears behind the neck instead of
    // crossing the throat; the cups still sit on top of the clothes
    expect(layerOf("backHair")).toContain("M424 774");
    expect(layerOf("accessories")).not.toContain("M424 774");
    expect(layerOf("accessories")).toContain("<ellipse");
  });
});

describe("türban (D-219)", () => {
  const wearing = avatarConfigSchema.parse({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "turban", scarfColor: "navy" });

  it("stands at the head of the hair list, before any hair", () => {
    expect(FIELDS.hairStyle.options[0]!.id).toBe("turban");
  });

  it("draws cloth in the hair's place, in its own colour", () => {
    const front = renderAvatarLayers(wearing).find((part) => part.layer === "frontHair")!.svg;
    // The fabric colour, not a hair colour: navy is not in the hair palette
    expect(front).toContain("#2f3f63");
    // A shape with a hole in it; without the rule the face would be covered
    expect(front).toContain('fill-rule="evenodd"');
  });

  it("leaves the ears alone, so no earring floats on the cloth", () => {
    const withEarrings = avatarConfigSchema.parse({ ...wearing, earrings: "bigHoop", piercings: ["helix"] });
    const bareHead = avatarConfigSchema.parse({ ...withEarrings, hairStyle: "pixie" });
    const layerOf = (config: typeof withEarrings, layer: string) =>
      renderAvatarLayers(config).find((part) => part.layer === layer)?.svg ?? "";
    expect(layerOf(withEarrings, "earrings")).toBe("");
    expect(layerOf(withEarrings, "piercings")).toBe("");
    // The same choices on a bare head still draw
    expect(layerOf(bareHead, "earrings")).not.toBe("");
  });

  it("gives an older record the default cloth colour rather than refusing it", () => {
    const stored = parseStoredConfig({ ...DEFAULT_AVATAR_CONFIG, v: 5, scarfColor: undefined });
    expect(stored.scarfColor).toBe(DEFAULT_AVATAR_CONFIG.scarfColor);
  });
});

describe("picture-based hair (D-200)", () => {
  const config = avatarConfigSchema.parse({ ...DEFAULT_AVATAR_CONFIG, hairStyle: "imageSample" });

  it("draws its files through the caller's resolver", () => {
    const svg = renderAvatarSvg(config, { imageHref: (file) => `inline:${file}` });
    expect(svg).toContain('<image href="inline:sample-front.png"');
    expect(svg).toContain('<image href="inline:sample-back.png"');
  });

  it("serves them from the public folder by default", () => {
    expect(renderAvatarSvg(config)).toContain('href="/avatar-hair/sample-front.png"');
  });

  it("knows which styles carry their own colour", () => {
    expect(isImageHair("imageSample")).toBe(true);
    expect(isImageHair("messy")).toBe(false);
  });

  it("leaves the drawn styles free of pictures", () => {
    expect(renderAvatarSvg(DEFAULT_AVATAR_CONFIG)).not.toContain("<image");
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
