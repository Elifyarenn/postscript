/**
 * The site's entry mode (module: closed entry). When the mode is `closed`,
 * registration is refused and only admins may sign in — existing non-admin
 * sessions are treated as invalid too, so "only admins enter" holds even for
 * sessions that predate the closure.
 */
import type { Role } from "@/db/schema";

export type AccessMode = "open" | "closed";

export function parseAccessMode(value: string | null | undefined): AccessMode {
  return value === "closed" ? "closed" : "open";
}

/** May this role enter while the site is closed? */
export function canEnterWhenClosed(role: Role): boolean {
  return role === "admin";
}

export function isEntryAllowed(mode: AccessMode, role: Role): boolean {
  return mode === "open" || canEnterWhenClosed(role);
}