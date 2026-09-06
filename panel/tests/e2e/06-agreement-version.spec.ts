/**
 * §13.2 — publishing a new agreement version drops every active writer back to
 * `pending_agreement` until they accept it.
 *
 * This one runs last, because it deliberately locks the writer accounts the
 * earlier scenarios rely on.
 */
import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loginElevated, logout, SEED, submitLogin } from "./helpers";

const TEMPLATE = path.join(
  process.cwd(),
  "contracts",
  "yazar-sozlesmesi-ve-ruhsat-taahhudu.md",
);

test.describe.configure({ mode: "serial" });

test("a new version locks active writers until they accept it again", async ({ page }) => {
  await loginElevated(page, "admin", SEED.admin);

  await page.goto("/admin/agreements");
  await expect(page.getByText("Yayınlamanın sonuçları")).toBeVisible();

  // v1 came from this exact file, so the panel refuses to version it again
  await expect(page.getByText(/zaten bir sürüm olarak kayıtlı/)).toBeVisible();

  // A new version means a changed contract text, so the file is edited
  const original = await readFile(TEMPLATE, "utf8");
  await writeFile(TEMPLATE, `${original}

*Ek not: ikinci sürüm.*
`, "utf8");

  try {
    await page.reload();
    await page.getByRole("button", { name: "Şablondan sürüm oluştur" }).click();
    await expect(page.getByText("Taslak v2")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Bu sürümü yayınla" }).first().click();
    await expect(page.getByText("Taslak v2")).toHaveCount(0);
  } finally {
    await writeFile(TEMPLATE, original, "utf8");
  }

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

  await page.locator("div.overflow-y-auto").first().evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /kabul ediyorum/i }).click();
  // The acceptance form is replaced by the accepted view; that swap is the
  // outcome, and the record it leaves behind is what matters
  await expect(page.getByText("Bu sürümü onayladınız")).toBeVisible();
  await expect(page.getByRole("link", { name: "İndir" }).first()).toBeVisible();

  // The acceptance history keeps the earlier version, marked as superseded
  await page.goto("/writer/agreement");
  await expect(page.getByText("Yeni sürümle değiştirildi")).toBeVisible();

  await page.goto("/writer/articles");
  await expect(page).toHaveURL(/\/writer\/articles$/);
});
