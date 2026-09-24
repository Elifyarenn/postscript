import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { articles, issuePageHotspots, issuePages, issueQuizzes, issues, media, rightsGrants, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessAdminPanel, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { CARD_LABELS, issueExtrasFor } from "@/lib/issue-extras";
import {
  collagePage,
  contentsPage,
  continuedPage,
  coverPage,
  openingPage,
  picksPage,
  secondArticlePage,
  toFractions,
  type AreaSpec,
  type DrawnPage,
  type PreviewArticle,
  type PreviewIssue,
  type PreviewPhoto,
} from "@/lib/issue-preview/pages";
import { renderPagePng, stockDataUri } from "@/lib/issue-preview/render";
import { creditLine, LICENCE_URL, STOCK, type StockKey } from "@/lib/issue-preview/stock";
import { paragraphsOf, sameTitle, upperTr } from "@/lib/issue-preview/text";
import type { QuizInput } from "@/lib/issue-quiz";
import { getStorage } from "@/lib/storage";
import type { RequestMeta } from "./auth";
import { addPageImage, replacePageImage, reorderIssuePages, saveHotspots, updatePageMeta } from "./issue-pages";
import { createQuiz, updateQuiz } from "./issue-quizzes";
import { publicByline, signedGrantFor } from "./public";

/**
 * The temporary preview of the admin-only issue (D-247).
 *
 * The designers' pages are not in yet, so the reader is judged on stand-ins:
 * seven pages drawn on the server from real draft articles and checked stock
 * photos, then handed to the ordinary page machinery — `addPageImage`,
 * `saveHotspots`, `createQuiz` — exactly as an upload and the area editor
 * would. Nothing here is a second way of making pages. A designer's PNG/WebP
 * replaces any of them from the page list, like any other picture.
 *
 * Three rules hold it in place:
 *
 *  - **Only the admins' working issue.** It refuses any issue that is not
 *    `admin_only`, so the drafts' words can never reach an editor, a writer
 *    or a reader through it (D-240 closes that issue at the data layer).
 *  - **The articles are read, never written.** Title, byline and text come
 *    from the stored record; status and body are untouched, and only the
 *    beginning of a text is shown, marked as a preview selection.
 *  - **Running it again updates, it does not add.** The pages are found by
 *    their label; an unchanged picture is not uploaded again, and a replaced
 *    one is released so no orphan files pile up.
 */

export const PREVIEW_LABEL_PREFIX = "Geçici tasarım · ";
export const SAMPLE_QUIZ_TITLE = "Örnek test · Okuyucuyu deneyin";

/** The neutral test pages of D-240's sample script; reused as slots, not piled on. */
const OLD_SAMPLE_LABEL = /^Deneme sayfası \d+$/;

export const PREVIEW_SLOTS = [
  { key: "cover", label: "Kapak" },
  { key: "contents", label: "İçindekiler" },
  { key: "opening", label: "Yazı açılışı" },
  { key: "continued", label: "Devam sayfası" },
  { key: "second", label: "İkinci yazı" },
  { key: "collage", label: "Kolaj" },
  { key: "picks", label: "Seçki ve test" },
] as const;

type SlotKey = (typeof PREVIEW_SLOTS)[number]["key"];

/**
 * Which drafts each designed page may carry, in order of preference. The
 * titles are the ones matched against the photos on 23 September
 * (`gorseller/ilk-sayi/GORSEL_LISTESI.md`), so each article gets the photos
 * chosen for it; the second entry stands in if the first is gone or renamed.
 */
const FEATURE_CANDIDATES: { title: string; photo: StockKey; detail: StockKey }[] = [
  { title: "Bilim İnsanları ve Obsesyon", photo: "edisonBulbs", detail: "oldNotebooks" },
  { title: "Çay Koy Yeniden Başlayalım: Bir Fincandaki Gizli Şifa", photo: "steamingTea", detail: "teaInHand" },
];
const SECOND_CANDIDATES: { title: string; photo: StockKey }[] = [
  { title: "Madde 1 - Hukukun Peşini Bırakmadıkları", photo: "knottedRope" },
  { title: "Hayali Şahit (The Imaginary Witness) Takıntısı", photo: "theatreCurtain" },
];
const COLLAGE_CANDIDATES: { title: string; photos: StockKey[] }[] = [
  { title: "Üç Kalem", photos: ["threePens", "tiedLetters", "clockAtNight"] },
  {
    title: "TAKINTI: Kar Tanesi ve Zihnin Sonsuz Fraktalı",
    photos: ["snowflakeMacro", "snowflakeBokeh", "snowflakesDark"],
  },
];

/** A published or withdrawn text is not a draft; neither is shown here. */
const NOT_DRAFTS = ["published", "archived", "withdrawn", "scheduled"] as const;

/** Too short to fill a page with the writer's own words. */
const MIN_BODY_CHARS = 600;

export const SAMPLE_QUIZ: QuizInput = {
  kind: "knowledge",
  title: SAMPLE_QUIZ_TITLE,
  intro:
    "Bu bir örnek testtir: sorular PostScript yazarlarına ait değildir ve hiçbir yazıdan alınmamıştır. Yalnızca okuyucudaki test penceresini denemek için hazırlandı; cevaplar kaydedilmez.",
  questions: [
    {
      id: "q1",
      text: "Okuyucuda sayfayı büyütmek için hangi tuşu kullanabilirsiniz?",
      explanation: "+ büyütür, − küçültür, 0 sayfayı ekrana yeniden sığdırır. Ctrl ile tekerlek de çalışır.",
      options: [
        { id: "a", text: "+", correct: true },
        { id: "b", text: "Enter" },
        { id: "c", text: "Tab" },
      ],
    },
    {
      id: "q2",
      text: "Geniş ekranda çift sayfa görünümündeyken kapak nasıl gösterilir?",
      explanation: "Basılı bir dergide olduğu gibi kapak tek başına durur; sonra sayfalar ikişer ikişer açılır.",
      options: [
        { id: "a", text: "Tek başına", correct: true },
        { id: "b", text: "İçindekilerle yan yana" },
        { id: "c", text: "Hiç gösterilmez" },
      ],
    },
    {
      id: "q3",
      text: "Bu örnek sayıyı kimler açabilir?",
      explanation: "Örnek sayı veri katmanında yalnızca yönetici hesaplarına açıktır; başka herkese “bulunamadı” döner.",
      options: [
        { id: "a", text: "Yalnızca yöneticiler", correct: true },
        { id: "b", text: "Bütün üyeler" },
        { id: "c", text: "Editörler ve yazarlar" },
      ],
    },
  ],
  outcomes: [],
};

type Candidate = {
  id: string;
  title: string;
  category: string | null;
  status: string;
  body: string;
  byline: string;
};

export type PreviewResult = {
  issueNumber: number;
  articles: { id: string; title: string; category: string | null; status: string }[];
  added: number;
  replaced: number;
  unchanged: number;
};

export type PreviewDeps = { render: (page: DrawnPage) => Promise<Buffer> };

const defaultDeps: PreviewDeps = { render: (page) => renderPagePng(page.element) };

function photoOf(key: StockKey): PreviewPhoto {
  const photo = STOCK[key];
  return { src: stockDataUri(key), credit: creditLine(photo), description: photo.description };
}

/** The information box that tells where a picture came from and on what terms. */
function sourcesInfo(keys: StockKey[]): { title: string; body: string } {
  const lines = keys.map((key) => {
    const photo = STOCK[key];
    return `${photo.description} — ${photo.photographer}. Kaynak: ${photo.source} (lisans: ${LICENCE_URL[photo.licence]}).`;
  });
  return {
    title: keys.length > 1 ? "Görseller ve kaynakları" : "Görsel ve kaynak",
    body: [
      ...lines,
      "",
      "Bu sayfa, tasarımcıların son sayfaları gelene kadar okuyucuyu denemek için hazırlanmış geçici bir tasarımdır ve yayımlanmadı.",
    ].join("\n"),
  };
}

const SELECTION_INFO = {
  title: "Önizleme seçkisi",
  body: [
    "Bu sayfalarda yazının yalnızca baş kısmı gösteriliyor. Başlık, yazar adı ve metin paneldeki kayıttan olduğu gibi alındı; tek değişiklik metnin nerede kesildiği.",
    "",
    "Yazının kendisi değiştirilmedi, durumu da değişmedi: hâlâ yayımlanmamış bir taslak.",
  ].join("\n"),
};

async function draftCandidates(): Promise<Candidate[]> {
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      category: articles.category,
      status: articles.status,
      body: articles.bodyMarkdown,
      penName: users.penName,
      displayName: users.displayName,
      bylineChoice: rightsGrants.bylineChoice,
    })
    .from(articles)
    .innerJoin(users, eq(articles.authorId, users.id))
    .leftJoin(rightsGrants, signedGrantFor(articles.id))
    .where(and(isNull(articles.deletedAt), notInArray(articles.status, [...NOT_DRAFTS])));

  // The byline is the one the magazine would print (D-076): the legal name
  // only where the writer signed for it, even on a page only admins see
  return rows.map(({ penName, displayName, bylineChoice, ...row }) => ({
    ...row,
    byline: publicByline({ penName, displayName, bylineChoice }),
  }));
}

function choose<T extends { title: string }>(
  wanted: T[],
  pool: Candidate[],
  takenCategories: Set<string>,
): { candidate: Candidate; choice: T } | null {
  for (const choice of wanted) {
    const found = pool.find(
      (row) =>
        sameTitle(row.title, choice.title) &&
        row.body.trim().length >= MIN_BODY_CHARS &&
        !takenCategories.has((row.category ?? "").toLocaleLowerCase("tr")),
    );
    if (found) return { candidate: found, choice };
  }
  return null;
}

function asArticle(candidate: Candidate): PreviewArticle {
  return {
    title: candidate.title,
    byline: candidate.byline,
    category: candidate.category,
    paragraphs: paragraphsOf(candidate.body),
  };
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** The stored picture's fingerprint, or null when it cannot be read back. */
async function storedHash(mediaId: string | null): Promise<string | null> {
  if (!mediaId) return null;
  const [row] = await db.select({ key: media.storageKey }).from(media).where(eq(media.id, mediaId)).limit(1);
  if (!row) return null;
  try {
    return sha256(await getStorage().get({ bucket: "media", key: row.key }));
  } catch {
    // A picture that cannot be read (D-240's test pages were stored on the
    // wrong disk) is simply replaced
    return null;
  }
}

/**
 * A replaced page picture is released when nothing else uses it. Only the
 * page machinery's own files (`issue-pages/…`) are ever touched.
 */
async function releaseMedia(mediaId: string, actor: Actor, meta: RequestMeta): Promise<void> {
  const [row] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!row || row.deletedAt || !row.storageKey.startsWith("issue-pages/")) return;

  const [pageUse] = await db
    .select({ id: issuePages.id })
    .from(issuePages)
    .where(
      sql`${issuePages.imageMediaId} = ${mediaId} or ${issuePages.blocks}::text like ${`%${mediaId}%`}`,
    )
    .limit(1);
  const [areaUse] = await db
    .select({ id: issuePageHotspots.id })
    .from(issuePageHotspots)
    .where(eq(issuePageHotspots.infoMediaId, mediaId))
    .limit(1);
  if (pageUse || areaUse) return;

  await db.update(media).set({ deletedAt: new Date() }).where(eq(media.id, mediaId));
  await getStorage()
    .remove({ bucket: "media", key: row.storageKey })
    .catch(() => undefined);
  await writeAudit({
    actorId: actor.id,
    action: "issue_preview.media_released",
    entityType: "media",
    entityId: mediaId,
    ip: meta.ip,
  });
}

/**
 * Builds or refreshes the preview in the admin-only issue and puts its pages
 * first. Returns which drafts were used, for the panel to say so.
 */
export async function buildIssuePreview(
  actor: Actor,
  issueId: string,
  meta: RequestMeta,
  deps: PreviewDeps = defaultDeps,
): Promise<PreviewResult> {
  if (!canAccessAdminPanel(actor)) throw forbidden("Önizleme yalnızca yöneticilerindir.");

  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
    .limit(1);
  if (!issue) throw notFound("Sayı bulunamadı.");
  if (!issue.adminOnly) {
    throw badRequest(
      "Geçici önizleme yalnızca “yalnızca yöneticiler” olarak işaretli örnek sayıya kurulur; taslak yazılar başka bir sayıya konmaz.",
    );
  }

  /* ---- The drafts, three categories ---- */
  const pool = await draftCandidates();
  const taken = new Set<string>();
  const remember = (row: Candidate) => taken.add((row.category ?? "").toLocaleLowerCase("tr"));

  const feature = choose(FEATURE_CANDIDATES, pool, taken);
  if (feature) remember(feature.candidate);
  const second = choose(SECOND_CANDIDATES, pool, taken);
  if (second) remember(second.candidate);
  const collage = choose(COLLAGE_CANDIDATES, pool, taken);

  if (!feature || !second || !collage) {
    const missing = [
      !feature && FEATURE_CANDIDATES.map((entry) => entry.title).join(" / "),
      !second && SECOND_CANDIDATES.map((entry) => entry.title).join(" / "),
      !collage && COLLAGE_CANDIDATES.map((entry) => entry.title).join(" / "),
    ].filter(Boolean);
    throw badRequest(`Önizleme için taslak yazı bulunamadı: ${missing.join("; ")}.`);
  }

  const view: PreviewIssue = { number: issue.number, title: issue.title, theme: issue.theme };
  const featureArticle = asArticle(feature.candidate);
  const secondArticle = asArticle(second.candidate);
  const collageArticle = asArticle(collage.candidate);

  const extras = issueExtrasFor(issue.number);
  const playlist = {
    name: extras?.playlist?.name ?? null,
    url: extras?.playlist?.spotifyUrl ?? null,
  };
  const picks = (extras?.cards ?? []).map((card) => ({
    kind: CARD_LABELS[card.kind],
    title: card.title,
    credit: card.credit,
    year: card.year,
    text: card.text,
  }));

  /* ---- Drawing: positions are fixed, the preview is always pages 1–7 ---- */
  const kicker = (article: PreviewArticle) => upperTr(article.category ?? "PostScript");
  const opening = openingPage({
    issue: view,
    number: 3,
    article: featureArticle,
    photo: photoOf(feature.choice.photo),
    photoInfo: sourcesInfo([feature.choice.photo]),
  });

  const drawn: Record<SlotKey, DrawnPage> = {
    cover: coverPage({ issue: view, featured: [featureArticle, secondArticle, collageArticle] }),
    contents: contentsPage({
      issue: view,
      number: 2,
      playlist,
      entries: [
        { target: "opening", page: 3, kicker: kicker(featureArticle), title: featureArticle.title, byline: featureArticle.byline },
        { target: "second", page: 5, kicker: kicker(secondArticle), title: secondArticle.title, byline: secondArticle.byline },
        { target: "collage", page: 6, kicker: kicker(collageArticle), title: collageArticle.title, byline: collageArticle.byline },
        { target: "picks", page: 7, kicker: "SEÇKİ VE TEST", title: "Sayının seçkisi ve deneme testi", byline: null },
      ],
    }),
    opening,
    continued: continuedPage({
      issue: view,
      number: 4,
      article: featureArticle,
      from: opening.used,
      photo: photoOf(feature.choice.detail),
      noteInfo: {
        title: SELECTION_INFO.title,
        body: `${SELECTION_INFO.body}\n\n${sourcesInfo([feature.choice.detail]).body}`,
      },
    }),
    second: secondArticlePage({
      issue: view,
      number: 5,
      article: secondArticle,
      photo: photoOf(second.choice.photo),
      photoInfo: sourcesInfo([second.choice.photo]),
    }),
    collage: collagePage({
      issue: view,
      number: 6,
      article: collageArticle,
      photos: collage.choice.photos.map(photoOf),
      photoInfo: sourcesInfo(collage.choice.photos),
    }),
    picks: picksPage({ issue: view, number: 7, picks, playlist }),
  };

  /* ---- Pages: found by label, else an old test page, else a new one ---- */
  const existing = await db
    .select({ id: issuePages.id, label: issuePages.label, position: issuePages.position, imageMediaId: issuePages.imageMediaId })
    .from(issuePages)
    .where(eq(issuePages.issueId, issue.id))
    .orderBy(issuePages.position);
  const spare = existing.filter((page) => page.label && OLD_SAMPLE_LABEL.test(page.label));

  const pageIds = {} as Record<SlotKey, string>;
  let added = 0;
  let replaced = 0;
  let unchanged = 0;

  for (const slot of PREVIEW_SLOTS) {
    const label = `${PREVIEW_LABEL_PREFIX}${slot.label}`;
    const page = drawn[slot.key];
    const png = await deps.render(page);
    const fileName = `gecici-${slot.key}.png`;

    const found = existing.find((row) => row.label === label) ?? spare.shift();
    if (found) {
      const same = (await storedHash(found.imageMediaId)) === sha256(png);
      if (same) {
        unchanged += 1;
      } else {
        await replacePageImage(actor, found.id, { buffer: png, fileName, declaredMime: "image/png" }, meta);
        if (found.imageMediaId) await releaseMedia(found.imageMediaId, actor, meta);
        replaced += 1;
      }
      pageIds[slot.key] = found.id;
    } else {
      const created = await addPageImage(
        actor,
        issue.id,
        { buffer: png, fileName, declaredMime: "image/png", label },
        meta,
      );
      pageIds[slot.key] = created.id;
      added += 1;
    }

    await updatePageMeta(
      actor,
      pageIds[slot.key],
      {
        label,
        imageAlt: page.alt.slice(0, 400),
        transcript: page.transcript.slice(0, 20_000),
        tocTitle: slot.key === "cover" || slot.key === "contents" ? null : slot.label,
        inContents: slot.key !== "cover" && slot.key !== "contents",
        template: slot.key === "cover" ? "cover" : "full_bleed",
      },
      meta,
    );
  }

  /* ---- The sample quiz: one, found by its title ---- */
  const [quiz] = await db
    .select({ id: issueQuizzes.id })
    .from(issueQuizzes)
    .where(and(eq(issueQuizzes.issueId, issue.id), eq(issueQuizzes.title, SAMPLE_QUIZ_TITLE)))
    .limit(1);
  const quizId = quiz
    ? (await updateQuiz(actor, quiz.id, SAMPLE_QUIZ, meta), quiz.id)
    : await createQuiz(actor, issue.id, SAMPLE_QUIZ, meta);

  /* ---- Areas: the whole set of each page, so a rerun replaces, never adds ---- */
  for (const slot of PREVIEW_SLOTS) {
    const areas = drawn[slot.key].areas.map((area: AreaSpec) => {
      const base = { name: area.name, ariaLabel: area.name, showMarker: false, ...toFractions(area.rect) };
      switch (area.kind) {
        case "page":
          return { ...base, kind: "page", targetPageId: pageIds[area.target as SlotKey] };
        case "link":
          return { ...base, kind: "link", url: area.url, openInNewTab: true };
        case "info":
          return { ...base, kind: "info", infoTitle: area.title, infoBody: area.body };
        case "quiz":
          return { ...base, kind: "quiz", quizId };
      }
    });
    await saveHotspots(actor, pageIds[slot.key], areas, meta);
  }

  /* ---- The preview first, everything else after it in its own order ---- */
  const previewIds = PREVIEW_SLOTS.map((slot) => pageIds[slot.key]);
  const rest = (
    await db
      .select({ id: issuePages.id })
      .from(issuePages)
      .where(eq(issuePages.issueId, issue.id))
      .orderBy(issuePages.position)
  )
    .map((row) => row.id)
    .filter((id) => !previewIds.includes(id));
  await reorderIssuePages(actor, issue.id, [...previewIds, ...rest], meta);

  const used = [feature.candidate, second.candidate, collage.candidate];
  await writeAudit({
    actorId: actor.id,
    action: "issue_preview.built",
    entityType: "issues",
    entityId: issue.id,
    // Which records were read, never their words
    after: { articleIds: used.map((row) => row.id), added, replaced, unchanged },
    ip: meta.ip,
  });

  return {
    issueNumber: issue.number,
    articles: used.map(({ id, title, category, status }) => ({ id, title, category, status })),
    added,
    replaced,
    unchanged,
  };
}
