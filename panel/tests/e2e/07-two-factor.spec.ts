/**
 * Two factor enrolment: the step after the recovery codes, and the guard that
 * stops an unverified session from resetting a factor that already exists.
 *
 * Runs last because it enrols the writer account, which the earlier scenarios
 * expect to log in without a second factor.
 */
import { expect, test } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { SEED, submitLogin } from "./helpers";

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

test("enrolment ends with a way onwards, gated on keeping the codes", async ({ page }) => {
  // A writer may turn the factor on voluntarily, so enrolment starts from the
  // profile page rather than from a forced redirect
  await submitLogin(page, SEED.writer);
  await page.waitForURL("**/writer**");

  await page.goto("/two-factor/setup");
  const secret = (await page.locator("code").first().innerText()).trim();

  await page.getByLabel("Uygulamadaki kod").fill(codeFor(secret));
  await page.getByRole("button", { name: "Doğrula ve aç" }).click();

  await expect(page.getByText("İki adımlı doğrulama açıldı")).toBeVisible();
  await expect(page.getByText("Kurtarma kodları", { exact: true })).toBeVisible();

  // Ten single-use codes, shown this once and never again
  await expect(page.locator("ul.font-mono li")).toHaveCount(10);

  // The way onwards stays shut until the reader confirms they kept them
  const proceed = page.getByRole("button", { name: "Panele devam et" });
  await expect(proceed).toBeDisabled();

  await page.getByRole("checkbox").check();
  await expect(proceed).toBeEnabled();

  await proceed.click();
  await page.waitForURL("**/writer");
});

test("an unverified session cannot reset a factor that is already in place", async ({
  page,
  context,
}) => {
  await context.clearCookies();

  // Logging in now stops at the second factor
  await submitLogin(page, SEED.writer);
  await page.waitForURL("**/two-factor");

  // Opening the setup page would stage a fresh secret and clear the
  // confirmation, so it is refused until the current factor is proven
  await page.goto("/two-factor/setup");
  await page.waitForURL("**/two-factor");
  await expect(page.getByText("Doğrulama uygulamanızdaki altı haneli kodu girin.")).toBeVisible();
});

test("a reader can turn the factor on from the account page", async ({ page, context }) => {
  await context.clearCookies();

  await submitLogin(page, SEED.reader);
  // The reader was promoted to writer in scenario 03, so this lands on /writer
  await page.waitForURL(/\/(writer|account)/);

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "İki adımlı doğrulama" })).toBeVisible();

  await page.getByRole("link", { name: "Kurulumu başlat" }).click();
  await page.waitForURL("**/two-factor/setup");
  await expect(page.locator("code").first()).toBeVisible();
});

test("an unverified session cannot reach the account page or its actions", async ({
  page,
  context,
}) => {
  await context.clearCookies();

  // The writer enrolled in the first scenario, so this login owes a factor
  await submitLogin(page, SEED.writer);
  await page.waitForURL("**/two-factor");

  // The page redirects rather than rendering with an unverified session
  await page.goto("/account");
  await page.waitForURL("**/two-factor");

  // Requested directly, it redirects rather than serving the page: the second
  // factor is owed before anything behind it opens
  const landing = await page.evaluate(async () => {
    const response = await fetch("/account");
    return { url: response.url, redirected: response.redirected };
  });
  expect(landing.redirected).toBe(true);
  expect(landing.url).toContain("/two-factor");
});
