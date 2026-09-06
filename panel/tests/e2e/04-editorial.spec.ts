/**
 * §13.2 — the editorial lifecycle through the interface.
 *
 * accepted → a rights grant opens → scheduling is refused with 409 while it is
 * unsigned → the writer signs → scheduled → published → withdrawn answers 410
 * from the public API.
 */
import { expect, test, type Page } from "@playwright/test";
import { loginElevated, logout, SEED, submitLogin } from "./helpers";

test.describe.configure({ mode: "serial" });

const ARTICLE_TITLE = "Uçtan Uca Yayın Denemesi";

/** The article detail page prints its slug under the title. */
async function readSlug(page: Page): Promise<string> {
  const text = await page.locator("header p").first().innerText();
  return text.trim().replace(/^\//, "");
}

/**
 * The status badge in the page header: the article's real status.
 *
 * Every step waits on this rather than on a success message, because the alert
 * from the previous action is still on screen and would let the test run ahead
 * of the transition it has just triggered.
 */
function statusBadge(page: Page) {
  return page.locator("header span").last();
}

/** Picks a target status, submits it, and waits until the badge shows it. */
async function transitionTo(page: Page, label: string, expectedBadge = label): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("button", { name: `"${label}" durumuna geç` }).click();
  await expect(statusBadge(page)).toHaveText(expectedBadge);
}

test("takes an article from draft to published and then withdraws it", async ({ page }) => {
  /* ---------- the editor creates and accepts it ---------- */

  await loginElevated(page, "editor", SEED.editor);

  await page.goto("/editor/articles");
  await page.getByLabel("Başlık").fill(ARTICLE_TITLE);
  await page.getByLabel("Özet").fill("Uçtan uca test için oluşturuldu.");
  // The filter form has a "Yazar" select too, so the create form's id is used
  await page.locator("#newAuthorId").selectOption({ label: "Ada Y." });
  await page.getByLabel("Gövde (markdown)").fill("## Giriş\n\nDeneme gövdesi.\n");
  await page.getByRole("button", { name: "Oluştur" }).click();

  await page.waitForURL(/\/editor\/articles\/[0-9a-f-]{36}$/);
  const articleUrl = page.url();
  const slug = await readSlug(page);

  await transitionTo(page, "İncelemede");

  // Acceptance is not a resting state: it opens the rights grant and the
  // article moves on to "awaiting rights" by itself (§7.2)
  await transitionTo(page, "Kabul edildi", "Devir formu bekleniyor");
  await expect(page.getByText("Hak devri formu:")).toBeVisible();

  /* ---------- scheduling is refused without a signature ---------- */

  await page.getByRole("button", { name: "Yayına planlandı", exact: true }).click();
  await page.getByRole("button", { name: '"Yayına planlandı" durumuna geç' }).click();

  await expect(
    page.getByText("İmzalanmış hak devri formu olmadan makale yayına alınamaz."),
  ).toBeVisible();
  // Nothing moved
  await expect(statusBadge(page)).toHaveText("Devir formu bekleniyor");

  await logout(page);

  /* ---------- the writer signs ---------- */

  await submitLogin(page, SEED.writer);
  await page.waitForURL("**/writer**");

  await page.goto("/writer/rights");
  await page.getByRole("link", { name: "Formu aç" }).first().click();

  // FSEK art. 52: every right is named individually on the form
  await expect(page.getByText("İşleme hakkı (FSEK m.21)")).toBeVisible();
  await expect(page.getByText("Çoğaltma hakkı (FSEK m.22)")).toBeVisible();
  await expect(page.getByText("Yayma hakkı (FSEK m.23)")).toBeVisible();
  await expect(page.getByText("Umuma iletim hakkı (FSEK m.25)")).toBeVisible();
  await expect(page.getByText("Bedel: Yok")).toBeVisible();

  await expect(page.getByRole("button", { name: "İmzala" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "İmzala" }).click();

  await expect(page.getByText("Bu formu imzaladınız")).toBeVisible();

  await logout(page);

  /* ---------- the editor schedules and publishes ---------- */

  await loginElevated(page, "editor", SEED.editor);
  await page.goto(articleUrl);

  await transitionTo(page, "Yayına planlandı");
  await transitionTo(page, "Yayınlandı");

  // The public API serves it now
  const published = await page.request.get(`/api/public/articles/${slug}`);
  expect(published.status()).toBe(200);
  const body = await published.json();
  expect(body.title).toBe(ARTICLE_TITLE);
  // The author's private data must never appear in a public payload
  expect(JSON.stringify(body)).not.toContain(SEED.writer.email);

  /* ---------- withdrawal ---------- */

  await page.getByRole("button", { name: "Geri çekildi", exact: true }).click();
  await page.getByLabel("Geri çekme gerekçesi").fill("Telif itirazı geldi.");
  await page.getByRole("button", { name: '"Geri çekildi" durumuna geç' }).click();
  await expect(statusBadge(page)).toHaveText("Geri çekildi");

  const withdrawn = await page.request.get(`/api/public/articles/${slug}`);
  expect(withdrawn.status()).toBe(410);

  // Something that was never published is a 404, not a 410
  const missing = await page.request.get("/api/public/articles/hic-yayinlanmamis-yazi");
  expect(missing.status()).toBe(404);
});
