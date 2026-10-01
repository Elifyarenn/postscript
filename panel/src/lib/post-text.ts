/**
 * The text rules of a community post (D-294), pure so the composer in the
 * browser, the service and the card all read them from one place and they
 * are unit tested.
 *
 *  - a post is at most 250 characters;
 *  - "@handle" names a member: it becomes a link and notifies them;
 *  - "ps/" opens the community picker in the composer; the chosen community
 *    is stored on the post, not in its text.
 */
import { USERNAME_MAX, USERNAME_MIN } from "./username";

export const MAX_POST_LENGTH = 250;

/** One post notifies at most this many people; more is a mass ping, not a mention. */
export const MAX_MENTIONS_PER_POST = 10;

// A handle after a start, a space or punctuation — not inside a word or an address (a@b.c)
const MENTION = new RegExp(`(^|[^a-z0-9_@./])@([a-z0-9_]{${USERNAME_MIN},${USERNAME_MAX}})(?![a-z0-9_])`, "gi");

/** The handles a post names, lowercased, each once, in order, at most `MAX_MENTIONS_PER_POST`. */
export function extractMentions(body: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(MENTION)) {
    const handle = match[2]!.toLowerCase();
    if (!found.includes(handle)) found.push(handle);
    if (found.length === MAX_MENTIONS_PER_POST) break;
  }
  return found;
}

export type PostSegment = { type: "text"; value: string } | { type: "mention"; username: string; value: string };

/** The post's text cut into plain runs and "@handle" runs, for the card to link the latter. */
export function segmentPostBody(body: string): PostSegment[] {
  const segments: PostSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION)) {
    const start = match.index! + match[1]!.length;
    if (start > last) segments.push({ type: "text", value: body.slice(last, start) });
    const value = `@${match[2]!}`;
    segments.push({ type: "mention", username: match[2]!.toLowerCase(), value });
    last = start + value.length;
  }
  if (last < body.length) segments.push({ type: "text", value: body.slice(last) });
  return segments;
}

export type ComposerToken = { kind: "mention" | "community"; query: string; start: number; end: number };

/**
 * What is being typed at the caret: "@ad" asks for members, "ps/mo" for
 * communities. `start`–`end` is the span the chosen suggestion replaces.
 */
export function tokenAtCaret(text: string, caret: number): ComposerToken | null {
  const before = text.slice(0, caret);
  const mention = /(^|[\s(])@([a-z0-9_]{0,20})$/i.exec(before);
  if (mention) {
    const start = caret - mention[2]!.length - 1;
    return { kind: "mention", query: mention[2]!.toLowerCase(), start, end: caret };
  }
  const community = /(^|[\s(])ps\/([a-z0-9-]{0,96})$/i.exec(before);
  if (community) {
    const start = caret - community[2]!.length - 3;
    return { kind: "community", query: community[2]!.toLowerCase(), start, end: caret };
  }
  return null;
}
