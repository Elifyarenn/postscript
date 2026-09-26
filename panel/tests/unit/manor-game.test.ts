/**
 * The manor game (D-263): the text is the source of truth, so these tests walk
 * the story it describes. Every door must lead somewhere, every ending must be
 * reachable, and an ending entered from two places must open with the intro of
 * the route actually taken.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canPreviewManorGame, MANOR_GAME_PREVIEW_EMAILS, type Actor } from "@/lib/auth/rbac";
import { parseManorStory } from "@/lib/manor-game/story";
import { MANOR_STORY_FILE, manorChoose, manorCover, manorStart, manorStory } from "@/services/manor-game";

const DOC_FILE = path.join(process.cwd(), "..", "doc", "malikane oyunu.txt");

describe("manor game text", () => {
  // The editors work on the doc; the deployed folder carries a copy of it
  it.skipIf(!existsSync(DOC_FILE))("the deployed copy matches doc/malikane oyunu.txt byte for byte", () => {
    const deployed = readFileSync(path.join(process.cwd(), MANOR_STORY_FILE));
    expect(deployed.equals(readFileSync(DOC_FILE)), "copy doc/malikane oyunu.txt to panel/data/malikane-oyunu.txt").toBe(
      true,
    );
  });

  it("has the eight rooms, the five endings and the lore", () => {
    const story = manorStory();
    expect(story.title).toBe("LANETLİ MALİKÂNEDEN ÇIKABİLECEK MİSİN?");
    expect(story.startId).toBe("giris-kapisi");
    expect(Object.keys(story.scenes)).toEqual([
      "giris-kapisi",
      "portreler-koridoru",
      "ikinci-kat",
      "balo-salonu",
      "kiler-ve-arka-cikis",
      "tozlu-kutuphane",
      "kis-bahcesi",
      "yeralti-gecidi",
    ]);
    expect(Object.keys(story.endings).sort()).toEqual(
      ["bitmeyen-vals", "gunlugun-yeni-yazari", "malikanenin-yeni-sahibi", "safaktan-once", "tastan-misafir"].sort(),
    );
    expect(story.lore.title).toBe("POSTSCRIPT MALİKÂNESİ'NİN HİKÂYESİ");
    expect(story.lore.paragraphs.at(-1)).toBe("**“Hikâye henüz bitmedi.”**");
    expect(story.howToPlay).toContain("Geri dönmek yok.");
  });

  it("letters the choices A to P, once each, in reading order", () => {
    const letters = Object.values(manorStory().scenes).flatMap((scene) => scene.choices.map((choice) => choice.letter));
    expect(letters.join("")).toBe("ABCDEFGHIJKLMNOP");
  });

  it("offers exactly two choices in every room and none of them ends in a dead end", () => {
    const story = manorStory();
    const routes: string[][] = [];
    const walk = (id: string, taken: string[]) => {
      const scene = story.scenes[id];
      if (!scene) {
        expect(story.endings[id], `choice leads nowhere: ${taken.join(" ")}`).toBeDefined();
        routes.push([...taken, id]);
        return;
      }
      expect(scene.choices).toHaveLength(2);
      for (const choice of scene.choices) walk(choice.target, [...taken, choice.letter]);
    };
    walk(story.startId, []);

    expect(routes.map((route) => route.join(" "))).toEqual([
      "A C G malikanenin-yeni-sahibi",
      "A C H bitmeyen-vals",
      "A D I O safaktan-once",
      "A D I P malikanenin-yeni-sahibi",
      "A D J safaktan-once",
      "B E K gunlugun-yeni-yazari",
      "B E L O safaktan-once",
      "B E L P malikanenin-yeni-sahibi",
      "B F M tastan-misafir",
      "B F N O safaktan-once",
      "B F N P malikanenin-yeni-sahibi",
    ]);
    expect(new Set(routes.map((route) => route.at(-1))).size).toBe(5);
  });

  it("opens a shared ending with the intro of the route taken, and only that one", () => {
    const viaDoor = manorChoose("kiler-ve-arka-cikis", "J");
    const viaTunnel = manorChoose("yeralti-gecidi", "O");
    expect(viaDoor.id).toBe("safaktan-once");
    expect(viaDoor.paragraphs[0]).toBe("Paslı kilide omzunla yükleniyorsun.");
    expect(viaDoor.paragraphs.join("\n")).not.toContain("Tünel daralıyor");
    expect(viaTunnel.paragraphs[0]).toMatch(/^Tünel daralıyor/);
    expect(viaTunnel.paragraphs.join("\n")).not.toContain("Paslı kilide");

    const viaDance = manorChoose("balo-salonu", "G");
    const viaTorches = manorChoose("yeralti-gecidi", "P");
    expect(viaDance.paragraphs[0]).toMatch(/^Parmakların soğuk/);
    expect(viaDance.paragraphs.join("\n")).not.toContain("Meşalelerin peşinden");
    expect(viaTorches.paragraphs[0]).toMatch(/^Meşalelerin peşinden/);
    expect(viaTorches.paragraphs.join("\n")).not.toContain("Parmakların soğuk");

    // The print edition's signposts are not shown once the route is known
    for (const view of [viaDoor, viaTunnel, viaDance, viaTorches]) {
      expect(view.paragraphs.join("\n")).not.toMatch(/geldiysen|ettiysen|zorladıysan|tuttuysan|birleşiyor/);
      // Both routes continue with the same text
      expect(view.paragraphs.at(-1)).toBe(
        view.id === "safaktan-once" ? "Kayboluyor." : "Gülümsüyorsun.",
      );
    }
  });

  it("closes each ending with its SON lines", () => {
    const ending = manorChoose("balo-salonu", "H");
    expect(ending.kind).toBe("ending");
    expect(ending.choices).toEqual([]);
    expect(ending.verdict).toEqual(["Müziği susturdun.", "Malikâne yalnızca yeni bir müzisyen buldu."]);
  });
});

describe("manor game service", () => {
  it("never tells the browser where a choice leads", () => {
    const start = manorStart();
    expect(start.choices).toEqual([
      { letter: "A", label: "Portrelerin arasındaki koridora ilerle." },
      { letter: "B", label: "Merdivenlerden ikinci kata çık." },
    ]);
    expect(JSON.stringify(start)).not.toMatch(/PORTRELER KORİDORU|İKİNCİ KAT|portreler-koridoru/);
  });

  it("gives the cover no scene text, ending or lore", () => {
    const cover = manorCover();
    expect(cover.endingCount).toBe(5);
    expect(JSON.stringify(cover)).not.toMatch(/Büyük meşe kapı|SON|MERAKLISINA|Tuanna/);
  });

  it("refuses a choice the room does not offer", () => {
    expect(() => manorChoose("giris-kapisi", "C")).toThrow("Bu kapı malikânede yok.");
    expect(() => manorChoose("safaktan-once", "A")).toThrow("Bu kapı malikânede yok.");
    expect(() => manorChoose("yok-boyle-oda", "A")).toThrow("Bu kapı malikânede yok.");
  });
});

describe("manor game parser", () => {
  const minimal = (target: string) =>
    [
      "# BAŞLIK",
      "",
      "*Giriş.*",
      "",
      "# ODA",
      "",
      "Metin.",
      "",
      "**A — Git.**  ",
      `→ **${target}**`,
      "",
      "**B — Kal.**  ",
      "→ **SON: SONU**",
      "",
      "# SONLAR",
      "",
      "## SONU",
      "",
      "Bitti.",
      "",
      "### SON",
      "",
      "**Çıkamadın.**",
      "",
      "# MERAKLISINA: HİKÂYE",
      "",
      "Eskiden.",
    ].join("\n");

  it("parses a well-formed story", () => {
    const story = parseManorStory(minimal("SON: SONU"));
    expect(story.scenes.oda?.choices.map((choice) => choice.target)).toEqual(["sonu", "sonu"]);
    expect(story.endings.sonu?.verdict).toEqual(["Çıkamadın."]);
  });

  it("refuses a choice that points at a heading that does not exist", () => {
    expect(() => parseManorStory(minimal("KAYIP ODA"))).toThrow(/missing "kayip-oda"/);
  });

  it("accepts Windows line endings", () => {
    expect(parseManorStory(minimal("SON: SONU").replace(/\n/g, "\r\n")).startId).toBe("oda");
  });
});

describe("canPreviewManorGame", () => {
  const base = (overrides: Partial<Actor & { email: string }> = {}) => ({
    id: "user-1",
    role: "user" as const,
    writerStatus: null,
    editorStatus: null,
    emailVerifiedAt: new Date("2026-01-01"),
    isBanned: false,
    email: "okur@example.com",
    ...overrides,
  });

  it("opens for an admin", () => {
    expect(canPreviewManorGame(base({ role: "admin" }))).toBe(true);
  });

  it("opens for the listed address, whatever its role", () => {
    expect(MANOR_GAME_PREVIEW_EMAILS).toEqual(["semrailhan@outlook.com"]);
    expect(canPreviewManorGame(base({ email: "semrailhan@outlook.com" }))).toBe(true);
    expect(canPreviewManorGame(base({ email: "semrailhan@outlook.com", role: "writer", writerStatus: "active" }))).toBe(
      true,
    );
  });

  it("stays shut for every other account", () => {
    expect(canPreviewManorGame(base())).toBe(false);
    expect(canPreviewManorGame(base({ role: "writer", writerStatus: "active" }))).toBe(false);
    expect(canPreviewManorGame(base({ role: "editor", editorStatus: "active" }))).toBe(false);
    // Near misses of the listed address
    expect(canPreviewManorGame(base({ email: "semrailhan@outlook.com.tr" }))).toBe(false);
    expect(canPreviewManorGame(base({ email: "xsemrailhan@outlook.com" }))).toBe(false);
  });

  it("stays shut for the listed address while it is unverified or banned", () => {
    expect(canPreviewManorGame(base({ email: "semrailhan@outlook.com", emailVerifiedAt: null }))).toBe(false);
    expect(canPreviewManorGame(base({ email: "semrailhan@outlook.com", isBanned: true }))).toBe(false);
  });

  it("stays shut for a banned or unverified admin", () => {
    expect(canPreviewManorGame(base({ role: "admin", isBanned: true }))).toBe(false);
    expect(canPreviewManorGame(base({ role: "admin", emailVerifiedAt: null }))).toBe(false);
  });
});
