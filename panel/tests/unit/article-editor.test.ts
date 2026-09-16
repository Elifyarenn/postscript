/**
 * Which editor an article on the "Kategoriye düşen yazılar" list is with
 * (D-152).
 */
import { describe, expect, it } from "vitest";
import { editorForArticle, type AreaEditor } from "@/lib/article-editor";

const AREAS: AreaEditor[] = [
  { name: "Psikoloji", holderEditorName: "Deniz Editör" },
  { name: "Kültür", holderEditorName: null },
];

describe("editorForArticle", () => {
  it("routes an article to the editor holding its area", () => {
    expect(editorForArticle({ category: "Psikoloji", status: "in_review" }, AREAS, "Ana")).toEqual({
      kind: "editor",
      name: "Deniz Editör",
    });
  });

  it("matches the area name whatever its case or spacing", () => {
    expect(
      editorForArticle({ category: "  PSİKOLOJİ ", status: "draft" }, AREAS, null),
    ).toEqual({ kind: "editor", name: "Deniz Editör" });
  });

  it("says unassigned for an area with no editor and for an unknown area", () => {
    expect(editorForArticle({ category: "Kültür", status: "in_review" }, AREAS, "Ana")).toEqual({
      kind: "unassigned",
    });
    expect(editorForArticle({ category: "Astroloji", status: "in_review" }, AREAS, "Ana")).toEqual({
      kind: "unassigned",
    });
  });

  it("routes an article with no category to nobody", () => {
    expect(editorForArticle({ category: null, status: "draft" }, AREAS, "Ana")).toEqual({
      kind: "none",
    });
    expect(editorForArticle({ category: "   ", status: "draft" }, AREAS, "Ana")).toEqual({
      kind: "none",
    });
  });

  it("hands the second approval stage to the main editor, area or not", () => {
    expect(
      editorForArticle({ category: "Psikoloji", status: "pending_admin_approval" }, AREAS, "Ana"),
    ).toEqual({ kind: "main", name: "Ana" });

    // Nobody carries the flag yet: the list says so instead of naming an editor
    expect(
      editorForArticle({ category: null, status: "pending_admin_approval" }, AREAS, null),
    ).toEqual({ kind: "main", name: null });
  });
});
