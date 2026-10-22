/**
 * D-351 — a visitor without a session is served cached copies of the public
 * pages; a member keeps the per-request pages with their own menu and forms.
 *
 * The cached copy must carry nothing personal: no account menu, no form token.
 * A search stays per request, and an issue that is not published stays a 404
 * for a visitor whether the copy is fresh or not.
 */
import { expect, test } from "@playwright/test";
import { completeTwoFactorIfAsked, SEED, submitLogin } from "./helpers";

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
