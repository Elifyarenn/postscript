/**
 * D-087 — the admin users list is split into one list per kind of account,
 * reached from the sub-links under "Kullanıcılar" in the sidebar.
 *
 * Named to run before 08: its last test re-enrols the admin with a new TOTP
 * secret, after which the seeded code no longer signs the admin in.
 */
import { expect, test } from "@playwright/test";
import { loginElevated, SEED } from "./helpers";

test("an admin walks the users lists from the sidebar", async ({ page }) => {
  await loginElevated(page, "admin", SEED.admin);

  await page.getByRole("link", { name: "Yazarlar", exact: true }).click();
  await page.waitForURL("**/admin/users/writers");
  await expect(page.getByRole("heading", { name: "Yazarlar", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ada Yazar" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Yazılar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Genç Aday" })).toHaveCount(0);

  await page.getByRole("link", { name: "Editörler", exact: true }).click();
  await page.waitForURL("**/admin/users/editors");
  await expect(page.getByRole("link", { name: "Deniz Editör" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Sorumlu alanlar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Genç Aday" })).toHaveCount(0);

  await page.getByRole("link", { name: "Çizerler", exact: true }).click();
  await page.waitForURL("**/admin/users/illustrators");
  await expect(page.getByText("Henüz çizer yok.")).toBeVisible();

  // The readers sub-link shares its label with the parent item, and comes after it
  await page.getByRole("link", { name: "Kullanıcılar", exact: true }).last().click();
  await page.waitForURL("**/admin/users/readers");
  await expect(page.getByRole("link", { name: "Genç Aday" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "KVKK onayı" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Deniz Editör" })).toHaveCount(0);

  // "Hepsi" is still the list with every account and the role filter
  await page.getByRole("link", { name: "Hepsi", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/admin/users");
  // The column toggles also carry a "Rol" checkbox, so pick the filter by role
  await expect(page.getByRole("combobox", { name: "Rol" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Deniz Editör" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Genç Aday" })).toBeVisible();
});
