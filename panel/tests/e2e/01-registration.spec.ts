/**
 * §13.2 — reader registration (/register), e-mail verification, and login.
 *
 * The only public sign-up is the reader path: every new account gets the plain
 * `user` role, and verification never promotes anyone — writer and editor
 * roles come from the admin panel only (D-064).
 */
import { expect, test } from "@playwright/test";
import { linkFrom, registerReader, submitLogin, waitForMail } from "./helpers";

const NEW_READER = {
  email: "yeni.okur@example.com",
  password: "Yeni-Okur-Sifre-2026",
  displayName: "Yeni Okur",
};

test.describe.configure({ mode: "serial" });

test("registers as a reader, verifies the address, and stays a reader", async ({ page }) => {
  await registerReader(page, NEW_READER);

  // Registration opens a session, but it goes no further than the gate
  await page.waitForURL("**/verify-email/pending");
  await expect(page.getByRole("heading", { name: "E-posta adresinizi doğrulayın" })).toBeVisible();
  await expect(page.getByText(NEW_READER.email)).toBeVisible();

  // and every other page bounces back to it
  await page.goto("/account");
  await page.waitForURL("**/verify-email/pending");

  const message = await waitForMail(NEW_READER.email);
  expect(message.subject).toContain("doğrulayın");

  // Following the link in the same browser verifies and lands on the reader home
  await page.goto(linkFrom(message.text));
  await page.getByRole("button", { name: "Doğrula" }).click();
  await page.waitForURL("**/magazine**");

  // The account is a plain reader, not a writer
  await expect(page.getByText("Kullanıcı")).toBeVisible();

  // The top-right profile button leads to the account page
  await page.getByRole("link", { name: NEW_READER.displayName }).click();
  await page.waitForURL("**/account");

  // The birth date given at registration is stored and locked for the user
  await expect(page.getByLabel("Doğum tarihi")).toHaveValue("1995-05-20");
  await expect(page.getByLabel("Doğum tarihi")).toBeDisabled();

  await page.getByLabel("Ad Soyad").fill("Yeni Okur Düzeltildi");
  await page.getByRole("button", { name: "Profili kaydet" }).click();
  await expect(page.getByText("Profiliniz güncellendi")).toBeVisible();
});

test("sends an unverified account back to the gate when it signs in again", async ({
  page,
  context,
}) => {
  await context.clearCookies();

  await registerReader(page, {
    displayName: "Doğrulanmamış Okur",
    email: "bekleyen-okur@example.com",
    password: "Bekleyen-Sifre-2026",
  });
  await page.waitForURL("**/verify-email/pending");

  await page.getByRole("button", { name: "Başka bir hesapla giriş yap" }).click();
  await page.waitForURL("**/login");

  // Signing in again lands on the gate rather than the account
  await submitLogin(page, {
    email: "bekleyen-okur@example.com",
    password: "Bekleyen-Sifre-2026",
  });
  await page.waitForURL("**/verify-email/pending");

  // A second link cannot be demanded straight away
  await page.getByRole("button", { name: "Bağlantıyı tekrar gönder" }).click();
  await expect(page.getByText(/saniye bekleyin/)).toBeVisible();
});

test("refuses a password that is too common", async ({ page }) => {
  await page.goto("/register");

  await page.getByLabel("Ad Soyad").fill("Zayıf Şifre");
  await page.getByLabel("E-posta").fill("zayif@example.com");
  await page.getByLabel("Doğum tarihi").fill("1995-05-20");
  await page.locator('input[name="kvkkConsent"]').check();
  await page.getByLabel("Şifre").fill("Password1");
  await page.getByRole("button", { name: "Okuyucu hesabı oluştur" }).click();

  await expect(page.getByText(/yaygın kullanılıyor/i).first()).toBeVisible();
});

test("gives the same answer for a wrong password as for an unknown account", async ({ page }) => {
  await submitLogin(page, { email: NEW_READER.email, password: "definitely-not-the-password" });
  await expect(page.getByText("E-posta veya şifre hatalı.").first()).toBeVisible();

  await submitLogin(page, { email: "nobody@example.com", password: "definitely-not-either" });
  await expect(page.getByText("E-posta veya şifre hatalı.").first()).toBeVisible();
});

test("ticks the password rules off and keeps the button shut until all three are met", async ({
  page,
}) => {
  await page.goto("/register");

  await page.getByLabel("Ad Soyad").fill("Kural Denemesi");
  await page.getByLabel("E-posta").fill("kural@example.com");
  await page.getByLabel("Doğum tarihi").fill("1995-05-20");
  await page.locator('input[name="kvkkConsent"]').check();

  const submit = page.getByRole("button", { name: "Okuyucu hesabı oluştur" });
  const password = page.getByLabel("Şifre");
  const rules = page.locator("#password-rules li");

  await expect(rules).toHaveCount(3);
  await expect(submit).toBeDisabled();

  // Long enough, but a single case and no digit
  await password.fill("sadecekucuk");
  await expect(rules.nth(0)).toHaveText(/En az 8 karakter/);
  await expect(rules.nth(1)).toHaveText(/sağlanmadı/);
  await expect(rules.nth(2)).toHaveText(/sağlanmadı/);
  await expect(submit).toBeDisabled();

  // Both cases now, still no digit
  await password.fill("SadeceKucuk");
  await expect(rules.nth(1)).toHaveText(/sağlandı/);
  await expect(rules.nth(2)).toHaveText(/sağlanmadı/);
  await expect(submit).toBeDisabled();

  // All three
  await password.fill("SadeceKucuk1");
  for (const index of [0, 1, 2]) {
    await expect(rules.nth(index)).toHaveText(/sağlandı/);
  }
  await expect(submit).toBeEnabled();

  await submit.click();
  await page.waitForURL("**/verify-email/pending");
});