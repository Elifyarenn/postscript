/**
 * §13.2 — the writer promotion rules.
 *
 *  - an account under 18 is refused, and the reason is shown
 *  - an eligible account is promoted, then becomes active by accepting the
 *    framework agreement
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
  // There is no way to force it through: the button is not on the page at all
  await expect(page.getByRole("button", { name: "Yazar yap" })).toHaveCount(0);
});

test("promotes an eligible reader, who then activates by accepting the agreement", async ({
  page,
}) => {
  await loginElevated(page, "admin", SEED.admin);

  await openUser(page, SEED.reader.email);
  await expect(page.getByText("Tüm ön koşullar sağlanıyor")).toBeVisible();

  await page.getByRole("button", { name: "Yazar yap" }).click();

  // The promotion form is replaced by the "already a writer" notice, and the
  // role change appears in the history: that record is what makes it legal
  await expect(page.getByText("user → writer")).toBeVisible();
  await expect(page.getByText(/zaten .writer. rolünde/)).toBeVisible();

  await logout(page);

  // The promoted account can reach the writer panel, but it is still locked
  await submitLogin(page, SEED.reader);
  await page.waitForURL("**/writer**");
  await expect(page.getByText("Yazar sayfalarınız kilitli")).toBeVisible();

  await page.goto("/writer/rights");
  await page.waitForURL("**/writer/agreement");

  // The confirm control only wakes up once the text has been read to the end
  const checkbox = page.getByRole("checkbox");
  await expect(checkbox).toBeDisabled();

  await page.locator("div.prose-panel").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(checkbox).toBeEnabled();

  await checkbox.check();
  await page.getByRole("button", { name: /kabul ediyorum/i }).click();

  await expect(page.getByText("Sözleşmeyi onayladınız")).toBeVisible();

  // Now the previously locked pages open
  await page.goto("/writer/rights");
  await expect(page).toHaveURL(/\/writer\/rights$/);
});
