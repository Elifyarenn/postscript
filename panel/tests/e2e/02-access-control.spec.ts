/**
 * §13.2 — a plain `user` gets 403 from every panel area.
 *
 * The assertion is on the HTTP status, not on what the page looks like: hiding
 * a menu entry is not authorisation, and a redirect would not prove the door is
 * actually locked.
 */
import { expect, test } from "@playwright/test";
import { SEED, submitLogin } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await submitLogin(page, SEED.reader);
  await page.waitForURL("**/account**");
});

for (const area of ["/writer", "/editor", "/admin"]) {
  test(`answers 403 for ${area}`, async ({ page }) => {
    const response = await page.goto(area);

    expect(response?.status()).toBe(403);
    await expect(page.getByText("Bu sayfaya erişim yetkiniz yok")).toBeVisible();
  });
}

test("answers 403 for the nested panel pages too", async ({ page }) => {
  for (const area of ["/admin/users", "/editor/articles", "/writer/approvals"]) {
    const response = await page.goto(area);
    expect(response?.status(), area).toBe(403);
  }
});

test("refuses the admin CSV export to a plain user", async ({ page }) => {
  // Fetched from inside the page so the session cookie travels with it
  const status = await page.evaluate(async () => {
    const response = await fetch("/api/admin/audit.csv");
    return response.status;
  });
  expect(status).toBe(403);
});

test("sends a signed-out visitor to the login screen instead", async ({ page, context }) => {
  await context.clearCookies();

  await page.goto("/admin");
  await page.waitForURL("**/login");
});
