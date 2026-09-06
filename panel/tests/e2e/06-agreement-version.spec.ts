/**
 * §13.2 — publishing a new agreement version drops every active writer back to
 * `pending_agreement` until they accept it.
 *
 * This one runs last, because it deliberately locks the writer accounts the
 * earlier scenarios rely on.
 */
import { expect, test } from "@playwright/test";
import { loginElevated, logout, SEED, submitLogin } from "./helpers";

test.describe.configure({ mode: "serial" });

const NEW_TEXT = [
  "## 1. Güncellenmiş çerçeve",
  "",
  "Bu sürüm, önceki çerçeve sözleşmenin yerini alır ve yazarın yeniden onayını gerektirir.",
  "",
  "## 2. Mali haklar",
  "",
  "Mali haklar her eser için ayrı bir devir formuyla, haklar tek tek sayılarak düzenlenir.",
  "",
  "## 3. Bedel",
  "",
  "Dergi kâr amacı gütmez; eserler için bedel ödenmez.",
].join("\n");

test("a new version locks active writers until they accept it again", async ({ page }) => {
  await loginElevated(page, "admin", SEED.admin);

  await page.goto("/admin/agreements");

  // A published version can never be edited: only a new draft is offered
  await expect(page.getByText("Yayınlamanın sonuçları")).toBeVisible();

  await page.getByLabel("Başlık").first().fill("postscript Çerçeve Sözleşmesi");
  await page.getByLabel("Metin (markdown)").first().fill(NEW_TEXT);
  await page.getByRole("button", { name: "Taslak oluştur" }).click();
  await expect(page.getByText("Taslak oluşturuldu")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Bu sürümü yayınla" }).first().click();

  // Wait for the action to finish before reading the result
  await expect(page.getByText("Taslak v2")).toHaveCount(0);

  // Publishing removes the draft card, so the outcome is read from the page
  // that replaces it: version 2 is now the current one
  await page.goto("/admin/agreements");
  await expect(page.getByRole("cell", { name: "v2" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "güncel" })).toBeVisible();

  // The report shows the writers waiting again
  await expect(page.getByText(/Bekleyenler \([1-9]/)).toBeVisible();

  await logout(page);

  /* ---------- the writer is locked out until they accept ---------- */

  await submitLogin(page, SEED.writer);
  await page.waitForURL("**/writer**");
  await expect(page.getByText("Yazar sayfalarınız kilitli")).toBeVisible();

  await page.goto("/writer/articles");
  await page.waitForURL("**/writer/agreement");

  await page.locator("div.prose-panel").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /kabul ediyorum/i }).click();
  await expect(page.getByText("Sözleşmeyi onayladınız")).toBeVisible();

  // The acceptance history keeps the earlier version, marked as superseded
  await page.goto("/writer/agreement");
  await expect(page.getByText("Yeni sürümle değiştirildi")).toBeVisible();

  await page.goto("/writer/articles");
  await expect(page).toHaveURL(/\/writer\/articles$/);
});
