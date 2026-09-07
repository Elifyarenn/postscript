/**
 * The site entry mode: closed means no registration, no non-admin login, and
 * non-admin sessions stop resolving.
 */
import { describe, expect, it } from "vitest";
import { canEnterWhenClosed, isEntryAllowed, parseAccessMode } from "@/lib/access-mode";

describe("access mode helpers", () => {
  it("treats anything but 'closed' as open", () => {
    expect(parseAccessMode(undefined)).toBe("open");
    expect(parseAccessMode("open")).toBe("open");
    expect(parseAccessMode("closed")).toBe("closed");
  });

  it("lets everyone in while open", () => {
    for (const role of ["user", "writer", "editor", "admin"] as const) {
      expect(isEntryAllowed("open", role)).toBe(true);
    }
  });

  it("lets only admins in while closed", () => {
    expect(canEnterWhenClosed("admin")).toBe(true);
    expect(canEnterWhenClosed("editor")).toBe(false);
    expect(canEnterWhenClosed("writer")).toBe(false);
    expect(canEnterWhenClosed("user")).toBe(false);
  });
});