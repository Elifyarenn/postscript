/**
 * §13.2 — the writer promotion rules.
 *
 *  - an account under 18 is refused, and the reason is shown
 *  - an eligible account is promoted to an active writer, and can use the
 *    writer panel right away (no agreement lock, D-050)
 */
import { expect, test } from "@playwright/test";
import { loginElevated, logout, SEED, submitLogin } from "./helpers";

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

test("refuses to promote someone under eighteen, and says why", async ({ page }) => {
  await loginElevated(page, "admin", SEED.admin);

  await openUser(page, SEED.minor.email);

  await expect(page.getByText("Ön koşullar sağlanmıyor")).toBeVisible();
  await expect(page.getByText("Kullanıcı 18 yaşından küçük.")).toBeVisible();
  // The age rule is crossed out in the checklist as well
  await expect(page.getByText("18 yaşını doldurmuş")).toBeVisible();
  // There is no way to force it through: the button is not on the page at all
  await expect(page.getByRole("button", { name: "Yazar yap" })).toHaveCount(0);
});

test("promotes an eligible reader, who can use the panel right away", async ({ page }) => {
  await loginElevated(page, "admin", SEED.admin);

  await openUser(page, SEED.reader.email);

  // §9: the account shows the registration/contact details the writer entered
  await expect(page.getByText("Kayıt bilgileri")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: SEED.reader.email })).toBeVisible();

  // §9: every precondition is listed with a tick or a cross
  await expect(page.getByText("sağlanmadı")).toHaveCount(0);

  // and the admin can read the filled contract before promoting
  await expect(page.getByRole("heading", { name: "Sözleşme önizlemesi" })).toBeVisible();
  await expect(page.getByText("Ada Yazar").or(page.getByText("Kerem Okur")).first()).toBeVisible();

  await page.getByRole("button", { name: "Yazar yap" }).click();

  // The promotion form is replaced by the "already a writer" notice, and the
  // role change appears in the history: that record is what makes it legal
  await expect(page.getByText("user → writer")).toBeVisible();
  await expect(page.getByText(/zaten .writer. rolünde/)).toBeVisible();

  await logout(page);

  // The promoted account reaches the writer panel, already active — there is
  // no contract lock to clear (D-050)
  await submitLogin(page, SEED.reader);
  await page.waitForURL("**/writer**");
  await expect(page.getByRole("heading", { name: "Merhaba, Kerem Okur" })).toBeVisible();
  await expect(page.getByText("Yazar sayfalarınız kilitli")).toHaveCount(0);

  // §7.2: the approvals screen is reachable and unlocked
  await page.goto("/writer/approvals");
  await expect(page).toHaveURL(/\/writer\/approvals$/);
});
