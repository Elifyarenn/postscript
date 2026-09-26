"use server";

/**
 * The manor game's steps (D-263). They change nothing, but they are the only
 * way the story reaches the browser, so each one checks the same door as the
 * page: calling an action directly without the preview right gets a refusal,
 * not a scene.
 */
import { z } from "zod";
import { requireManorGamePreview } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { manorChoose, manorLore, manorStart, type ManorSceneView } from "@/services/manor-game";

export type ManorResult<T> = { ok: true; value: T } | { ok: false; error: string };

const choiceInput = z.strictObject({
  sceneId: z.string().trim().min(1).max(96),
  letter: z.string().regex(/^[A-Z]$/),
});

async function run<T>(body: () => T): Promise<ManorResult<T>> {
  try {
    await requireManorGamePreview();
    return { ok: true, value: body() };
  } catch (error) {
    if (isAppError(error)) return { ok: false, error: error.message };
    console.error("Manor game action failed:", error);
    return { ok: false, error: "Malikânenin kapıları şu an açılmıyor." };
  }
}

export async function enterManorAction(): Promise<ManorResult<ManorSceneView>> {
  return run(manorStart);
}

export async function chooseManorAction(input: {
  sceneId: string;
  letter: string;
}): Promise<ManorResult<ManorSceneView>> {
  const parsed = choiceInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bu kapı malikânede yok." };
  return run(() => manorChoose(parsed.data.sceneId, parsed.data.letter));
}

export async function readManorLoreAction(): Promise<ManorResult<ReturnType<typeof manorLore>>> {
  return run(manorLore);
}
