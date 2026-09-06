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
  // The age rule is crossed out in the checklist as well
  await expect(page.getByText("18 yaşını doldurmuş")).toBeVisible();
  // There is no way to force it through: the button is not on the page at all
  await expect(page.getByRole("button", { name: "Yazar yap" })).toHaveCount(0);
});

test("promotes an eligible reader, who then activates by accepting the agreement", async ({
  page,
}) => {
  await loginElevated(page, "admin", SEED.admin);

  await openUser(page, SEED.reader.email);

  // §9: every precondition is listed with a tick or a cross
  await expect(page.getByText("Sözleşme bu kullanıcı için render ediliyor")).toBeVisible();
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

  // The promoted account can reach the writer panel, but it is still locked
  await submitLogin(page, SEED.reader);
  await page.waitForURL("**/writer**");
  await expect(page.getByText("Yazar sayfalarınız kilitli")).toBeVisible();

  // §7.2: the approvals screen is reachable but locked, with the reason shown
  await page.goto("/writer/approvals");
  await expect(page.getByText("Onay veremezsiniz")).toBeVisible();

  await page.getByRole("link", { name: "Sözleşmeye git" }).click();
  await page.waitForURL("**/writer/agreement");

  // The confirm control only wakes up once the text has been read to the end
  const checkbox = page.getByRole("checkbox");
  await expect(checkbox).toBeDisabled();

  // The gate watches the last paragraph with an IntersectionObserver, so the
  // scroll container is the outer box rather than the prose itself
  await page.locator("div.overflow-y-auto").first().evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(checkbox).toBeEnabled();

  await checkbox.check();
  await page.getByRole("button", { name: /kabul ediyorum/i }).click();

  // The acceptance form is replaced by the accepted view; that swap is the
  // outcome, and the record it leaves behind is what matters
  await expect(page.getByText("Bu sürümü onayladınız")).toBeVisible();
  await expect(page.getByRole("link", { name: "İndir" }).first()).toBeVisible();

  // Now the previously locked screen opens, with no reason banner on it
  await page.goto("/writer/approvals");
  await expect(page).toHaveURL(/\/writer\/approvals$/);
  await expect(page.getByText("Onay veremezsiniz")).toHaveCount(0);
});
