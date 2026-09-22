/**
 * The team form's ready lines (D-227): that they fit the field, and that the
 * right ones are offered for what a person does.
 */
import { describe, expect, it } from "vitest";
import { MOTTO_SUGGESTIONS, mottoGroupsFor } from "@/lib/motto-suggestions";
import { MOTTO_MAX } from "@/lib/zodiac";

describe("the ready lines", () => {
  it("all fit the field, so picking one can never be refused", () => {
    for (const group of MOTTO_SUGGESTIONS) {
      for (const line of group.lines) {
        expect(line.length, `${group.id}: ${line}`).toBeLessThanOrEqual(MOTTO_MAX);
        expect(line.trim()).toBe(line);
      }
    }
  });

  it("gives a writer the writers' lines and nothing else", () => {
    const groups = mottoGroupsFor({ role: "writer", isIllustrator: false });
    expect(groups.map((group) => group.id)).toEqual(["writer"]);
  });

  it("gives someone who writes and draws both lists", () => {
    const groups = mottoGroupsFor({ role: "writer", isIllustrator: true });
    expect(groups.map((group) => group.id)).toEqual(["writer", "illustrator"]);
  });

  it("gives an editor and an admin the editors' lines", () => {
    expect(mottoGroupsFor({ role: "editor", isIllustrator: false }).map((g) => g.id)).toEqual(["editor"]);
    expect(mottoGroupsFor({ role: "admin", isIllustrator: false }).map((g) => g.id)).toEqual(["editor"]);
  });

  it("gives a reader marked as an illustrator the drawing lines", () => {
    // Four accounts carry the illustrator mark; two of them hold no role
    expect(mottoGroupsFor({ role: "user", isIllustrator: true }).map((g) => g.id)).toEqual(["illustrator"]);
  });

  it("falls back to every line rather than none", () => {
    expect(mottoGroupsFor({ role: "user", isIllustrator: false })).toHaveLength(MOTTO_SUGGESTIONS.length);
  });
});
