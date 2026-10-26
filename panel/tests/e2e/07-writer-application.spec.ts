/**
 * The writer application pipeline.
 *
 * Since the editor panel was narrowed to review and media (D-059), the
 * applications module lives on under the editor path but only for admins; both
 * review stages are admin work.
 *
 *  - a reader submits an application with a sample work from the account page
 *  - an admin approves it (stage one, /editor/applications)
 *  - the same admin approves it (stage two), which defines the contract
 *  - the applicant uploads the signed contract as a PDF, and the admin's
 *    signed contract verification makes the account a writer (D-275)
 */
import { expect, test } from "@playwright/test";
import { loginElevated, logout, SEED, submitLogin, waitForHome, waitForMail } from "./helpers";

test.describe.configure({ mode: "serial" });

const SAMPLE = {
  name: "ornek-eser.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n% ornek eser icerigi"),
};

test("a reader applies, gets reviewed twice, and becomes a writer once the signed contract is verified", async ({ page }) => {
  // 1. The reader submits the application from the account page
  await submitLogin(page, SEED.applicant);
  await waitForHome(page);
  await page.getByRole("link", { name: "Ayarlar", exact: true }).first().click();
  await page.waitForURL("**/social/settings");
  await page.getByRole("link", { name: "Hesabım" }).first().click();
  await page.waitForURL("**/account");

  await expect(page.getByRole("heading", { name: "Yazar olma başvurusu" })).toBeVisible();
  // The required questions (D-375); long-term writing makes the sample required
  await page.getByLabel(/^Uzun süreli/).check();
  await expect(page.getByLabel("Örnek yazı dosyası", { exact: true })).toHaveAttribute("required", "");
  await page.getByLabel("Bilim & Teknoloji").check();
  await page.getByLabel("Tarih & Dünya").check();
  await page.getByLabel("İletişim numarası").fill("0532 111 22 33");
  await page.getByLabel("Var", { exact: true }).check();
  await page.getByLabel("Deneyiminiz").fill("Okul gazetesinde yazdım.");
  await page.locator('input[name="sampleFile"]').setInputFiles(SAMPLE);
  await page.getByLabel("Not (isteğe bağlı)").fill("Dergide yayımlanabilecek bir örnek yazı.");
  await page.getByRole("button", { name: "Yazar Olma İsteği Gönder" }).click();

  // The card switches to the in-review state, with the applicant's file linked
  await expect(page.getByText("ve değerlendirmede")).toBeVisible();
  await expect(page.getByRole("link", { name: "Örnek eser dosyanız" })).toBeVisible();
  const submittedMail = await waitForMail(SEED.applicant.email);
  expect(submittedMail.subject).toContain("alındı");

  await logout(page);

  // 2. Stage one: an admin reviews the submitted application
  await loginElevated(page, "admin", SEED.admin);
  await page.goto("/editor/applications");
  await expect(page.getByText("Aylin Aday")).toBeVisible();
  await page.getByRole("button", { name: "Onayla" }).click();

  // The queue empties: the application moved to the admin stage
  await expect(page.getByText("İnceleme bekleyen başvuru yok.")).toBeVisible();

  // 3. Stage two: the admin approves, which defines the contract
  await page.getByRole("link", { name: "Yazar başvuruları" }).click();
  await page.waitForURL("**/admin/applications");
  await expect(page.getByText("Aylin Aday").first()).toBeVisible();
  await page.getByRole("button", { name: "Onayla ve sözleşme tanımla" }).click();

  // The queue empties and the pipeline overview marks the contract as defined
  await expect(page.getByText("Onay bekleyen başvuru yok.")).toBeVisible();
  await expect(page.getByText("Sözleşme hazır")).toBeVisible();

  // The applicant's name opens the user page, whose card shows where the pipeline stands (D-371, D-374)
  await page.getByRole("link", { name: "Aylin Aday" }).first().click();
  await page.waitForURL("**/admin/users/**");
  await expect(page.getByRole("heading", { name: "Yazarlık süreci" })).toBeVisible();
  // The answers are on the card for the reviewer
  await expect(page.getByRole("definition").filter({ hasText: "Uzun süreli" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Okul gazetesinde yazdım." })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Yönetim onayı — tamamlandı" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "İmzalı sözleşme — sırada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yazar yap" })).toHaveCount(0);
  await logout(page);

  // The applicant was invited to sign by e-mail
  const contractMail = await waitForMail(SEED.applicant.email);
  expect(contractMail.subject).toContain("sözleşmeniz hazır");

  // 4. The applicant signs the contract
  await submitLogin(page, SEED.applicant);
  await waitForHome(page);
  await page.getByRole("link", { name: "Ayarlar", exact: true }).first().click();
  await page.waitForURL("**/social/settings");
  await page.getByRole("link", { name: "Hesabım" }).first().click();
  await expect(page.getByText("Sözleşmeniz hazır")).toBeVisible();
  await page.getByRole("link", { name: "Sözleşmeyi oku ve imzala" }).click();
  await page.waitForURL("**/writer-application/contract**");

  // The applicant uploads the signed PDF; it waits for the admin
  await page.locator('input[name="file"]').setInputFiles({ ...SAMPLE, name: "imzali-sozlesme.pdf" });
  await page.getByRole("button", { name: "İmzalı PDF'i yükle" }).click();
  await expect(page.getByText("Sözleşmeniz inceleniyor")).toBeVisible();
  await logout(page);

  // 5. The admin checks the PDF and records the signed contract verification
  await loginElevated(page, "admin", SEED.admin);
  await page.goto("/admin/agreements");
  await expect(page.getByRole("heading", { name: "İmzalı sözleşme doğrulaması" })).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Doğrula" }).click();
  // The row moves to the decided ones; that is the outcome, not a passing message
  await expect(page.getByRole("row", { name: /Aylin Aday .*Onaylandı/ })).toBeVisible();
  await logout(page);

  // The verification is what makes the account a writer
  await submitLogin(page, SEED.applicant);
  // The sign-in finishes before the next address is opened
  await waitForHome(page);
  await page.goto("/writer");
  await expect(page.getByRole("heading", { name: "Merhaba, Aylin Aday" })).toBeVisible();

  // And the account page reflects the closed pipeline
  await page.goto("/account");
  await page.waitForURL("**/account");
  await expect(page.getByText("Yazar oldunuz")).toBeVisible();
});