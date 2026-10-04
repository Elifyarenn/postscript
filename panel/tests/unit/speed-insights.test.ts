/**
 * What leaves the browser with a speed measurement (D-313): the route pattern,
 * never the username or query string in the real address.
 */
import { describe, expect, it } from "vitest";
import { pageAddressOnly } from "@/components/speed-insights";

describe("pageAddressOnly", () => {
  it("replaces the address with its route pattern", () => {
    const sent = pageAddressOnly({
      type: "vital",
      url: "https://www.postscriptmag.com/social/u/elif?tab=replies",
      route: "/social/u/[username]",
    });
    expect(sent.url).toBe("https://www.postscriptmag.com/social/u/[username]");
  });

  it("drops the query string where there is no route", () => {
    const sent = pageAddressOnly({ type: "vital", url: "https://www.postscriptmag.com/login?next=/account" });
    expect(sent.url).toBe("https://www.postscriptmag.com/login");
  });
});
