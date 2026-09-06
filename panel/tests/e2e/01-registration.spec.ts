/**
 * §13.2 — registration, e-mail verification, login.
 */
import { expect, test } from "@playwright/test";
import { linkFrom, submitLogin, waitForMail } from "./helpers";

const NEW_USER = {
  email: "yeni.okur@example.com",
  password: "yeni-okur-guclu-sifre-2026",
  displayName: "Yeni Okur",
};

test.describe.configure({ mode: "serial" });

test("registers, verifies the address, and logs in", async ({ page }) => {
  await page.goto("/register");

  await page.getByLabel("Ad Soyad").fill(NEW_USER.displayName);
  await page.getByLabel("E-posta").fill(NEW_USER.email);
  await page.getByLabel("Şifre").fill(NEW_USER.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Kayıt ol" }).click();

  // Registration signs the visitor in, but nothing beyond the profile works yet
  await page.waitForURL("**/account**");
  await expect(page.getByText("E-posta adresiniz doğrulanmadı")).toBeVisible();

  const message = await waitForMail(NEW_USER.email);
  expect(message.subject).toContain("doğrulayın");

  await page.goto(linkFrom(message.text));
  await page.getByRole("button", { name: "Doğrula" }).click();
  await expect(page.getByText("E-posta adresiniz doğrulandı")).toBeVisible();

  await page.goto("/account");
  await expect(page.getByText("E-posta adresiniz doğrulanmadı")).toHaveCount(0);
});

test("refuses a password that is too common", async ({ page }) => {
  await page.goto("/register");

  await page.getByLabel("Ad Soyad").fill("Zayıf Şifre");
  await page.getByLabel("E-posta").fill("zayif@example.com");
  await page.getByLabel("Şifre").fill("qwertyuiop");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Kayıt ol" }).click();

  await expect(page.getByText(/yaygın kullanılıyor/i).first()).toBeVisible();
});

test("gives the same answer for a wrong password as for an unknown account", async ({ page }) => {
  await submitLogin(page, { email: NEW_USER.email, password: "definitely-not-the-password" });
  await expect(page.getByText("E-posta veya şifre hatalı.").first()).toBeVisible();

  await submitLogin(page, { email: "nobody@example.com", password: "definitely-not-either" });
  await expect(page.getByText("E-posta veya şifre hatalı.").first()).toBeVisible();
});
