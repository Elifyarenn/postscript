/**
 * Phone number helpers shared by registration and the profile form.
 */
/** Normalises a phone number to a compact, comparable form. */
export function normalisePhone(raw: string): string {
  return raw.replace(/[\s()-]/g, "");
}
