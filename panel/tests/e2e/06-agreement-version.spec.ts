/**
 * §13.2 — publishing a new agreement version makes it the current one. It no
 * longer locks writers: the contract is handled outside the panel for now, so
 * writers keep working (D-050).
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

test("a new version becomes current without locking writers", async ({ page }) => {
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

  await logout(page);

  /* ---------- the writer is NOT locked by the new version ---------- */

  await submitLogin(page, SEED.writer);
  await page.waitForURL("**/writer**");
  await expect(page.getByText("Yazar sayfalarınız kilitli")).toHaveCount(0);
  await page.goto("/writer/articles");
  await expect(page).toHaveURL(/\/writer\/articles$/);
});
