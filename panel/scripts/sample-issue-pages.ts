/**
 * Prepares the working issue (D-240).
 *
 * Two jobs, both safe to run more than once:
 *
 *  1. marks the issue "admin only", which is what closes it to everybody but
 *     an admin at the data layer — the reader, the lists, the pictures and the
 *     quizzes all ask the same question;
 *  2. optionally fills it with neutral test pages, so the panel and the reader
 *     can be exercised before any artwork is delivered. A test page carries
 *     its own number and nothing else: no invented headline, no invented
 *     byline, nothing that could be mistaken for the magazine's own words.
 *
 * It publishes nothing and changes no issue's status.
 *
 *   pnpm sample-issue-pages                 # mark issue 1 admin-only
 *   pnpm sample-issue-pages -- 1 --pages 6  # and add six test pages
 *   pnpm sample-issue-pages -- 1 --open     # hand it back to the team
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { issuePages, issues } from "@/db/schema";
import { addPageImage } from "@/services/issue-pages";
import { users } from "@/db/schema";
import { Canvas, drawNumber, type Rgb } from "./lib/plain-png";
import { runScript } from "./_bootstrap";

/** The magazine's own two colours, so a test page looks like this magazine. */
const PAPER: Rgb = [244, 240, 232];
const WINE: Rgb = [123, 31, 43];
const INK: Rgb = [38, 33, 33];

/** A4 at 150 dpi: the proportions a delivered page will have. */
const WIDTH = 1240;
const HEIGHT = 1754;

function testPage(number: number, total: number): Buffer {
  const canvas = new Canvas(WIDTH, HEIGHT, PAPER);

  // A margin rule and a band at the top: enough structure to tell whether the
  // reader is fitting, zooming and pairing pages correctly
  canvas.fill(0, 0, WIDTH, 26, WINE);
  canvas.fill(90, 150, WIDTH - 180, 3, INK);
  canvas.fill(90, HEIGHT - 150, WIDTH - 180, 3, INK);

  drawNumber(canvas, String(number), WIDTH / 2 - 90, HEIGHT / 2 - 200, 28, WINE);
  drawNumber(canvas, `${number}`, 96, HEIGHT - 132, 8, INK);
  drawNumber(canvas, `${total}`, WIDTH - 180, HEIGHT - 132, 8, INK);

  return canvas.toPng();
}

runScript(async () => {
  const args = process.argv.slice(2);
  const wanted = Number(args.find((value) => /^\d+$/.test(value)) ?? 1);
  const open = args.includes("--open");
  const pageArg = args.indexOf("--pages");
  const howMany = pageArg >= 0 ? Number(args[pageArg + 1] ?? 0) : 0;

  const [issue] = await db
    .select({ id: issues.id, number: issues.number, title: issues.title, status: issues.status })
    .from(issues)
    .where(and(eq(issues.number, wanted), isNull(issues.deletedAt)))
    .limit(1);
  if (!issue) throw new Error(`Sayı ${wanted} bulunamadı.`);

  await db
    .update(issues)
    .set({ adminOnly: !open, updatedAt: new Date() })
    .where(eq(issues.id, issue.id));
  console.log(
    open
      ? `Sayı ${issue.number} artık normal taslak kurallarına tabi (editör paneli görebilir).`
      : `Sayı ${issue.number} yalnızca yönetici hesaplarına açık.`,
  );

  if (howMany > 0) {
    const existing = await db
      .select({ id: issuePages.id, imageMediaId: issuePages.imageMediaId })
      .from(issuePages)
      .where(eq(issuePages.issueId, issue.id));
    const withImages = existing.filter((row) => row.imageMediaId !== null).length;

    if (withImages > 0) {
      console.log(`Sayıda zaten ${withImages} görselli sayfa var; yeni deneme sayfası eklenmedi.`);
      return;
    }

    // The pages are added through the service, exactly as an upload would, so
    // this path proves the same code the panel uses
    const [admin] = await db
      .select({
        id: users.id,
        role: users.role,
        writerStatus: users.writerStatus,
        editorStatus: users.editorStatus,
        emailVerifiedAt: users.emailVerifiedAt,
        isBanned: users.isBanned,
      })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
    if (!admin) throw new Error("Yönetici hesabı bulunamadı; deneme sayfaları eklenemedi.");

    for (let number = 1; number <= howMany; number += 1) {
      const page = await addPageImage(
        admin,
        issue.id,
        {
          buffer: testPage(number, howMany),
          fileName: `deneme-${String(number).padStart(2, "0")}.png`,
          declaredMime: "image/png",
          label: `Deneme sayfası ${number}`,
        },
        { ip: null, userAgent: "sample-issue-pages" },
      );
      console.log(`  ${page.position}. sayfa eklendi (${page.width}×${page.height}).`);
    }
  }
});
