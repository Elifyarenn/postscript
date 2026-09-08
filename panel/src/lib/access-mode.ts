/**
 * The site's entry mode (module: closed entry). When the mode is `closed`,
 * reader registration is refused and plain reader accounts may not sign in —
 * existing non-admin, non-writer sessions are treated as invalid too.
 *
 * Writer-track accounts (candidates registered through the public writer form,
 * plus writers, editors and admins) keep their sessions while closed, but only
 * the admin may leave the account area (D-049).
 */
import type { Role } from "@/db/schema";

export type AccessMode = "open" | "closed";

/** The account belongs to the magazine's own workflow rather than a reader. */
export function isWriterTrack(input: { role: Role; writerIntentAt?: Date | null }): boolean {
  return input.role !== "user" || input.writerIntentAt !== null;
}

export function parseAccessMode(value: string | null | undefined): AccessMode {
  return value === "closed" ? "closed" : "open";
}

/** May this account hold a session while the site is closed? */
export function canEnterWhenClosed(input: {
  role: Role;
  writerIntentAt?: Date | null;
}): boolean {
  return isWriterTrack(input);
}

export function isEntryAllowed(
  mode: AccessMode,
  input: { role: Role; writerIntentAt?: Date | null },
): boolean {
  return mode === "open" || canEnterWhenClosed(input);
}

/**
 * While closed, everyone except the admin is confined to the account area: the
 * panels, the reading area and the community wait until the site opens.
 */
export function restrictToAccountWhenClosed(role: Role): boolean {
  return role !== "admin";
}
