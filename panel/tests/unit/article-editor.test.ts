/**
 * Which editor an article on the "Kategoriye düşen yazılar" list is with
 * (D-152), and the id that lets the list lead to their account (D-233).
 */
import { describe, expect, it } from "vitest";
import { editorForArticle, type AreaEditor } from "@/lib/article-editor";

const AREAS: AreaEditor[] = [
  { name: "Psikoloji", holderEditorId: "editor-1", holderEditorName: "Deniz Editör" },
  { name: "Kültür", holderEditorId: null, holderEditorName: null },
];

const MAIN = { id: "main-1", displayName: "Ana" };

describe("editorForArticle", () => {
  it("routes an article to the editor holding its area, with their id", () => {
    expect(editorForArticle({ category: "Psikoloji", status: "in_review" }, AREAS, MAIN)).toEqual({
      kind: "editor",
      id: "editor-1",
      name: "Deniz Editör",
    });
  });

  it("matches the area name whatever its case or spacing", () => {
    expect(editorForArticle({ category: "  PSİKOLOJİ ", status: "draft" }, AREAS, null)).toEqual({
      kind: "editor",
      id: "editor-1",
      name: "Deniz Editör",
    });
  });

  it("says unassigned for an area with no editor and for an unknown area", () => {
    expect(editorForArticle({ category: "Kültür", status: "in_review" }, AREAS, MAIN)).toEqual({
      kind: "unassigned",
    });
    expect(editorForArticle({ category: "Astroloji", status: "in_review" }, AREAS, MAIN)).toEqual({
      kind: "unassigned",
    });
  });

  it("says unassigned when a holder has a name but no id to lead to", () => {
    // Not a shape the database produces, but the cell must not build a link
    // to nowhere if it ever did
    const broken: AreaEditor[] = [{ name: "Sinema", holderEditorId: null, holderEditorName: "Kim" }];
    expect(editorForArticle({ category: "Sinema", status: "in_review" }, broken, MAIN)).toEqual({
      kind: "unassigned",
    });
  });

  it("routes an article with no category to nobody", () => {
    expect(editorForArticle({ category: null, status: "draft" }, AREAS, MAIN)).toEqual({
      kind: "none",
    });
    expect(editorForArticle({ category: "   ", status: "draft" }, AREAS, MAIN)).toEqual({
      kind: "none",
    });
  });

  it("hands the second approval stage to the main editor, area or not", () => {
    expect(
      editorForArticle({ category: "Psikoloji", status: "pending_admin_approval" }, AREAS, MAIN),
    ).toEqual({ kind: "main", person: MAIN });

    // Nobody carries the flag yet: the list says so instead of naming an editor
    expect(
      editorForArticle({ category: null, status: "pending_admin_approval" }, AREAS, null),
    ).toEqual({ kind: "main", person: null });
  });
});
