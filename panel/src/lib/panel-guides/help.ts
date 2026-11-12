import { ADMIN_GUIDE } from "./admin";
import { EDITOR_GUIDE } from "./editor";
import { ILLUSTRATOR_GUIDE } from "./illustrator";
import { MAIN_EDITOR_GUIDE } from "./main-editor";
import type { HelpTarget } from "./help-match";
import type { PanelGuide } from "./types";
import { WRITER_GUIDE } from "./writer";

/**
 * Which guide section explains the page the user is on (D-384). The panel
 * header's help button and the guide pages read the same data, so a section
 * that moves takes its button with it.
 */

export type GuideKey = "admin" | "mainEditor" | "editor" | "writer" | "illustrator";

export const GUIDES: Record<GuideKey, PanelGuide> = {
  admin: ADMIN_GUIDE,
  mainEditor: MAIN_EDITOR_GUIDE,
  editor: EDITOR_GUIDE,
  writer: WRITER_GUIDE,
  illustrator: ILLUSTRATOR_GUIDE,
};

export const GUIDE_PATHS: Record<GuideKey, string> = {
  admin: "/admin/rehber",
  // The main editor's own guide, apart from the category editor's
  mainEditor: "/editor/rehber/ana-editor",
  editor: "/editor/rehber",
  writer: "/writer/rehber",
  illustrator: "/cizer/rehber",
};

/** The guide an editor-route visitor reads: the admin's, the main editor's or the category editor's. */
export function editorGuideKey(user: { role: string; isMainEditor: boolean }): GuideKey {
  if (user.role === "admin") return "admin";
  return user.isMainEditor ? "mainEditor" : "editor";
}

/** A link to one section of a guide. */
export function guideHref(key: GuideKey, sectionId?: string): string {
  return sectionId ? `${GUIDE_PATHS[key]}#${sectionId}` : GUIDE_PATHS[key];
}

export function helpTargets(key: GuideKey): HelpTarget[] {
  return GUIDES[key].sections.flatMap((section) =>
    [...(section.href ? [section.href] : []), ...(section.pages ?? [])].map((pattern) => ({
      pattern,
      href: guideHref(key, section.id),
      title: section.title,
    })),
  );
}

export { resolveHelpHref, resolveHelpTarget, type HelpTarget } from "./help-match";
