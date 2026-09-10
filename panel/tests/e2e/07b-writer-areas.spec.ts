/**
 * Admin-managed writing areas (D-055): an admin adds, renames, re-quotas and
 * disables areas from the "Yazı alanları" screen.
 */
import { expect, test } from "@playwright/test";
import { loginElevated, logout, SEED } from "./helpers";

test.describe.configure({ mode: "serial" });

test("an admin adds and disables a writing area", async ({ page }) => {
  await loginElevated(page, "admin", SEED.admin);

  await page.getByRole("link", { name: "Yazı alanları" }).click();
  await page.waitForURL("**/admin/categories");

  // Add a new area (scoped: every row's edit form carries its own labels)
  const addForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Alan ekle" }) });
  await addForm.getByLabel("Alan adı").fill("Yemek & Seyahat");
  await addForm.getByLabel("Kontenjan").fill("4");
  await addForm.getByRole("button", { name: "Alan ekle" }).click();
  await expect(page.getByText("Alan eklendi")).toBeVisible();
  await expect(page.getByText("Yemek & Seyahat")).toBeVisible();
  await expect(page.getByText("0/4")).toBeVisible();

  // Disable it from its row's edit form
  const row = page.locator("tr", { hasText: "Yemek & Seyahat" });
  await row.getByLabel("Kayıt formunda gösterilsin").uncheck();
  await row.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Alan güncellendi")).toBeVisible();
  await expect(row.getByText("Pasif")).toBeVisible();

  await logout(page);
});