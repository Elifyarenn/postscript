/**
 * The shape of a designed issue kept in code (D-274).
 *
 * The designers deliver Illustrator files; `scripts/render-issue-design.ts`
 * turns the pages listed in a manifest into WebP files under
 * `assets/issue-design/<folder>/`, and `importIssueDesign` puts exactly those
 * pages, in exactly this order, into the issue. The manifest is the one place
 * the order, the sources and the clickable areas are decided.
 *
 * Pure on purpose: no file system, no database, so the rules below are unit
 * tested and the same checks run in the script and in the service.
 */
import { z } from "zod";
import { quizInputSchema, quizProblems } from "../issue-quiz";

/** A page key is part of a file name and of the page's label: keep it plain. */
export const DESIGN_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Every design page's label starts with this, followed by its key. */
export const DESIGN_LABEL_PREFIX = "Tasarım · ";

/** Where a design page's key is read back from its label. */
const LABEL_KEY = /^Tasarım · ([a-z0-9-]+)(?: · |$)/;

export function designLabel(key: string, title: string): string {
  return `${DESIGN_LABEL_PREFIX}${key} · ${title}`.slice(0, 120);
}

export function designKeyOf(label: string | null): string | null {
  return label ? (LABEL_KEY.exec(label)?.[1] ?? null) : null;
}

/** Rectangle in fractions of the page picture: [x, y, width, height]. */
const rect = z
  .tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().gt(0).max(1), z.number().gt(0).max(1)])
  .refine(([x, y, w, h]) => x + w <= 1.0001 && y + h <= 1.0001, "Alan sayfanın dışına taşıyor.");

const areaBase = {
  /** What the panel and a screen reader call the area. */
  name: z.string().trim().min(1).max(120),
  rect,
  showMarker: z.boolean().optional(),
};

export const designAreaSchema = z.discriminatedUnion("kind", [
  /** Jumps to another page of this manifest, by its key. */
  z.strictObject({ kind: z.literal("page"), ...areaBase, target: z.string().regex(DESIGN_KEY) }),
  z.strictObject({ kind: z.literal("link"), ...areaBase, url: z.url({ protocol: /^https?$/ }) }),
  z.strictObject({
    kind: z.literal("info"),
    ...areaBase,
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(4000),
  }),
  /** Opens a quiz of the issue, found by its exact title: one of `quizzes` below, or one written in the panel. */
  z.strictObject({ kind: z.literal("quiz"), ...areaBase, quizTitle: z.string().trim().min(1).max(200) }),
]);

export const designPageSchema = z.strictObject({
  key: z.string().regex(DESIGN_KEY),
  /** The delivered file's name, never a path on someone's disk. */
  source: z.string().trim().min(1).max(200).refine((name) => !/[\\/]/.test(name), "Yalnızca dosya adı yazın."),
  /** 1-based page (artboard) number inside the source file. */
  sourcePage: z.number().int().min(1),
  /** The page number printed on the design, when it has one. */
  printedNumber: z.number().int().min(1).nullable(),
  role: z.enum(["cover", "back_cover", "page"]),
  /** Shown in the panel's list after the key. */
  title: z.string().trim().min(1).max(90),
  /** What the reader's contents list calls it; null keeps it out of the list. */
  contents: z.string().trim().min(1).max(200).nullable(),
  alt: z.string().trim().min(1).max(400),
  transcript: z.string().trim().max(20_000).nullable(),
  areas: z.array(designAreaSchema).max(40),
});

/**
 * A page that is a quiz rather than a picture (D-309): drawn by the reader in
 * the magazine's type, every question on the page. It stands right after the
 * picture page named in `after`, so the pictures' own order is untouched.
 */
export const designQuizPageSchema = z.strictObject({
  key: z.string().regex(DESIGN_KEY),
  /** The picture page this one follows. */
  after: z.string().regex(DESIGN_KEY),
  /** Shown in the panel's list after the key. */
  title: z.string().trim().min(1).max(90),
  /** What the reader's contents list calls it; null keeps it out of the list. */
  contents: z.string().trim().min(1).max(200).nullable(),
  /** The section name printed above the quiz. */
  section: z.string().trim().min(1).max(120).nullable(),
  /** One of `quizzes`, by its exact title. */
  quizTitle: z.string().trim().min(1).max(200),
});

export const designManifestSchema = z.strictObject({
  issueNumber: z.number().int().min(1),
  /** Folder under `assets/issue-design/`. */
  folder: z.string().regex(DESIGN_KEY),
  /** Longest side of the rendered picture, in pixels. */
  renderWidth: z.number().int().min(800).max(4000),
  /**
   * Pixels cut from each side of every rendered page, the same on every page
   * so a spread still lines up. For hairlines where a background box stops
   * short of the artboard edge; 0 keeps the artboard exactly.
   */
  trim: z.strictObject({ x: z.number().int().min(0).max(60), y: z.number().int().min(0).max(80) }),
  pages: z.array(designPageSchema).min(1),
  /**
   * Quizzes the import writes into the issue (D-297), found again by title: a
   * rerun rewrites them from here, so a change made in the panel does not last.
   */
  quizzes: z.array(quizInputSchema).max(10).optional(),
  /** Quizzes laid out as pages of their own (D-309). */
  quizPages: z.array(designQuizPageSchema).max(10).optional(),
  /** Pages of the delivered files that are left out, and why. Documentation only. */
  excluded: z.array(
    z.strictObject({ source: z.string(), pages: z.array(z.number().int().min(1)), reason: z.string() }),
  ),
});

export type DesignArea = z.infer<typeof designAreaSchema>;
export type DesignPage = z.infer<typeof designPageSchema>;
export type DesignQuizPage = z.infer<typeof designQuizPageSchema>;
export type DesignManifest = z.infer<typeof designManifestSchema>;

/** One rendered picture, as the script records it in `renders.json`. */
export const renderRecordSchema = z.strictObject({
  key: z.string().regex(DESIGN_KEY),
  source: z.string(),
  sourcePage: z.number().int().min(1),
  /** sha256 of the delivered file the picture was drawn from. */
  sourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
  file: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  bytes: z.number().int(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  quality: z.number().int(),
});
export const renderListSchema = z.array(renderRecordSchema);
export type RenderRecord = z.infer<typeof renderRecordSchema>;

export function assetFileName(key: string): string {
  return `${key}.webp`;
}

/**
 * The storage key is derived from the content, so the same picture always
 * lands on the same object: a rerun overwrites nothing new and piles up
 * nothing, and a changed picture gets a new key instead of a stale cache.
 */
export function designStorageKey(folder: string, key: string, sha256: string): string {
  return `issue-pages/design/${folder}/${key}-${sha256.slice(0, 16)}.webp`;
}

/** Every page key in reading order: the pictures, each followed by its test page (D-309). */
export function designOrder(manifest: DesignManifest): string[] {
  return manifest.pages.flatMap((page) => [
    page.key,
    ...(manifest.quizPages ?? []).filter((quizPage) => quizPage.after === page.key).map((quizPage) => quizPage.key),
  ]);
}

/**
 * Everything wrong with a manifest, as sentences; an empty list means it is
 * usable. Checked before anything is written anywhere.
 */
export function manifestProblems(manifest: DesignManifest, renders?: RenderRecord[]): string[] {
  const problems: string[] = [];
  const keys = new Set<string>();
  const sources = new Set<string>();

  for (const page of manifest.pages) {
    if (keys.has(page.key)) problems.push(`"${page.key}" anahtarı iki kez kullanılmış.`);
    keys.add(page.key);
    const at = `${page.source}#${page.sourcePage}`;
    if (sources.has(at)) problems.push(`${page.source} dosyasının ${page.sourcePage}. sayfası iki kez eklenmiş.`);
    sources.add(at);
  }

  for (const role of ["cover", "back_cover"] as const) {
    if (manifest.pages.filter((page) => page.role === role).length > 1) {
      problems.push(`Birden çok "${role}" sayfası var.`);
    }
  }

  for (const page of manifest.pages) {
    for (const area of page.areas) {
      if (area.kind === "page" && !keys.has(area.target)) {
        problems.push(`"${page.key}" sayfasındaki "${area.name}" alanı olmayan bir sayfaya gidiyor: "${area.target}".`);
      }
      if (area.kind === "page" && area.target === page.key) {
        problems.push(`"${page.key}" sayfasındaki "${area.name}" alanı kendi sayfasına gidiyor.`);
      }
    }
  }

  const titles = new Set<string>();
  for (const quiz of manifest.quizzes ?? []) {
    if (titles.has(quiz.title)) problems.push(`"${quiz.title}" testi iki kez tanımlanmış.`);
    titles.add(quiz.title);
    // An unfinished quiz would be imported and then refuse to open for a reader
    for (const problem of quizProblems(quiz)) problems.push(`"${quiz.title}" testi: ${problem}`);
  }

  const followed = new Set<string>();
  for (const page of manifest.quizPages ?? []) {
    if (keys.has(page.key)) problems.push(`"${page.key}" anahtarı iki kez kullanılmış.`);
    keys.add(page.key);
    if (!manifest.pages.some((entry) => entry.key === page.after)) {
      problems.push(`"${page.key}" test sayfası olmayan bir sayfanın ardına konmuş: "${page.after}".`);
    }
    // Two after one page would leave their order to chance
    if (followed.has(page.after)) problems.push(`"${page.after}" sayfasının ardında birden çok test sayfası var.`);
    followed.add(page.after);
    // The page lays the quiz out from the manifest's own text, never a panel one it cannot check
    if (!titles.has(page.quizTitle)) {
      problems.push(`"${page.key}" test sayfasının testi manifestte yok: "${page.quizTitle}".`);
    }
  }

  if (renders) {
    for (const page of manifest.pages) {
      const record = renders.find((row) => row.key === page.key);
      if (!record) {
        problems.push(`"${page.key}" için görsel üretilmemiş: pnpm render-issue-design çalıştırın.`);
      } else if (record.source !== page.source || record.sourcePage !== page.sourcePage) {
        problems.push(
          `"${page.key}" görseli ${record.source}#${record.sourcePage} kaynağından üretilmiş, manifest ${page.source}#${page.sourcePage} diyor: görseli yeniden üretin.`,
        );
      }
    }
  }

  return problems;
}
