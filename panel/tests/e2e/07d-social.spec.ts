/**
 * D-089…D-093, D-185 — the community area end to end: handles, a post shared
 * in a community, a follow and a like, a private message, a note left in the
 * magazine's anonymous box, and what each side sees afterwards.
 *
 * Uses the seeded reader and writer only, so it needs no second factor. Named
 * to run before 08, which re-enrols the admin's TOTP secret.
 */
import { expect, test, type Page } from "@playwright/test";
import { logout, SEED, submitLogin, waitForHome } from "./helpers";

async function signIn(page: Page, credentials: { email: string; password: string }) {
  await submitLogin(page, credentials);
  await waitForHome(page);
}

/** The settings page has one "Kaydet" per card, so each is found through its own field. */
function formWith(page: Page, label: string) {
  return page.locator("form").filter({ has: page.getByLabel(label) });
}

async function pickHandle(page: Page, username: string) {
  await page.goto("/social/settings");
  await page.getByLabel("Kullanıcı adı").fill(username);
  await formWith(page, "Kullanıcı adı").getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText(`Kullanıcı adınız @${username} olarak kaydedildi.`)).toBeVisible();
}

test("two members meet in the community area", async ({ page }) => {
  test.setTimeout(240_000);

  const firstPost = "E2E: topluluktaki ilk gönderim";
  const communityPost = "E2E: kulübe merhaba";
  const privateMessage = "E2E: merhaba Kerem";
  const anonymousMessage = "E2E: dergiye kimin yazdığını bilmeyeceksiniz";

  // --- The reader sets up: a handle and messages from everyone ---
  await signIn(page, SEED.reader);
  await pickHandle(page, "kerem_okur");

  await page.goto("/social/settings?bolum=mesajlar");
  await page.getByLabel("Bana kimler özel mesaj gönderebilir?").selectOption("everyone");
  await formWith(page, "Bana kimler özel mesaj gönderebilir?").getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Özel mesaj tercihiniz kaydedildi.")).toBeVisible();

  await page.goto("/social");
  await page.getByLabel("Ne düşünüyorsunuz?").fill(firstPost);
  await page.getByRole("button", { name: "Paylaş" }).click();
  await expect(page.getByRole("article").filter({ hasText: firstPost })).toBeVisible();

  // --- ...joins the seeded community and posts in it ---
  await page.goto("/social?sekme=topluluklar");
  await page.getByRole("button", { name: "Katıl" }).click();
  await expect(page.getByRole("button", { name: "Ayrıl" })).toBeVisible();
  await page.getByRole("link", { name: "Edebiyat Kulübü" }).click();
  await page.waitForURL("**/social/communities/edebiyat-kulubu");
  await page.getByLabel("Ne düşünüyorsunuz?").fill(communityPost);
  await page.getByRole("button", { name: "Paylaş" }).click();
  const inClub = page.getByRole("article").filter({ hasText: communityPost });
  await expect(inClub).toBeVisible();
  await expect(inClub.getByRole("link", { name: "Edebiyat Kulübü" })).toBeVisible();

  await logout(page);

  // --- The writer follows, likes, writes privately and anonymously ---
  await signIn(page, SEED.writer);
  await pickHandle(page, "ada_yazar");

  await page.goto("/social/u/kerem_okur");
  await page.getByRole("button", { name: "Takip et" }).click();
  await expect(page.getByRole("button", { name: "Takibi bırak" })).toBeVisible();

  await page.goto("/social");
  const followed = page.getByRole("article").filter({ hasText: firstPost });
  await expect(followed).toBeVisible();
  await followed.getByRole("button", { name: "Beğen (0)" }).click();
  await expect(followed.getByRole("button", { name: "Beğenildi (1)" })).toBeVisible();

  await page.goto("/social/messages/kerem_okur");
  await page.getByLabel("Mesajınız").fill(privateMessage);
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.locator("ol").getByText(privateMessage)).toBeVisible();

  // The anonymous box goes to the magazine, not to a member (D-185)
  await page.goto("/social/anon");
  await expect(page.getByText("Adınızı görmeyiz, ama anonim değilsiniz")).toBeVisible();
  await page.getByLabel("Mesajınız").fill(anonymousMessage);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Anonim olarak gönder" }).click();
  await expect(page.getByText("Mesajınız anonim olarak iletildi. Teşekkürler!")).toBeVisible();

  await logout(page);

  // --- The reader sees the rest; the anonymous note went to the admins, not here ---
  await signIn(page, SEED.reader);

  await page.goto("/social/messages");
  // The writer publishes under a pen name, which is what the list shows
  await page.getByRole("link", { name: /Ada Y\./ }).click();
  await page.waitForURL("**/social/messages/ada_yazar");
  await expect(page.locator("ol").getByText(privateMessage)).toBeVisible();

  await page.goto("/social/notifications");
  await expect(page.getByText("@ada_yazar sizi takip etmeye başladı.")).toBeVisible();
  await expect(page.getByText("@ada_yazar gönderinizi beğendi.")).toBeVisible();
});
