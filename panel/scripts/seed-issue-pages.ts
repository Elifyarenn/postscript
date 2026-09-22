/**
 * Lays out an issue's starting pages (D-234).
 *
 * Safe to run more than once: it adds only the layouts that are missing and
 * never touches a page that already exists, so nothing typed in the panel is
 * lost. It creates no issue and publishes nothing — the issue has to be there
 * already, and its status is left exactly as it was.
 *
 *   pnpm seed-issue-pages           # issue 1
 *   pnpm seed-issue-pages -- 2      # another issue
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { issuePages, issues } from "@/db/schema";
import { runScript } from "./_bootstrap";

/**
 * What the site already announces about the first issue: the front page has
 * carried these exact words since the design went in, so nothing here is
 * invented and no second version of the issue is created.
 */
const FIRST_ISSUE = { number: 1, title: "Obsession", theme: "Bırakamadıklarımız", cover: "OBSESSION" };

/** The opening shape of an issue: one of each layout, in reading order. */
const STARTING_PAGES = [
  { template: "cover", tocTitle: null, inContents: false },
  { template: "masthead", tocTitle: "Künye", inContents: true },
  { template: "editorial", tocTitle: "Editörden", inContents: true },
  { template: "contents", tocTitle: null, inContents: false },
  { template: "theme_opening", tocTitle: "Tema", inContents: true },
  { template: "section_opening", tocTitle: "Bölüm açılışı", inContents: true },
  { template: "article_opening", tocTitle: "Yazı", inContents: true },
  { template: "article_continued", tocTitle: null, inContents: false },
  { template: "visual_article", tocTitle: "Görsel yazı", inContents: true },
  { template: "collage_opening", tocTitle: "Kolajlı yazı", inContents: true },
  { template: "full_bleed", tocTitle: null, inContents: false },
  { template: "picks", tocTitle: "Sayının seçkisi", inContents: true },
  { template: "playlist", tocTitle: "Çalma listesi", inContents: true },
  { template: "interactive", tocTitle: "Etkileşimli alan", inContents: true },
  { template: "ps_closing", tocTitle: "P.S.", inContents: true },
  { template: "back_cover", tocTitle: null, inContents: false },
] as const;

runScript(async () => {
  const wanted = Number(process.argv[2] ?? 1);
  if (!Number.isInteger(wanted) || wanted < 1) throw new Error("Sayı numarası geçersiz.");

  let [issue] = await db
    .select({ id: issues.id, number: issues.number, title: issues.title, status: issues.status })
    .from(issues)
    .where(and(eq(issues.number, wanted), isNull(issues.deletedAt)))
    .limit(1);

  // Created only if it is genuinely missing, and always as a draft: this
  // script never publishes anything and never makes a second copy
  if (!issue) {
    if (wanted !== FIRST_ISSUE.number) {
      throw new Error(`Sayı ${wanted} bulunamadı. Önce panelden sayıyı açın.`);
    }
    const [created] = await db
      .insert(issues)
      .values({
        number: FIRST_ISSUE.number,
        title: FIRST_ISSUE.title,
        theme: FIRST_ISSUE.theme,
        status: "planning",
      })
      .returning({ id: issues.id, number: issues.number, title: issues.title, status: issues.status });
    issue = created!;
    console.log(`Sayı ${issue.number} taslak olarak oluşturuldu.`);
  }

  const existing = await db
    .select({ template: issuePages.template })
    .from(issuePages)
    .where(eq(issuePages.issueId, issue.id));
  const have = new Set(existing.map((row) => row.template));

  const [top] = await db
    .select({ last: sql<number>`coalesce(max(${issuePages.position}), 0)` })
    .from(issuePages)
    .where(eq(issuePages.issueId, issue.id));

  let position = (top?.last ?? 0) + 1;
  let added = 0;

  for (const page of STARTING_PAGES) {
    if (have.has(page.template)) continue;
    await db.insert(issuePages).values({
      issueId: issue.id,
      position,
      template: page.template,
      tocTitle: page.tocTitle,
      inContents: page.inContents,
      // The cover and the theme page carry what is already known; every
      // other field stays empty for the panel to fill
      heading:
        wanted === FIRST_ISSUE.number && (page.template === "cover" || page.template === "theme_opening")
          ? FIRST_ISSUE.cover
          : null,
      standfirst:
        wanted === FIRST_ISSUE.number && (page.template === "cover" || page.template === "theme_opening")
          ? FIRST_ISSUE.theme
          : null,
    });
    position += 1;
    added += 1;
  }

  console.log(
    `Sayı ${issue.number} (${issue.title}, ${issue.status}): ${added} boş sayfa eklendi, ${existing.length} sayfa zaten vardı.`,
  );
});
