/**
 * D-351 — a visitor without a session is served cached copies of the public
 * pages; a member keeps the per-request pages with their own menu and forms.
 *
 * The cached copy must carry nothing personal: no account menu, no form token.
 * A search stays per request, and an issue that is not published stays a 404
 * for a visitor whether the copy is fresh or not.
 */
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { completeTwoFactorIfAsked, loginElevated, SEED, submitLogin } from "./helpers";

const CACHED = ["/", "/kunye", "/kvkk", "/kullanim-sartlari", "/kategoriler", "/hakkinda", "/hakkinda?bolum=yazarlar", "/magazine", "/magazine/issues"];

test.describe("visitor without a session", () => {
  for (const path of CACHED) {
    test(`${path} is a shared, cacheable copy with nothing personal`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toMatch(/s-maxage=60/);

      const html = await response.text();
      expect(html).not.toContain('name="csrfToken"');
      expect(html).not.toContain("Çıkış");
      // The canonical address stays the public one, never the copy's
      expect(html).not.toMatch(/rel="canonical" href="[^"]*\/anon\//);
    });
  }

  test("a search stays a per-request page", async ({ request }) => {
    const response = await request.get("/magazine?q=dergi");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).not.toMatch(/s-maxage/);
  });

  test("an issue that is not published stays a 404", async ({ request }) => {
    const response = await request.get("/magazine/issues/1");
    expect(response.status()).toBe(404);
  });

  test("an unknown copy is a 404, not a page", async ({ request }) => {
    expect((await request.get("/anon/s/yok")).status()).toBe(404);
  });

  test("the reader of an issue that is not published stays a 404, opened plainly or at a page (D-354)", async ({ request }) => {
    expect((await request.get("/magazine/issues/1/oku")).status()).toBe(404);
    const atPage = await request.get("/magazine/issues/1/oku?s=00000000-0000-0000-0000-000000000000");
    expect(atPage.status()).toBe(404);
    expect(atPage.headers()["cache-control"]).not.toMatch(/s-maxage/);
  });
});

test.describe("a published issue", () => {
  test.describe.configure({ mode: "serial" });

  test("an admin lays out a page and publishes the seeded issue", async ({ page }) => {
    await loginElevated(page, "admin", SEED.admin);
    await page.goto("/editor/issues");
    await page.getByRole("link", { name: "Sayfalar" }).first().click();
    const picture = await sharp({ create: { width: 600, height: 848, channels: 3, background: "#6b1d2f" } }).png().toBuffer();
    await page.locator('input[type="file"]').setInputFiles([{ name: "kapak.png", mimeType: "image/png", buffer: picture }]);
    await page.getByRole("button", { name: /görseli yükle/ }).click();
    await expect(page.getByText(/\d+ sayfa/).first()).toBeVisible({ timeout: 60_000 });

    await page.goto("/editor/issues");
    await page.getByLabel("Durum").first().selectOption("published");
    await page.getByRole("button", { name: "Durumu değiştir" }).first().click();
    await expect(page.getByLabel("Durum").first()).toHaveValue("published");
  });

  test("its reader, opened plainly, is a shared copy; opened at a page it is per request (D-354)", async ({ request }) => {
    const first = await request.get("/magazine/issues/1/oku");
    expect(first.status()).toBe(200);
    expect(first.headers()["cache-control"]).toMatch(/s-maxage=60/);
    const html = await first.text();
    expect(html).not.toContain('name="csrfToken"');
    // Pictures still go through the guarded route while R2 serving is off (D-353)
    expect(html).toContain("/api/issue-pages/");

    const again = await request.get("/magazine/issues/1/oku");
    expect(again.headers()["x-nextjs-cache"]).toBe("HIT");

    const atPage = await request.get("/magazine/issues/1/oku?s=00000000-0000-0000-0000-000000000000");
    expect(atPage.status()).toBe(200);
    expect(atPage.headers()["cache-control"]).not.toMatch(/s-maxage/);
  });

  test("its own page is a shared copy too", async ({ request }) => {
    const response = await request.get("/magazine/issues/1");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toMatch(/s-maxage=60/);
  });
});

test.describe("member with a session", () => {
  test("gets the per-request pages with the account menu", async ({ page }) => {
    await submitLogin(page, SEED.reader);
    await completeTwoFactorIfAsked(page);

    for (const path of ["/", "/magazine/issues"]) {
      const response = await page.goto(path);
      expect(response!.status()).toBe(200);
      expect(response!.headers()["cache-control"]).toMatch(/no-store|private/);
      await expect(page.getByRole("button", { name: "Çıkış" })).toBeVisible();
    }
    // The statutory pages have no site menu; they are per request all the same
    const imprint = await page.goto("/kunye");
    expect(imprint!.headers()["cache-control"]).toMatch(/no-store|private/);
  });
});
