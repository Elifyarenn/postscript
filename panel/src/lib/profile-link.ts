/**
 * Where a person's profile lives (D-209).
 *
 * A member can have two, one, or neither:
 *
 *  - the magazine's author page, keyed on the pen name slug. It is the one the
 *    magazine means by "profile", so it wins where both exist;
 *  - the community profile, keyed on the handle.
 *
 * Both pages are behind a session, so this is only ever used inside the panel
 * and the magazine, never in the public API payloads.
 *
 * Everything that names a person asks this one function, so a name is linked
 * in the same places for the same reasons, instead of each page deciding.
 */
export type Person = {
  penName?: string | null;
  penNameSlug?: string | null;
  username?: string | null;
};

export function profileHref(person: Person): string | null {
  // A slug without a pen name renders the author page as "İsimsiz"; not a profile
  if (person.penName && person.penNameSlug) return `/magazine/authors/${person.penNameSlug}`;
  if (person.username) return `/social/u/${person.username}`;
  return null;
}

/** True when this person has somewhere to be linked to at all. */
export function hasProfile(person: Person): boolean {
  return profileHref(person) !== null;
}
