/** Which pages the reader fetches ahead of a turn (D-343). */
import { describe, expect, it } from "vitest";
import { pagesToPreload } from "@/lib/issue-reader";

const pages = Array.from({ length: 10 }, (_, index) => index);

describe("pagesToPreload", () => {
  it("one page at a time: the next two, then the one before", () => {
    expect(pagesToPreload(pages, 4, 1, false)).toEqual([5, 6, 3]);
  });

  it("in spreads: the next two spreads, then the spread before", () => {
    expect(pagesToPreload(pages, 3, 2, true)).toEqual([5, 6, 7, 8, 1, 2]);
  });

  it("from the cover, which stands alone, and at the end, with nothing past it", () => {
    expect(pagesToPreload(pages, 0, 1, true)).toEqual([1, 2, 3, 4]);
    expect(pagesToPreload(pages, 9, 1, false)).toEqual([8]);
  });
});
