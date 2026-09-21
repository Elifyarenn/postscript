/**
 * The panel sidebars (D-221). Only what the navigation promises is checked
 * here; every page still guards itself.
 */
import { describe, expect, it } from "vitest";
import { ADMIN_NAV, EDITOR_NAV, writerNav, type NavGroup } from "@/components/shell";

const hrefs = (groups: NavGroup[]): string[] =>
  groups.flatMap((group) =>
    group.items.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]),
  );

describe("the panel sidebars", () => {
  it("offers the avatar builder in every panel, admin included", () => {
    // The builder is open to writers, editors, admins and illustrators alike,
    // but for a long time only the writer and editor panels linked to it
    expect(hrefs(ADMIN_NAV)).toContain("/team/avatar");
    expect(hrefs(EDITOR_NAV)).toContain("/team/avatar");
    expect(hrefs(writerNav(false))).toContain("/team/avatar");
  });

  it("keeps the builder reachable for a writer whose panel is locked", () => {
    // A locked writer may still make an avatar; only the article pages close
    const item = writerNav(true)
      .flatMap((group) => group.items)
      .find((entry) => entry.href === "/team/avatar");
    expect(item?.disabled).toBeFalsy();
  });
});
