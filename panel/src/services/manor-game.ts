/**
 * The manor game's server side (D-263).
 *
 * The browser is handed one scene at a time: the opening screen gets the
 * title and the rules, each choice asks the server for the next scene, and
 * the lore comes only on request. Scenes, endings and the lore the reader has
 * not reached are therefore never in the page, not even hidden with CSS.
 * Nothing is stored; the reader's route lives in the page until it reloads.
 */
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseManorStory, type ManorStory } from "@/lib/manor-game/story";
import { notFound } from "@/lib/errors";

export const MANOR_STORY_FILE = path.join("data", "malikane-oyunu.txt");

let cached: ManorStory | null = null;

/** Parsed once per server instance; the text only changes with a deploy. */
export function manorStory(): ManorStory {
  cached ??= parseManorStory(readFileSync(path.join(process.cwd(), MANOR_STORY_FILE), "utf8"));
  return cached;
}

/** What the opening screen shows before the first door. */
export type ManorCover = {
  title: string;
  lede: string;
  howToPlay: string[];
  endingCount: number;
};

/** One screen of the game, as the browser receives it. */
export type ManorSceneView = {
  kind: "scene" | "ending";
  id: string;
  title: string;
  paragraphs: string[];
  /** Letters and labels only: where a choice leads stays on the server. */
  choices: { letter: string; label: string }[];
  /** An ending's closing lines; empty for a scene. */
  verdict: string[];
};

export function manorCover(): ManorCover {
  const story = manorStory();
  return {
    title: story.title,
    lede: story.lede,
    howToPlay: story.howToPlay,
    endingCount: Object.keys(story.endings).length,
  };
}

/** The first scene, behind the entrance door. */
export function manorStart(): ManorSceneView {
  const story = manorStory();
  const scene = story.scenes[story.startId]!;
  return {
    kind: "scene",
    id: scene.id,
    title: scene.title,
    paragraphs: scene.paragraphs,
    choices: scene.choices.map(({ letter, label }) => ({ letter, label })),
    verdict: [],
  };
}

/**
 * Follows one choice. Only a choice the scene actually offers is followed, so
 * the route can only be walked the way the text allows. An ending reached from
 * two places opens with the intro of the route the reader came by.
 */
export function manorChoose(sceneId: string, letter: string): ManorSceneView {
  const story = manorStory();
  const choice = story.scenes[sceneId]?.choices.find((candidate) => candidate.letter === letter);
  if (!choice) throw notFound("Bu kapı malikânede yok.");

  const scene = story.scenes[choice.target];
  if (scene) {
    return {
      kind: "scene",
      id: scene.id,
      title: scene.title,
      paragraphs: scene.paragraphs,
      choices: scene.choices.map(({ letter: next, label }) => ({ letter: next, label })),
      verdict: [],
    };
  }

  const ending = story.endings[choice.target]!;
  return {
    kind: "ending",
    id: ending.id,
    title: ending.title,
    paragraphs: [...(ending.intros[`${sceneId}:${letter}`] ?? []), ...ending.paragraphs],
    choices: [],
    verdict: ending.verdict,
  };
}

export function manorLore(): ManorStory["lore"] {
  return manorStory().lore;
}
