/**
 * The interaction blocks a magazine page can carry (D-234).
 *
 * Blocks are optional and stored on the page as a small JSON array, so a page
 * gains one without a schema change. Each kind names the fields it needs; a
 * block whose fields are empty is shown as a marked gap in the editor's
 * preview and left out of the published view, so a reader never meets a
 * control that does nothing.
 */
import { z } from "zod";

export const BLOCK_KINDS = [
  { id: "zoom", label: "Büyüyen görsel", hint: "Tıklanınca büyüyen görsel ve açıklaması." },
  { id: "gallery", label: "Galeri", hint: "Birkaç görsel, yan yana gezilir." },
  { id: "aside", label: "Kenar notu", hint: "Açılıp kapanan ek bilgi." },
  { id: "quote", label: "Alıntı", hint: "Vurgulanan cümle ve kaynağı." },
  { id: "related", label: "İlgili yazı", hint: "Yayımlanmış bir yazıya geçiş." },
  { id: "media", label: "Ses / video", hint: "Okurun kendisi başlatır; hiçbir şey kendiliğinden çalmaz." },
  { id: "playlist", label: "Çalma listesi", hint: "Sayının kendi listesini bu sayfaya koyar." },
  { id: "quiz", label: "Soru", hint: "Tek soruluk quiz; şıklar ve doğru yanıt." },
  { id: "test", label: "Test", hint: "Sayının testlerinden biri, bütün sorularıyla sayfanın üzerinde." },
] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number]["id"];

export const BLOCK_KIND_IDS = BLOCK_KINDS.map((kind) => kind.id) as [BlockKind, ...BlockKind[]];

const text = (max: number) => z.string().trim().max(max).default("");

export const blockSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("zoom"),
    mediaId: z.uuid().nullable().default(null),
    caption: text(300),
  }),
  z.strictObject({
    kind: z.literal("gallery"),
    mediaIds: z.array(z.uuid()).max(12).default([]),
    caption: text(300),
  }),
  z.strictObject({ kind: z.literal("aside"), title: text(120), body: text(2000) }),
  z.strictObject({ kind: z.literal("quote"), text: text(400), source: text(120) }),
  z.strictObject({ kind: z.literal("related"), articleId: z.uuid().nullable().default(null) }),
  z.strictObject({
    kind: z.literal("media"),
    // Only a plain https address; the page never embeds a third party's player
    url: z.union([z.url(), z.literal("")]).default(""),
    media: z.enum(["audio", "video"]).default("audio"),
    title: text(160),
  }),
  z.strictObject({ kind: z.literal("playlist") }),
  z.strictObject({
    kind: z.literal("quiz"),
    question: text(300),
    options: z.array(text(160)).max(6).default([]),
    answer: z.number().int().min(0).max(5).nullable().default(null),
    explanation: text(500),
  }),
  /**
   * One of the issue's quizzes, laid out on the page itself (D-309): every
   * question visible, answered on the page, the result under them. The quiz
   * and its answer key stay in `issue_quizzes`; the page only points at it.
   */
  z.strictObject({ kind: z.literal("test"), quizId: z.uuid().nullable().default(null) }),
]);

export type PageBlock = z.infer<typeof blockSchema>;

export const issuePageBlocksSchema = z.array(blockSchema).max(12);

/** Reads whatever is stored, dropping anything that no longer parses. */
export function parseBlocks(value: unknown): PageBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = blockSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

// The reader's helpers live in a module without zod, so the published reader
// does not ship the whole validation library to the browser (D-313)
export { blockIsReady, testQuizId } from "./issue-block-rules";

export function blockLabel(kind: string): string {
  return BLOCK_KINDS.find((entry) => entry.id === kind)?.label ?? kind;
}
