/**
 * The browser's size check for a signed PDF (D-301): the host drops a request
 * over its own ceiling before the server can answer, so the limit has to be
 * explained before the file is sent.
 */
import { describe, expect, it } from "vitest";
import { oversizeMessage } from "@/lib/upload-size";

const MB = 1024 * 1024;

describe("a file picked for upload", () => {
  it("passes at or under the limit", () => {
    expect(oversizeMessage(0, 4)).toBeNull();
    expect(oversizeMessage(4 * MB, 4)).toBeNull();
  });

  it("is refused over it, with its size and what to do", () => {
    const message = oversizeMessage(7.26 * MB, 4)!;
    expect(message).toContain("7,3 MB");
    expect(message).toContain("en fazla 4 MB");
    expect(message).toContain("küçültüp");
  });

  it("never reads as the limit itself when just over it", () => {
    expect(oversizeMessage(4 * MB + 1, 4)).toContain("4,1 MB");
  });
});
