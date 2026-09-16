/**
 * Which editor a listed article is with (D-152).
 *
 * The magazine routes an article by its category: an area belongs to exactly
 * one editor (D-059), so the holder of the article's area is the reviewer it
 * lands on. The second review stage belongs to the main editor, so an article
 * waiting for that approval is on their desk, not the area editor's.
 *
 * Kept a pure function so the rule is tested without a database and lives in
 * one place instead of inside a table cell.
 */
import type { ArticleStatus } from "@/db/schema";

/** An area and the editor holding it, as `listEditorAreasWithHolders` returns. */
export type AreaEditor = { name: string; holderEditorName: string | null };

export type ArticleEditor =
  /** The category editor the article lands on. */
  | { kind: "editor"; name: string }
  /** The second stage: the main editor, who may not be appointed yet. */
  | { kind: "main"; name: string | null }
  /** The article has an area, but nobody holds it. */
  | { kind: "unassigned" }
  /** No category yet, so the article is routed to nobody. */
  | { kind: "none" };

/** Turkish-aware, so "İLETİŞİM" and "iletişim" are the same area. */
function key(name: string): string {
  return name.trim().toLocaleLowerCase("tr");
}

export function editorForArticle(
  article: { category: string | null; status: ArticleStatus },
  areas: readonly AreaEditor[],
  mainEditorName: string | null,
): ArticleEditor {
  // The second stage is the main editor's whatever the area is (D-059)
  if (article.status === "pending_admin_approval") {
    return { kind: "main", name: mainEditorName };
  }

  const category = article.category?.trim();
  if (!category) return { kind: "none" };

  const area = areas.find((candidate) => key(candidate.name) === key(category));
  // An unknown area name and an area with no editor read the same to a reader
  // of the list: nobody is responsible for this article yet
  if (!area?.holderEditorName) return { kind: "unassigned" };

  return { kind: "editor", name: area.holderEditorName };
}
