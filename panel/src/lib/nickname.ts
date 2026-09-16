/**
 * The community nickname (D-163): the name a member goes by in the community,
 * X's "Name". The pen name stays the magazine's.
 *
 * Pure, so the dialog and the service apply the same rule word for word.
 * Unlike the handle it is free text and need not be unique, which is why the
 * handle is always shown beside it: two members may both be "Deniz".
 */
import { readsAsStaff } from "./username";

export const NICKNAME_MAX = 50;

/**
 * Invisible and direction-changing characters: they let a name look like
 * another one, or look empty while it is not.
 */
const INVISIBLE = /[\p{Cc}\p{Cf}]/u;

/** Trims and collapses runs of spaces; an empty name becomes null. */
export function normalizeNickname(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return collapsed === "" ? null : collapsed;
}

/** Null when the nickname can be used, otherwise the reason in Turkish. */
export function nicknameProblem(nickname: string | null): string | null {
  if (nickname === null) return null;
  if ([...nickname].length > NICKNAME_MAX) return `Takma ad en fazla ${NICKNAME_MAX} karakter olabilir.`;
  if (INVISIBLE.test(nickname)) return "Takma ad görünmeyen karakter içeremez.";
  if (readsAsStaff(nickname)) return "Bu takma ad dergiyi ya da ekibini çağrıştırıyor; başka bir ad seçin.";
  return null;
}

/** The name the community shows: the nickname, or the handle without one. */
export function communityName(member: { username: string; nickname: string | null }): string {
  return member.nickname ?? member.username;
}
