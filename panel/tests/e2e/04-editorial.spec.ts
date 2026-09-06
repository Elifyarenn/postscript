/**
 * §13.2 — the editorial lifecycle through the interface.
 *
 * accepted → a work approval opens → scheduling is refused while it is
 * unapproved → the writer approves → scheduled → published → withdrawn answers
 * 410 from the public API.
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

  // Acceptance is not a resting state: it opens the work approval and the
  // article moves on to "awaiting rights" by itself (§7.1)
  await transitionTo(page, "Kabul edildi", "Devir formu bekleniyor");
  await expect(page.getByText("Eser Onayı:")).toBeVisible();

  /* ---------- scheduling is refused without a signature ---------- */

  await page.getByRole("button", { name: "Yayına planlandı", exact: true }).click();
  await page.getByRole("button", { name: '"Yayına planlandı" durumuna geç' }).click();

  await expect(
    page.getByText("İmzalanmış hak devri formu olmadan makale yayına alınamaz."),
  ).toBeVisible();
  // Nothing moved
  await expect(statusBadge(page)).toHaveText("Devir formu bekleniyor");

  await logout(page);

  /* ---------- the writer approves the work ---------- */

  await submitLogin(page, SEED.writer);
  await page.waitForURL("**/writer**");

  await page.goto("/writer/approvals");

  // §7.2: the screen shows the title, the hash of the accepted text, the
  // contract version and the sentence being agreed to
  await expect(page.getByText(ARTICLE_TITLE)).toBeVisible();
  await expect(page.getByText(/Kabul edilen metnin özeti/)).toBeVisible();
  await expect(page.getByText(/Sözleşme sürümü: v1/)).toBeVisible();
  await expect(
    page.getByText("Bu eseri Sözleşme'nin 4. maddesindeki şartlarla ruhsatlıyorum."),
  ).toBeVisible();

  const approve = page.getByRole("button", { name: "Onayla" });
  await expect(approve).toBeDisabled();
  await page.getByRole("checkbox").check();
  await approve.click();

  // The row leaves the pending list for the history, where the record and its
  // PDF live; that move is the outcome, not a transient message
  await expect(page.getByText("Onayınızı bekleyen eser yok.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Onay kaydı (PDF)" })).toBeVisible();

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

  /* ---------- a reader reads it ---------- */

  // SEED.reader is a writer by now (03 promoted it), so the plain reader here
  // is the other ordinary account
  await logout(page);
  await submitLogin(page, SEED.minor);
  await page.waitForURL("**/magazine**");

  await page.getByRole("link", { name: ARTICLE_TITLE }).first().click();
  await page.waitForURL(`**/magazine/articles/${slug}`);
  await expect(page.getByRole("heading", { name: ARTICLE_TITLE })).toBeVisible();
  await expect(page.getByText("Deneme gövdesi.")).toBeVisible();

  // and the reader's sidebar offers nothing editorial
  await expect(page.getByRole("link", { name: "Makaleler" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Genel bakış" })).toHaveCount(0);

  await logout(page);
  await loginElevated(page, "editor", SEED.editor);
  await page.goto(articleUrl);

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

test("a content change revokes the approval and asks for a new one", async ({ page }) => {
  const title = "İçerik Değişikliği Denemesi";

  /* ---------- editor creates and accepts ---------- */

  await loginElevated(page, "editor", SEED.editor);

  await page.goto("/editor/articles");
  await page.getByLabel("Başlık").fill(title);
  await page.locator("#newAuthorId").selectOption({ label: "Ada Y." });
  await page.getByLabel("Gövde (markdown)").fill("## İlk\n\nİlk gövde.\n");
  await page.getByRole("button", { name: "Oluştur" }).click();

  await page.waitForURL(/\/editor\/articles\/[0-9a-f-]{36}$/);
  const articleUrl = page.url();

  await transitionTo(page, "İncelemede");
  await transitionTo(page, "Kabul edildi", "Devir formu bekleniyor");

  /* ---------- the writer approves ---------- */

  await logout(page);
  await submitLogin(page, SEED.writer);
  await page.waitForURL("**/writer**");

  await page.goto("/writer/approvals");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Onayla" }).click();
  await expect(page.getByText("Onayınızı bekleyen eser yok.")).toBeVisible();

  await logout(page);

  /* ---------- a correction leaves the approval alone ---------- */

  await loginElevated(page, "editor", SEED.editor);
  await page.goto(articleUrl);

  await page.getByLabel("Gövde (markdown)").fill("## İlk\n\nİlk gövde, yazımı düzeltildi.\n");
  await page.getByLabel("Değişikliğin türü").selectOption("correction");
  await page
    .locator("form")
    .filter({ has: page.getByLabel("Değişikliğin türü") })
    .getByRole("button", { name: "Kaydet" })
    .click();
  await expect(page.getByText("Makale kaydedildi")).toBeVisible();

  await page.goto(articleUrl);
  await expect(page.getByText("Eser Onayı: signed")).toBeVisible();

  /* ---------- a content change revokes it ---------- */

  await page.getByLabel("Gövde (markdown)").fill("## Bambaşka\n\nAnlamı değişmiş bir gövde.\n");
  await page.getByLabel("Değişikliğin türü").selectOption("content_change");
  await page
    .locator("form")
    .filter({ has: page.getByLabel("Değişikliğin türü") })
    .getByRole("button", { name: "Kaydet" })
    .click();

  await page.goto(articleUrl);
  await expect(page.getByText("Eser Onayı: pending")).toBeVisible();

  // And the writer is asked again, for the new text
  await logout(page);
  await submitLogin(page, SEED.writer);
  await page.waitForURL("**/writer**");

  await page.goto("/writer/approvals");
  // The heading belongs to the pending row; the revoked one sits in the history
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("İptal edildi")).toBeVisible();
});
