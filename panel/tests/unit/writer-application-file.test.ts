/**
 * Sample work file validation for the writer application pipeline.
 *
 * The declared MIME is never trusted; only the magic bytes decide, and the
 * accepted set is deliberately small: PDF and DOCX.
 */
import { describe, expect, it } from "vitest";
import {
  assertApplicationFileAcceptable,
  detectApplicationFileType,
  MAX_APPLICATION_FILE_BYTES,
} from "@/services/writer-applications";
import { isAppError } from "@/lib/errors";

const PDF_BYTES = Buffer.from("%PDF-1.7\n% sample work document\n");
const DOCX_BYTES = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from("zip container contents beyond the signature"),
]);

describe("detectApplicationFileType", () => {
  it("recognises a PDF by its magic bytes", () => {
    expect(detectApplicationFileType(PDF_BYTES)).toBe("application/pdf");
  });

  it("recognises a DOCX by its ZIP signature", () => {
    expect(detectApplicationFileType(DOCX_BYTES)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("refuses anything that is neither", () => {
    expect(detectApplicationFileType(Buffer.from("just some text, not a file")))
      .toBeNull();
    expect(detectApplicationFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])))
      .toBeNull(); // a JPEG masquerading as a sample work
  });

  it("refuses tiny buffers that cannot carry a signature", () => {
    expect(detectApplicationFileType(Buffer.from("%PDF-"))).toBeNull();
  });
});

describe("assertApplicationFileAcceptable", () => {
  it("returns the detected mime for a PDF", () => {
    expect(assertApplicationFileAcceptable(PDF_BYTES)).toBe("application/pdf");
  });

  it("returns the detected mime for a DOCX", () => {
    expect(assertApplicationFileAcceptable(DOCX_BYTES)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("refuses an unknown file type", () => {
    const error = (() => {
      try {
        assertApplicationFileAcceptable(Buffer.from("plain text is not a sample work"));
        return null;
      } catch (caught) {
        return caught;
      }
    })();
    expect(isAppError(error)).toBe(true);
    if (isAppError(error)) {
      expect(error.status).toBe(400);
      expect(error.message).toMatch(/PDF ve DOCX/i);
    }
  });

  it("refuses a file over the size limit", () => {
    const oversized = Buffer.concat([
      PDF_BYTES,
      Buffer.alloc(MAX_APPLICATION_FILE_BYTES + 1, 0x61),
    ]);
    const error = (() => {
      try {
        assertApplicationFileAcceptable(oversized);
        return null;
      } catch (caught) {
        return caught;
      }
    })();
    expect(isAppError(error)).toBe(true);
    if (isAppError(error)) {
      expect(error.status).toBe(400);
      expect(error.message).toMatch(/çok büyük/i);
    }
  });
});