/**
 * The site entry mode: closed means no reader registration, no reader login,
 * and reader sessions stop resolving. Writer-track accounts (writer-form
 * candidates, writers, editors, admins) keep their sessions while closed, but
 * only the admin may leave the account area.
 */
import { describe, expect, it } from "vitest";
import {
  canEnterWhenClosed,
  isEntryAllowed,
  isWriterTrack,
  parseAccessMode,
  restrictToAccountWhenClosed,
} from "@/lib/access-mode";

const reader = { role: "user" as const, writerIntentAt: null };
const candidate = { role: "user" as const, writerIntentAt: new Date() };
const writer = { role: "writer" as const, writerIntentAt: null };
const editor = { role: "editor" as const, writerIntentAt: null };
const admin = { role: "admin" as const, writerIntentAt: null };

describe("access mode helpers", () => {
  it("treats anything but 'closed' as open", () => {
    expect(parseAccessMode(undefined)).toBe("open");
    expect(parseAccessMode("open")).toBe("open");
    expect(parseAccessMode("closed")).toBe("closed");
  });

  it("lets everyone in while open", () => {
    for (const account of [reader, candidate, writer, editor, admin]) {
      expect(isEntryAllowed("open", account)).toBe(true);
    }
  });

  it("keeps writer-track accounts in while closed, but not readers", () => {
    expect(canEnterWhenClosed(admin)).toBe(true);
    expect(canEnterWhenClosed(writer)).toBe(true);
    expect(canEnterWhenClosed(editor)).toBe(true);
    // A candidate registered through the writer form is writer-track too
    expect(canEnterWhenClosed(candidate)).toBe(true);
    expect(isWriterTrack(candidate)).toBe(true);
    // A plain reader has no way in
    expect(canEnterWhenClosed(reader)).toBe(false);
    expect(isWriterTrack(reader)).toBe(false);
  });

  it("confines everyone but the admin to the account area while closed", () => {
    expect(restrictToAccountWhenClosed("admin")).toBe(false);
    expect(restrictToAccountWhenClosed("editor")).toBe(true);
    expect(restrictToAccountWhenClosed("writer")).toBe(true);
    expect(restrictToAccountWhenClosed("user")).toBe(true);
  });
});
