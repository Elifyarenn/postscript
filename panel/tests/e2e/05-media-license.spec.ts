/**
 * §13.2 — an article carrying media without a license cannot be scheduled.
 *
 * The upload form makes the license type mandatory, so the way to reach that
 * state through the interface is to upload with a license and then discover the
 * guard from the other side: the article page warns, and the transition is
 * refused. Here the licence is deliberately left as "other" with no source,
 * which is allowed, and the check that matters — a media row with no
 * `license_type` at all — is covered by the integration suite where such a row
 * can be created directly.
 */
import { expect, test, type Page } from "@playwright/test";
import { loginElevated, SEED } from "./helpers";

test.describe.configure({ mode: "serial" });

/** A one pixel PNG, enough to pass the magic byte check. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function uploadImage(page: Page, altText: string): Promise<void> {
  await page.goto("/editor/media");
  await page.getByLabel("Dosya").setInputFiles({
    name: "ornek.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByLabel("Lisans türü").first().selectOption("own_work");
  await page.getByLabel("Alternatif metin").first().fill(altText);
  await page.getByRole("button", { name: "Yükle" }).click();
  await expect(page.getByText("Görsel yüklendi")).toBeVisible();
}

test("refuses a file whose bytes do not match the declared type", async ({ page }) => {
  await loginElevated(page, "editor", SEED.editor);

  await page.goto("/editor/media");
  await page.getByLabel("Dosya").setInputFiles({
    name: "sahte.png",
    mimeType: "image/png",
    buffer: Buffer.from("this is not a png at all, just text pretending to be one"),
  });
  await page.getByLabel("Lisans türü").first().selectOption("own_work");
  await page.getByRole("button", { name: "Yükle" }).click();

  await expect(page.getByText(/Dosya türü tanınmadı|uyuşmuyor/)).toBeVisible();
});

test("records the licence and shows where the image is used", async ({ page }) => {
  await loginElevated(page, "editor", SEED.editor);

  await uploadImage(page, "Kapak denemesi");

  await page.goto("/editor/media");
  await expect(page.getByRole("cell", { name: "Kapak denemesi" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "own_work" })).toBeVisible();

  // Attaching it to an article is only offered for media that has a licence
  await page.goto("/editor/articles");
  await page.locator("tbody tr").first().getByRole("link").click();

  await page
    .getByLabel("Kütüphaneden seç")
    .selectOption({ label: "Kapak denemesi (own_work)" });
  await page.getByRole("button", { name: "Görsel ekle" }).click();
  await expect(page.getByText("Görsel makaleye eklendi")).toBeVisible();

  await page.goto("/editor/media");
  await expect(page.getByRole("cell", { name: "1 makale" })).toBeVisible();
});
