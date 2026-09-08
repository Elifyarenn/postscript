/**
 * §13.2 — writer registration (/yazar-basvuru), e-mail verification, the
 * auto-approval to an active writer, and login.
 */
import { expect, test } from "@playwright/test";
import { linkFrom, registerWriter, submitLogin, waitForMail } from "./helpers";

const NEW_WRITER = {
  email: "yeni.yazar@example.com",
  password: "Yeni-Yazar-Sifre-2026",
  displayName: "Yeni Yazar",
  birthDate: "1994-04-12",
  area: "Sanat & Edebiyat",
};

test.describe.configure({ mode: "serial" });

test("registers as a writer, verifies the address, and gets auto-approved", async ({ page }) => {
  await registerWriter(page, NEW_WRITER);

  // Registration opens a session, but it goes no further than the gate
  await page.waitForURL("**/verify-email/pending");
  await expect(page.getByRole("heading", { name: "E-posta adresinizi doğrulayın" })).toBeVisible();
  await expect(page.getByText(NEW_WRITER.email)).toBeVisible();

  // and every other page bounces back to it
  await page.goto("/account");
  await page.waitForURL("**/verify-email/pending");

  const message = await waitForMail(NEW_WRITER.email);
  expect(message.subject).toContain("doğrulayın");

  // Following the link in the same browser verifies and auto-approves: the
  // account becomes an active writer, with no agreement lock (D-050)
  await page.goto(linkFrom(message.text));
  await page.getByRole("button", { name: "Doğrula" }).click();
  await page.waitForURL("**/writer**");

  // The auto-approval is announced by e-mail
  const approved = await waitForMail(NEW_WRITER.email);
  expect(approved.subject).toContain("yetkilendirildiniz");

  // The writer panel is open right away — no "sözleşme" lock
  await expect(page.getByRole("heading", { name: "Merhaba, Yeni Yazar" })).toBeVisible();
  await expect(page.getByText("Yazar sayfalarınız kilitli")).toHaveCount(0);

  // and the account is usable, showing the chosen area
  await page.goto("/account");
  await page.waitForURL("**/account");
  await expect(page.getByText("Sanat & Edebiyat")).toBeVisible();
  await page.getByLabel("Ad Soyad").fill("Yeni Yazar Düzeltildi");
  await page.getByRole("button", { name: "Profili kaydet" }).click();
  await expect(page.getByText("Profiliniz güncellendi")).toBeVisible();
});

test("sends an unverified account back to the gate when it signs in again", async ({
  page,
  context,
}) => {
  await context.clearCookies();

  await registerWriter(page, {
    displayName: "Doğrulanmamış Yazar",
    email: "bekleyen-yazar@example.com",
    password: "Bekleyen-Sifre-2026",
  });
  await page.waitForURL("**/verify-email/pending");

  await page.getByRole("button", { name: "Başka bir hesapla giriş yap" }).click();
  await page.waitForURL("**/login");

  // Signing in again lands on the gate rather than the account
  await submitLogin(page, {
    email: "bekleyen-yazar@example.com",
    password: "Bekleyen-Sifre-2026",
  });
  await page.waitForURL("**/verify-email/pending");

  // A second link cannot be demanded straight away
  await page.getByRole("button", { name: "Bağlantıyı tekrar gönder" }).click();
  await expect(page.getByText(/saniye bekleyin/)).toBeVisible();
});

test("refuses a password that is too common", async ({ page }) => {
  await page.goto("/yazar-basvuru");

  await page.getByLabel("Ad Soyad").fill("Zayıf Şifre");
  await page.getByLabel("Doğum Tarihi").fill("1994-04-12");
  await page.getByLabel("E-posta").fill("zayif@example.com");
  await page.getByLabel("Sanat & Edebiyat").check();
  await page.getByLabel("Şifre").fill("Password1");
  await page.getByRole("button", { name: "Yazar hesabı oluştur" }).click();

  await expect(page.getByText(/yaygın kullanılıyor/i).first()).toBeVisible();
});

test("refuses an underage writer and says why", async ({ page }) => {
  await page.goto("/yazar-basvuru");

  await page.getByLabel("Ad Soyad").fill("Genç Yazar");
  await page.getByLabel("Doğum Tarihi").fill("2012-05-05");
  await page.getByLabel("E-posta").fill("genc-yazar@example.com");
  await page.getByLabel("Sanat & Edebiyat").check();
  await page.getByLabel("Şifre").fill("Genc-Yazar-Sifre-2026");
  await page.getByRole("button", { name: "Yazar hesabı oluştur" }).click();

  await expect(page.getByText(/18 yaşını doldurmuş olmanız gerekir/).first()).toBeVisible();
});

test("gives the same answer for a wrong password as for an unknown account", async ({ page }) => {
  await submitLogin(page, { email: NEW_WRITER.email, password: "definitely-not-the-password" });
  await expect(page.getByText("E-posta veya şifre hatalı.").first()).toBeVisible();

  await submitLogin(page, { email: "nobody@example.com", password: "definitely-not-either" });
  await expect(page.getByText("E-posta veya şifre hatalı.").first()).toBeVisible();
});

test("ticks the password rules off and keeps the button shut until all three are met", async ({
  page,
}) => {
  await page.goto("/yazar-basvuru");

  await page.getByLabel("Ad Soyad").fill("Kural Denemesi");
  await page.getByLabel("Doğum Tarihi").fill("1994-04-12");
  await page.getByLabel("E-posta").fill("kural@example.com");
  await page.getByLabel("Sanat & Edebiyat").check();

  const submit = page.getByRole("button", { name: "Yazar hesabı oluştur" });
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
