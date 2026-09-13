/**
 * The mandatory second factor (D-046): the code step at login, the wrong-code
 * dead end, and the account screen round trip when a staff user has disabled
 * 2FA and is locked out of the panel until it is on again.
 *
 * The account page carries two "Mevcut şifre" fields (the password card and
 * the 2FA card), so the forms here are scoped to the two-factor card's form.
 */
import { expect, test } from "@playwright/test";
import { generateSync } from "otplib";
import {
  loginElevated,
  logout,
  openPanelFromHome,
  SEED,
  submitLogin,
  totpCode,
  waitForHome,
} from "./helpers";

/**
 * The account page shows a fresh secret when 2FA is off. The test reads it
 * back from the page and generates the code with it, the way an authenticator
 * app would.
 */
async function readPendingSecret(page: import("@playwright/test").Page): Promise<string> {
  const text = await page.locator(".font-mono").allTextContents();
  const secret = text.find((entry) => /^[A-Z2-7]{16,}$/.test(entry));
  if (!secret) throw new Error("pending TOTP secret not visible on the account page");
  return secret;
}

function codeFor(secret: string): string {
  return generateSync({ secret, strategy: "totp" });
}

/** The two-factor card's own form, so the password field cannot hit the
 *  password-change card's field with the same label. */
function twoFactorForm(page: import("@playwright/test").Page) {
  return page.locator("form").filter({ has: page.getByRole("button", { name: /doğrulama/i }) });
}

test("an editor login stops at the code screen and a wrong code is refused", async ({ page }) => {
  await submitLogin(page, SEED.editor);
  await page.waitForURL("**/login/2fa");

  await page.getByLabel("Doğrulama kodu").fill("000000");
  await page.getByRole("button", { name: "Doğrula" }).click();

  await expect(page.getByText("Kod doğrulanamadı.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login\/2fa/);

  // The spent ticket sends the user back to the password half
  await page.getByRole("link", { name: "Geri dön ve yeniden giriş yap" }).click();
  await page.waitForURL("**/login");

  await loginElevated(page, "editor", SEED.editor);
  await expect(page).toHaveURL(/\/editor/);
});

test("the wrong password cannot start the second factor", async ({ page }) => {
  // Take the editor to the state where the setup form is shown
  await loginElevated(page, "editor", SEED.editor);
  await page.goto("/account");

  const disableForm = twoFactorForm(page);
  await disableForm.getByRole("button", { name: "İki adımlı doğrulamayı kapat" }).click();
  await disableForm.getByLabel("Mevcut şifre").fill(SEED.editor.password);
  await disableForm.getByLabel("Doğrulama kodu").fill(totpCode());
  await disableForm.getByRole("button", { name: "İki adımlı doğrulamayı kapat" }).click();

  // The card swaps to the setup form: that swap is the "disabled" feedback
  await expect(twoFactorForm(page).getByRole("button", { name: "Doğrulamayı aç" })).toBeVisible();

  const pending = await readPendingSecret(page);
  const enableForm = twoFactorForm(page);
  await enableForm.getByLabel("Mevcut şifre").fill("wrong-password");
  await enableForm.getByLabel("Doğrulama kodu").fill(codeFor(pending));
  await enableForm.getByRole("button", { name: "Doğrulamayı aç" }).click();

  await expect(page.getByText("Mevcut şifreniz doğrulanamadı")).toBeVisible();
});

test("an admin who turns 2FA off is locked out of the panel until it is on again", async ({
  page,
}) => {
  // Turn it off, from a properly second-factored session
  await loginElevated(page, "admin", SEED.admin);
  await page.goto("/account");

  const disableForm = twoFactorForm(page);
  await disableForm.getByRole("button", { name: "İki adımlı doğrulamayı kapat" }).click();
  await disableForm.getByLabel("Mevcut şifre").fill(SEED.admin.password);
  await disableForm.getByLabel("Doğrulama kodu").fill(totpCode());
  await disableForm.getByRole("button", { name: "İki adımlı doğrulamayı kapat" }).click();

  // The card swaps to the setup form: that swap is the "disabled" feedback
  await expect(twoFactorForm(page).getByRole("button", { name: "Doğrulamayı aç" })).toBeVisible();

  await logout(page);

  // The password alone is no longer enough for the admin panel
  await submitLogin(page, SEED.admin);
  await page.waitForURL("**/account?twoFactor=1");
  await expect(page.getByText("İki adımlı doğrulama zorunlu")).toBeVisible();

  // The setup form carries a fresh secret; the code proves the app holds it.
  // Enabling revokes every session, so the success is the sign-out itself.
  const pending = await readPendingSecret(page);
  const enableForm = twoFactorForm(page);
  await enableForm.getByLabel("Mevcut şifre").fill(SEED.admin.password);
  await enableForm.getByLabel("Doğrulama kodu").fill(codeFor(pending));
  await enableForm.getByRole("button", { name: "Doğrulamayı aç" }).click();
  await page.waitForURL("**/login");

  // The next sign in needs the code again — this time for the secret the
  // account now holds, not the seeded one
  await submitLogin(page, SEED.admin);
  await page.waitForURL("**/login/2fa");
  await page.getByLabel("Doğrulama kodu").fill(codeFor(pending));
  await page.getByRole("button", { name: "Doğrula" }).click();
  await waitForHome(page);
  await openPanelFromHome(page, "/admin");
  await expect(page).toHaveURL(/\/admin/);
});