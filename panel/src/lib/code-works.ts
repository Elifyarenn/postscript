/**
 * Works that live in the code rather than in a table (D-359): the manor game
 * is a text file the site reads, not an article or a quiz, yet it is a work
 * with an author and needs a licence form like any other. Each entry names
 * the issue it belongs to and its author's account; the text is read from
 * the file, so the form's hash is the hash of what the site serves.
 */
import { MANOR_GAME_PREVIEW_EMAILS } from "@/lib/auth/rbac";

export type CodeWork = {
  /** Stable: stored on the licence form as `work_key`, never renamed. */
  key: string;
  issueNumber: number;
  /** The author's account, by its address (stored lowercase). */
  authorEmail: string;
  title: string;
  /** Relative to the app's root. */
  file: string;
  typeLabel: string;
};

export const CODE_WORKS: readonly CodeWork[] = [
  {
    key: "malikane-oyunu",
    issueNumber: 2,
    // The game's author is the one account its preview is opened to (D-263)
    authorEmail: MANOR_GAME_PREVIEW_EMAILS[0]!,
    title: "Lanetli Malikâneden Çıkabilecek Misin?",
    file: "data/malikane-oyunu.txt",
    typeLabel: "Etkileşimli hikâye oyunu (sahne, seçim ve son metinleri)",
  },
];

export function codeWorkByKey(key: string): CodeWork | undefined {
  return CODE_WORKS.find((work) => work.key === key);
}
