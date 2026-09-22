/**
 * The name behind a team byline choice (D-229). The admin reads the name the
 * team page will carry, not only which of the two the person picked.
 */
import { describe, expect, it } from "vitest";
import { teamBylineName } from "@/lib/zodiac";

const person = { displayName: "Elif Yaren Çekiç", penName: "Kedyumi" };

describe("teamBylineName", () => {
  it("gives the account name to someone who chose their name", () => {
    expect(teamBylineName("real_name", person)).toBe("Elif Yaren Çekiç");
  });

  it("gives the pen name to someone who chose their pen name", () => {
    expect(teamBylineName("pen_name", person)).toBe("Kedyumi");
  });

  it("gives nothing when the pen name was never set", () => {
    // The card then warns instead of printing an empty pair of brackets
    expect(teamBylineName("pen_name", { ...person, penName: null })).toBeNull();
  });

  it("gives nothing before the form is answered", () => {
    expect(teamBylineName(null, person)).toBeNull();
  });
});
