/**
 * Two factor authentication, which only the admin role carries (D-025).
 *
 * Covers the enrolment screen's last step, the guard that stops an unverified
 * session from resetting a factor that already exists, and the fact that no
 * other role is offered one.
 */
import { expect, test } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { loadSecret, loginElevated, logout, SEED, submitLogin } from "./helpers";

test.describe.configure({ mode: "serial" });

function codeFor(secret: string): string {
  return new OTPAuth.TOTP({
    issuer: "postscript",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

test("the admin is asked for a code at every login", async ({ page }) => {
  // Enrolled by an earlier scenario, so this login stops at the challenge
  await loginElevated(page, "admin", SEED.admin);
  await expect(page).toHaveURL(/\/admin$/);

  await logout(page);

  await submitLogin(page, SEED.admin);
  await page.waitForURL("**/two-factor");
  await expect(page.getByText("Doğrulama uygulamanızdaki altı haneli kodu girin.")).toBeVisible();
});

test("an unverified session cannot reset the factor or reach the account page", async ({
  page,
  context,
}) => {
  await context.clearCookies();

  await submitLogin(page, SEED.admin);
  await page.waitForURL("**/two-factor");

  // Opening the setup page would stage a fresh secret and clear the
  // confirmation, so it is refused until the current factor is proven
  await page.goto("/two-factor/setup");
  await page.waitForURL("**/two-factor");

  // The account page and everything behind it stay shut as well
  await page.goto("/account");
  await page.waitForURL("**/two-factor");

  const landing = await page.evaluate(async () => {
    const response = await fetch("/account");
    return { url: response.url, redirected: response.redirected };
  });
  expect(landing.redirected).toBe(true);
  expect(landing.url).toContain("/two-factor");
});

test("re-enrolment ends with a way onwards, gated on keeping the codes", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await loginElevated(page, "admin", SEED.admin);

  // Allowed here because the session has already proven the current device
  await page.goto("/two-factor/setup");
  const secret = (await page.locator("code").first().innerText()).trim();

  await page.getByLabel("Uygulamadaki kod").fill(codeFor(secret));
  await page.getByRole("button", { name: "Doğrula ve aç" }).click();

  await expect(page.getByText("İki adımlı doğrulama açıldı")).toBeVisible();
  // Ten single-use codes, shown this once and never again
  await expect(page.locator("ul.font-mono li")).toHaveCount(10);

  const proceed = page.getByRole("button", { name: "Panele devam et" });
  await expect(proceed).toBeDisabled();

  await page.getByRole("checkbox").check();
  await expect(proceed).toBeEnabled();

  await proceed.click();
  await page.waitForURL("**/admin");

  // The old secret is gone, so later logins must use the new one
  const previous = await loadSecret("admin");
  expect(secret).not.toBe(previous);
});

test("no other role is offered a second factor", async ({ page, context }) => {
  for (const account of [SEED.editor, SEED.writer, SEED.reader]) {
    await context.clearCookies();

    // Straight in: no challenge, no enrolment screen
    await submitLogin(page, account);
    await expect(page).not.toHaveURL(/two-factor/);

    // And the setup page is not a way in through the back
    await page.goto("/two-factor/setup");
    await expect(page).not.toHaveURL(/two-factor/);
  }

  // The account page offers nothing to switch on either
  await expect(page.getByRole("heading", { name: "İki adımlı doğrulama" })).toHaveCount(0);
});
