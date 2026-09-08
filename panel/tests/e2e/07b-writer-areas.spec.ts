/**
 * Admin-managed writing areas (D-055): a new area appears on the public
 * registration form, and a disabled one disappears from it.
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

test("a disabled area is gone from the public registration form", async ({ page }) => {
  await page.goto("/yazar-basvuru");
  await expect(page.getByRole("heading", { name: "Yazar hesabı oluştur" })).toBeVisible();

  const radio = page.locator('input[name="area"]', { has: page.getByText("Yemek & Seyahat") });
  await expect(radio).toHaveCount(0);
});