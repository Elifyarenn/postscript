/**
 * Where a name links to (D-209). One function decides for the whole panel, so
 * a name is linked in the same places for the same reasons.
 */
import { describe, expect, it } from "vitest";
import { hasProfile, profileHref } from "@/lib/profile-link";

describe("profileHref", () => {
  it("prefers the magazine author page, which is what the magazine means by profile", () => {
    expect(
      profileHref({ penName: "Kedyumi", penNameSlug: "kedyumi", username: "zey" }),
    ).toBe("/magazine/authors/kedyumi");
  });

  it("falls back to the community profile when there is no pen name", () => {
    expect(profileHref({ penName: null, penNameSlug: null, username: "zey" })).toBe("/social/u/zey");
  });

  it("refuses a slug without a pen name, which would title the page İsimsiz", () => {
    expect(profileHref({ penName: null, penNameSlug: "eski-mahlas", username: null })).toBeNull();
    expect(profileHref({ penName: null, penNameSlug: "eski-mahlas", username: "zey" })).toBe("/social/u/zey");
  });

  it("gives nothing to someone with neither, so the name stays plain text", () => {
    expect(profileHref({})).toBeNull();
    expect(profileHref({ penName: "Mahlas", penNameSlug: null, username: null })).toBeNull();
    expect(hasProfile({ penName: null, penNameSlug: null, username: null })).toBe(false);
    expect(hasProfile({ username: "zey" })).toBe(true);
  });
});
