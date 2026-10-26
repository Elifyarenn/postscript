/**
 * §13.2 — the writer promotion rules, on the admin's user page.
 *
 * Since D-374 there is no direct "Yazar yap" button: a reader becomes a
 * writer only through the application pipeline (07-writer-application). The
 * user page shows that pipeline as "Yazarlık süreci" with the preconditions.
 *
 *  - an account under 18 has the age rule crossed out, and nothing to press
 *  - an eligible reader with no application shows every rule ticked, the
 *    contract preview, and still no button to skip the pipeline
 */
import { expect, test } from "@playwright/test";
import { loginElevated, SEED } from "./helpers";

test.describe.configure({ mode: "serial" });

/** Opens the admin user detail page for one of the seeded accounts. */
async function openUser(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/users");
  await page.getByPlaceholder("Ad veya e-posta").fill(email);
  await page.getByRole("button", { name: "Uygula" }).click();
  await page.getByRole("link", { name: /.+/ }).filter({ hasNotText: "postscript" });
  await page.getByRole("cell", { name: email }).first().waitFor();
  await page.locator("tbody tr").first().getByRole("link").click();
}

test("shows an under-eighteen reader's crossed-out age rule, with no way to promote", async ({ page }) => {
  await loginElevated(page, "admin", SEED.admin);

  await openUser(page, SEED.minor.email);

  await expect(page.getByRole("heading", { name: "Yazarlık süreci" })).toBeVisible();
  await expect(page.getByText("Yazar başvurusu yok.")).toBeVisible();
  // The age rule is crossed out in the checklist
  await expect(page.getByRole("listitem").filter({ hasText: "18 yaşını doldurmuş — sağlanmadı" })).toBeVisible();
  // There is no way to force it through: the button is not on the page at all
  await expect(page.getByRole("button", { name: "Yazar yap" })).toHaveCount(0);
});

test("shows an eligible reader's process without a direct promotion button", async ({ page }) => {
  await loginElevated(page, "admin", SEED.admin);

  await openUser(page, SEED.reader.email);

  // §9: the account shows the registration/contact details the writer entered
  await expect(page.getByText("Kayıt bilgileri")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: SEED.reader.email })).toBeVisible();

  // §9: every precondition is listed with a tick or a cross
  await expect(page.getByRole("heading", { name: "Yazarlık süreci" })).toBeVisible();
  await expect(page.getByText("sağlanmadı")).toHaveCount(0);

  // and the admin can read the filled contract before approving an application
  await expect(page.getByRole("heading", { name: "Sözleşme önizlemesi" })).toBeVisible();
  await expect(page.getByText("Ada Yazar").or(page.getByText("Kerem Okur")).first()).toBeVisible();

  // Becoming a writer goes through the application, never a single click (D-374)
  await expect(page.getByRole("button", { name: "Yazar yap" })).toHaveCount(0);
});
