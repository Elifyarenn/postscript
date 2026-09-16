/**
 * What the edit-profile dialog does with a picked picture before sending it (D-161).
 */
import { describe, expect, it } from "vitest";
import {
  fitWithin,
  KEEP_ORIGINAL_BYTES,
  MAX_PROFILE_UPLOAD_BYTES,
  MAX_SOURCE_IMAGE_BYTES,
  planPicture,
  uploadProblem,
} from "@/lib/profile-limits";

const MB = 1024 * 1024;

describe("fitWithin", () => {
  it("shrinks the long side to the limit and keeps the shape", () => {
    expect(fitWithin(4032, 3024, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitWithin(3024, 4032, 1000)).toEqual({ width: 750, height: 1000 });
    expect(fitWithin(6000, 2000, 2000)).toEqual({ width: 2000, height: 667 });
  });

  it("never enlarges a small picture", () => {
    expect(fitWithin(400, 300, 1000)).toEqual({ width: 400, height: 300 });
  });
});

describe("planPicture (D-161)", () => {
  const phonePhoto = { width: 4032, height: 3024 };

  it("shrinks a typical phone photo, which Vercel would refuse as it is", () => {
    expect(planPicture({ type: "image/jpeg", size: 6 * MB }, phonePhoto, "avatar")).toEqual({
      kind: "shrink",
      width: 1000,
      height: 750,
    });
    expect(planPicture({ type: "image/jpeg", size: 6 * MB }, phonePhoto, "header")).toEqual({
      kind: "shrink",
      width: 2000,
      height: 1500,
    });
  });

  it("sends a small picture untouched", () => {
    expect(planPicture({ type: "image/png", size: 200_000 }, { width: 800, height: 800 }, "avatar")).toEqual({
      kind: "keep",
    });
  });

  it("shrinks a picture that is small in pixels but heavy in bytes", () => {
    const plan = planPicture({ type: "image/png", size: KEEP_ORIGINAL_BYTES + 1 }, { width: 900, height: 900 }, "avatar");
    expect(plan).toEqual({ kind: "shrink", width: 900, height: 900 });
  });

  it("sends a GIF as it is, so it keeps moving, but only within the upload budget", () => {
    expect(planPicture({ type: "image/gif", size: 2 * MB }, null, "avatar")).toEqual({ kind: "keep" });
    expect(planPicture({ type: "image/gif", size: MAX_PROFILE_UPLOAD_BYTES + 1 }, null, "avatar").kind).toBe("refuse");
  });

  it("refuses other types, files too big to decode and pictures that did not open", () => {
    expect(planPicture({ type: "application/pdf", size: 1000 }, null, "avatar").kind).toBe("refuse");
    expect(planPicture({ type: "image/heic", size: 1000 }, phonePhoto, "avatar").kind).toBe("refuse");
    expect(planPicture({ type: "image/jpeg", size: MAX_SOURCE_IMAGE_BYTES + 1 }, phonePhoto, "avatar").kind).toBe(
      "refuse",
    );
    expect(planPicture({ type: "image/jpeg", size: 2 * MB }, null, "header").kind).toBe("refuse");
  });
});

describe("uploadProblem (D-161)", () => {
  it("allows both pictures while together they fit the budget", () => {
    expect(uploadProblem([])).toBeNull();
    expect(uploadProblem([2 * MB, 2 * MB])).toBeNull();
  });

  it("refuses a save whose pictures together pass the budget", () => {
    expect(uploadProblem([3 * MB, 1.5 * MB])).toMatch(/birlikte çok büyük/);
  });
});
