import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ILLUSTRATOR_GUIDE, MAIN_EDITOR_GUIDE, WRITER_GUIDE, type GuideBlock, type PanelGuide } from "@/lib/panel-guides";
import { GUIDES, GUIDE_PATHS, editorGuideKey, helpTargets, resolveHelpHref, resolveHelpTarget, type GuideKey } from "@/lib/panel-guides/help";
import { ADMIN_NAV, editorNav, illustratorNav, writerNav, type NavGroup } from "@/components/shell";
import { MAX_SIGNED_CONTRACT_MB } from "@/services/signed-contracts";

// The guides point at panel pages; a renamed or removed page must fail here,
// not leave a dead "Sayfaya git" link or a help button to nowhere (D-384).
const APP = path.resolve(__dirname, "../../src/app");

function routeExists(href: string): boolean {
  const segments = href.replace(/^\//, "").replace(/\/$/, "").split("/").filter(Boolean);
  return existsSync(path.join(APP, ...segments, "page.tsx")) || existsSync(path.join(APP, ...segments));
}

const ALL = Object.entries(GUIDES) as [GuideKey, PanelGuide][];

const hrefs = (groups: NavGroup[]) =>
  groups.flatMap((group) => group.items.flatMap((item) => [item.href, ...(item.children ?? []).map((c) => c.href)]));

const blocks = (guide: PanelGuide): GuideBlock[] => guide.sections.flatMap((section) => section.blocks);

function resolve(key: GuideKey, pathname: string): string | null {
  return resolveHelpHref(helpTargets(key), GUIDE_PATHS[key], pathname);
}

describe("panel guides", () => {
  it.each(ALL)("%s guide links only to pages that exist", (_key, guide) => {
    for (const section of guide.sections) {
      for (const href of [...(section.href ? [section.href] : []), ...(section.pages ?? [])]) {
        expect(routeExists(href), href).toBe(true);
      }
    }
  });

  it.each(ALL)("%s guide has unique anchors and no empty section", (_key, guide) => {
    const ids = guide.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of guide.sections) expect(section.blocks.length).toBeGreaterThan(0);
  });

  it.each(ALL)("%s guide has balanced label markers", (_key, guide) => {
    for (const block of blocks(guide)) {
      const texts = block.kind === "steps" || block.kind === "list" ? block.items : block.kind === "p" || block.kind === "note" ? [block.text] : [];
      for (const text of texts) expect((text.match(/\*\*/g) ?? []).length % 2, text).toBe(0);
    }
  });

  it.each(ALL)("%s guide carries pictures, not only text", (_key, guide) => {
    const visual = blocks(guide).filter((block) => ["figure", "flow", "timeline", "compare"].includes(block.kind));
    // At least one picture for every three sections
    expect(visual.length).toBeGreaterThanOrEqual(Math.ceil(guide.sections.length / 3));
    for (const block of visual) {
      if (block.kind === "flow") expect(block.steps.length).toBeGreaterThanOrEqual(2);
      if (block.kind === "compare") expect(block.items.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(ALL)("%s guide links outside only over https, each with a note", (_key, guide) => {
    for (const block of blocks(guide)) {
      if (block.kind !== "links") continue;
      for (const link of block.items) {
        expect(new URL(link.href).protocol, link.href).toBe("https:");
        expect(link.note.length).toBeGreaterThan(10);
      }
    }
  });

  it("writers and çizers are told to initial every page and scan all pages", () => {
    for (const guide of [WRITER_GUIDE, ILLUSTRATOR_GUIDE]) {
      const signing = guide.sections.find((section) => section.id === "imza-ve-tarama");
      expect(signing).toBeDefined();
      const text = JSON.stringify(signing);
      expect(text).toContain("Her sayfanın");
      expect(text).toContain("Bütün sayfaları");
      // The limit the guide quotes is the one the upload enforces
      expect(text).toContain(`${MAX_SIGNED_CONTRACT_MB} MB`);
    }
  });

  it("the main editor has a guide of its own with the main editor's pages", () => {
    const pages = MAIN_EDITOR_GUIDE.sections.map((section) => section.href);
    for (const href of ["/editor/topics", "/editor/gecici-alan", "/editor/mail", "/editor/team"]) {
      expect(pages).toContain(href);
    }
    // ...and the category editor's guide does not explain pages its reader cannot open
    const categoryPages = GUIDES.editor.sections.map((section) => section.href);
    for (const href of ["/editor/topics", "/editor/gecici-alan", "/editor/mail", "/editor/team"]) {
      expect(categoryPages).not.toContain(href);
    }
  });

  it("every panel sidebar links to its reader's guide, and the guide pages exist", () => {
    expect(hrefs(ADMIN_NAV)).toContain(GUIDE_PATHS.admin);
    expect(hrefs(editorNav(false))).toContain(GUIDE_PATHS.editor);
    expect(hrefs(editorNav(true, true, true, true))).toContain(GUIDE_PATHS.mainEditor);
    expect(hrefs(editorNav(true, true, true, true))).not.toContain(GUIDE_PATHS.editor);
    expect(hrefs(illustratorNav())).toContain(GUIDE_PATHS.illustrator);
    for (const href of Object.values(GUIDE_PATHS)) expect(routeExists(href), href).toBe(true);
  });

  it("a locked writer still reaches the guide", () => {
    const guide = writerNav(true).flatMap((group) => group.items).find((item) => item.href === GUIDE_PATHS.writer);
    expect(guide).toBeDefined();
    expect(guide?.disabled).toBeFalsy();
  });

  it("an editor-route visitor gets their own guide", () => {
    expect(editorGuideKey({ role: "admin", isMainEditor: false })).toBe("admin");
    expect(editorGuideKey({ role: "editor", isMainEditor: true })).toBe("mainEditor");
    expect(editorGuideKey({ role: "editor", isMainEditor: false })).toBe("editor");
  });
});

describe("the header's help button", () => {
  it("opens the section of the page, the most specific one winning", () => {
    expect(resolve("writer", "/writer/articles")).toBe("/writer/rehber#yazilarim");
    expect(resolve("writer", "/writer/articles/new")).toBe("/writer/rehber#yeni-yazi");
    expect(resolve("writer", "/writer/articles/3f2a")).toBe("/writer/rehber#gonderme");
    expect(resolve("writer", "/writer/agreement")).toBe("/writer/rehber#sozlesme");
    expect(resolve("editor", "/editor/articles/3f2a")).toBe("/editor/rehber#makale");
    expect(resolve("mainEditor", "/editor/topics")).toBe("/editor/rehber/ana-editor#konu-onerileri");
    expect(resolve("admin", "/admin/users/writers")).toBe("/admin/rehber#kullanicilar");
    expect(resolve("admin", "/admin/users/3f2a")).toBe("/admin/rehber#kullanici-detayi");
    expect(resolve("admin", "/admin/agreements/imza")).toBe("/admin/rehber#imza-arsivi");
    expect(resolve("admin", "/editor/issues/3f2a/sayfalar")).toBe("/admin/rehber#sayfalar");
    expect(resolve("illustrator", "/cizer/cizimler")).toBe("/cizer/rehber#cizimler");
  });

  it("does not match a longer word that only starts the same", () => {
    expect(resolve("admin", "/admin/usersx")).toBe("/admin/rehber#genel-bakis");
  });

  it("falls back to the top of the guide and hides on guide pages", () => {
    expect(resolve("illustrator", "/cizer/unknown")).toBe("/cizer/rehber#sozlesme");
    expect(resolve("writer", "/writer/rehber")).toBeNull();
    expect(resolve("mainEditor", "/editor/rehber")).toBeNull();
    expect(resolve("mainEditor", "/editor/rehber/ana-editor")).toBeNull();
  });
});

describe("help links in the panel pages (D-386)", () => {
  const SRC = path.resolve(__dirname, "../../src");
  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sources(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }
  const files = sources(SRC).filter((file) => !file.includes(`${path.sep}panel-guides${path.sep}`));
  const sectionIds = (key: GuideKey) => new Set(GUIDES[key].sections.map((section) => section.id));
  const keyByPath = Object.fromEntries(Object.entries(GUIDE_PATHS).map(([key, guidePath]) => [guidePath, key])) as Record<string, GuideKey>;

  it("every written-out guide link opens a section that exists", () => {
    let seen = 0;
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/"(\/(?:admin|editor|writer|cizer)\/rehber(?:\/ana-editor)?)#([a-z0-9-]+)"/g)) {
        const key = keyByPath[match[1]!];
        expect(key, match[0]).toBeDefined();
        expect(sectionIds(key!).has(match[2]!), `${path.basename(file)}: ${match[0]}`).toBe(true);
        seen += 1;
      }
      for (const match of text.matchAll(/guideHref\("(admin|mainEditor|editor|writer|illustrator)", "([a-z0-9-]+)"\)/g)) {
        expect(sectionIds(match[1] as GuideKey).has(match[2]!), `${path.basename(file)}: ${match[0]}`).toBe(true);
        seen += 1;
      }
    }
    expect(seen).toBeGreaterThanOrEqual(10);
  });

  it("the editor article page's per-reader sections exist in each reader's guide", () => {
    const text = readFileSync(path.join(SRC, "app/editor/articles/[id]/page.tsx"), "utf8");
    const table = text.slice(text.indexOf("const STATUS_SECTION"), text.indexOf("};", text.indexOf("const STATUS_SECTION")));
    for (const match of table.matchAll(/(\w+): "([a-z0-9-]+)"/g)) {
      expect(sectionIds(match[1] as GuideKey).has(match[2]!), match[0]).toBe(true);
    }
    for (const key of ["admin", "mainEditor", "editor"] as const) {
      expect(sectionIds(key).has(key === "admin" ? "yayin-akisi" : "makale")).toBe(true);
      expect(sectionIds(key).has("medya")).toBe(true);
    }
  });

  it("the page-title link names the section it opens", () => {
    expect(resolveHelpTarget(helpTargets("writer"), GUIDE_PATHS.writer, "/writer/approvals")).toEqual({
      href: "/writer/rehber#eser-onaylari",
      title: "Eser Onayları",
    });
    expect(resolveHelpTarget(helpTargets("illustrator"), GUIDE_PATHS.illustrator, "/cizer/rehber")).toBeNull();
  });
});
