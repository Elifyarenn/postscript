/**
 * "Lanetli Malikâneden Çıkabilecek Misin?" — the branching story game (D-263).
 *
 * The story is written as a gamebook in `doc/malikane oyunu.txt` and that file
 * stays the only place the text lives; `data/malikane-oyunu.txt` is its byte
 * for byte copy inside the deployed folder, and a unit test fails when the two
 * drift apart. This module turns the text into scenes and choices. It is pure
 * so the whole route tree can be checked without a request.
 *
 * The parser is strict on purpose: a choice pointing at a heading that does
 * not exist, a repeated letter or an ending without its "SON" block throws,
 * so a broken edit to the text fails the tests instead of stranding a reader.
 */
import { slugify } from "@/lib/slug";

/** One paragraph of the source, inline `**bold**` and `*italic*` kept as written. */
export type StoryParagraph = string;

export type StoryChoice = {
  letter: string;
  label: string;
  target: string;
};

export type StoryScene = {
  kind: "scene";
  id: string;
  title: string;
  paragraphs: StoryParagraph[];
  choices: StoryChoice[];
};

/**
 * An ending reached from two places opens with a short intro per route and
 * then one shared text (the consistency pass on the source did this). The
 * reader only ever gets the intro of the route they took.
 */
export type StoryEnding = {
  kind: "ending";
  id: string;
  title: string;
  /** Per incoming choice (`"<sceneId>:<letter>"`), the route's own opening. */
  intros: Record<string, StoryParagraph[]>;
  paragraphs: StoryParagraph[];
  /** The bold closing lines under "### SON". */
  verdict: string[];
};

export type ManorStory = {
  title: string;
  /** The italic line under the title. */
  lede: string;
  howToPlay: StoryParagraph[];
  startId: string;
  scenes: Record<string, StoryScene>;
  endings: Record<string, StoryEnding>;
  lore: { title: string; paragraphs: StoryParagraph[] };
};

type Section = { level: number; title: string; paragraphs: string[] };

const CHOICE = /^\*\*([A-Z]) — (.+?)\*\*\s*\n→ \*\*(SON: )?(.+?)\*\*$/;
// "*Gölgenin elini tuttuysan:*" — an italic line ending in a colon heads a route intro
const ROUTE_LABEL = /^\*[^*].*:\*$/;

function splitSections(source: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!current) return;
    current.paragraphs.push(
      ...buffer
        .join("\n")
        .split(/\n\s*\n/)
        .map((block) => block.replace(/[ \t]+$/gm, "").trim())
        .filter((block) => block !== "" && block !== "---"),
    );
    buffer = [];
  };

  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      flush();
      current = { level: heading[1]!.length, title: heading[2]!.trim(), paragraphs: [] };
      sections.push(current);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

/** A stable id from a heading: "KİLER VE ARKA ÇIKIŞ" → "kiler-ve-arka-cikis". */
export function sceneIdOf(title: string): string {
  return slugify(title.replace(/^SON:\s*/, ""));
}

function parseScene(section: Section): StoryScene {
  const paragraphs: string[] = [];
  const choices: StoryChoice[] = [];
  for (const paragraph of section.paragraphs) {
    const match = CHOICE.exec(paragraph);
    if (match) {
      choices.push({ letter: match[1]!, label: match[2]!.trim(), target: sceneIdOf(match[4]!) });
    } else if (choices.length > 0) {
      throw new Error(`"${section.title}": text after the choices`);
    } else {
      paragraphs.push(paragraph);
    }
  }
  if (choices.length === 0) throw new Error(`"${section.title}" has no choices`);
  return { kind: "scene", id: sceneIdOf(section.title), title: section.title, paragraphs, choices };
}

export function parseManorStory(source: string): ManorStory {
  const sections = splitSections(source);
  const [head, ...rest] = sections;
  if (!head || head.level !== 1) throw new Error("The story must open with its title");

  const lede = head.paragraphs[0]?.replace(/^\*(.+)\*$/s, "$1") ?? "";
  let howToPlay: string[] = [];
  const scenes: Record<string, StoryScene> = {};
  const endingSections: Section[] = [];
  let lore: ManorStory["lore"] | null = null;
  let startId: string | null = null;

  // Top level headings are scenes until "SONLAR"; its "##" children are the
  // endings (each split by "### SON"); the "MERAKLISINA" heading is the lore
  let zone: "scenes" | "endings" | "lore" = "scenes";
  for (let index = 0; index < rest.length; index++) {
    const section = rest[index]!;
    if (section.level === 1 && section.title === "SONLAR") {
      zone = "endings";
    } else if (section.level === 1 && section.title.startsWith("MERAKLISINA")) {
      zone = "lore";
      lore = { title: section.title.replace(/^MERAKLISINA:\s*/, ""), paragraphs: section.paragraphs };
    } else if (zone === "scenes" && section.level === 2) {
      howToPlay = section.paragraphs;
    } else if (zone === "scenes" && section.level === 1) {
      const scene = parseScene(section);
      if (scenes[scene.id]) throw new Error(`Duplicate scene "${scene.title}"`);
      scenes[scene.id] = scene;
      startId ??= scene.id;
    } else if (zone === "endings" && section.level === 2) {
      const verdict = rest[index + 1];
      if (!verdict || verdict.level !== 3 || verdict.title !== "SON") {
        throw new Error(`Ending "${section.title}" has no "### SON" block`);
      }
      endingSections.push({ ...section, paragraphs: [...section.paragraphs, "\u0000", ...verdict.paragraphs] });
      index++;
    } else {
      throw new Error(`Unexpected heading "${section.title}"`);
    }
  }

  if (!startId) throw new Error("The story has no scenes");
  if (!lore) throw new Error("The story has no lore section");

  // Which choices lead into each ending, in the order they appear in the text
  const incoming: Record<string, string[]> = {};
  const letters = new Set<string>();
  for (const scene of Object.values(scenes)) {
    for (const choice of scene.choices) {
      if (letters.has(choice.letter)) throw new Error(`Choice letter ${choice.letter} is used twice`);
      letters.add(choice.letter);
      (incoming[choice.target] ??= []).push(`${scene.id}:${choice.letter}`);
    }
  }

  const endings: Record<string, StoryEnding> = {};
  for (const section of endingSections) {
    const id = sceneIdOf(section.title);
    const cut = section.paragraphs.indexOf("\u0000");
    const body = section.paragraphs.slice(0, cut);
    const verdict = section.paragraphs.slice(cut + 1).map((line) => line.replace(/^\*\*(.+)\*\*$/s, "$1"));

    const labels = body.flatMap((paragraph, at) => (ROUTE_LABEL.test(paragraph) ? [at] : []));
    const intros: Record<string, string[]> = {};
    let paragraphs = body;
    if (labels.length > 0) {
      // The last label is the "both roads meet here" line; the ones before it
      // open one route each, in the same order as the choices leading in
      const routes = incoming[id] ?? [];
      const introLabels = labels.slice(0, -1);
      if (introLabels.length !== routes.length || labels[0] !== 0) {
        throw new Error(`Ending "${section.title}": ${introLabels.length} intros for ${routes.length} routes`);
      }
      introLabels.forEach((start, at) => {
        intros[routes[at]!] = body.slice(start + 1, labels[at + 1]);
      });
      paragraphs = body.slice(labels.at(-1)! + 1);
    }
    endings[id] = { kind: "ending", id, title: section.title, intros, paragraphs, verdict };
  }

  // Every choice must land somewhere real; a typo in a target is a dead end
  for (const scene of Object.values(scenes)) {
    for (const choice of scene.choices) {
      if (!scenes[choice.target] && !endings[choice.target]) {
        throw new Error(`Choice ${choice.letter} in "${scene.title}" points at a missing "${choice.target}"`);
      }
    }
  }

  return { title: head.title, lede, howToPlay, startId, scenes, endings, lore };
}
