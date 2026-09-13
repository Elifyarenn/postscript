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
 *  - the applicant signs the contract and the account becomes a writer
 */
import { expect, test } from "@playwright/test";
import { loginElevated, logout, SEED, submitLogin, waitForHome, waitForMail } from "./helpers";

test.describe.configure({ mode: "serial" });

const SAMPLE = {
  name: "ornek-eser.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n% ornek eser icerigi"),
};

test("a reader applies, gets reviewed twice, and becomes a writer by signing", async ({ page }) => {
  // 1. The reader submits the application from the account page
  await submitLogin(page, SEED.applicant);
  await waitForHome(page);
  await page.getByRole("link", { name: "PROFİL", exact: true }).click();
  await page.waitForURL("**/account");

  await expect(page.getByRole("heading", { name: "Yazar olma başvurusu" })).toBeVisible();
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
  await logout(page);

  // The applicant was invited to sign by e-mail
  const contractMail = await waitForMail(SEED.applicant.email);
  expect(contractMail.subject).toContain("sözleşmeniz hazır");

  // 4. The applicant signs the contract
  await submitLogin(page, SEED.applicant);
  await waitForHome(page);
  await page.getByRole("link", { name: "PROFİL", exact: true }).click();
  await expect(page.getByText("Sözleşmeniz hazır")).toBeVisible();
  await page.getByRole("link", { name: "Sözleşmeyi oku ve imzala" }).click();
  await page.waitForURL("**/writer-application/contract**");

  // The read gate: the checkbox stays shut until the end was seen
  const checkbox = page.getByRole("checkbox");
  await expect(checkbox).toBeDisabled();
  const contractBox = page.locator("div.overflow-y-auto").first();
  await contractBox.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(checkbox).toBeEnabled();
  await checkbox.check();
  await page.getByRole("button", { name: "Okudum, anladım, kabul ediyorum" }).click();

  // The signature is what makes the account a writer
  await page.waitForURL("**/writer");
  await expect(page.getByRole("heading", { name: "Merhaba, Aylin Aday" })).toBeVisible();

  // And the account page reflects the closed pipeline
  await page.goto("/account");
  await page.waitForURL("**/account");
  await expect(page.getByText("Yazar oldunuz")).toBeVisible();
});