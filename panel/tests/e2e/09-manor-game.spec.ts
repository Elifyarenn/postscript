/**
 * D-263 — the manor game's closed preview at /oyun.
 *
 * Who gets in is asserted on the HTTP status and on the page body, and the
 * game's server actions are replayed from an account that may not play: the
 * lock has to hold on the server, not only in the page.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  completeTwoFactorIfAsked,
  linkFrom,
  registerReader,
  SEED,
  submitLogin,
  waitForHome,
  waitForMail,
} from "./helpers";

test.describe.configure({ mode: "serial" });

const GAME_TEXT = /Büyük meşe kapı|Fırtınadan kaçarken|MERAKLISINA/;

/**
 * Presses a button on the game page. A long room continues on the page's next
 * side (D-266), so the page is turned with "Devam" until the button is on the
 * side being shown — as a reader would.
 */
async function press(page: Page, name: string | RegExp) {
  const button = page.getByRole("button", { name, exact: typeof name === "string" });
  for (let turn = 0; turn < 8; turn++) {
    const [target, box] = await Promise.all([button.boundingBox(), page.locator(".manor-fit").boundingBox()]);
    // On the side being shown when its middle is on the page (a hovered door
    // leans a few pixels out, which is not another side)
    if (target && box && Math.abs(target.x + target.width / 2 - (box.x + box.width / 2)) < box.width / 2) break;
    const next = page.getByRole("button", { name: /^Devam/ });
    if ((await next.count()) === 0 || (await next.isDisabled())) break;
    await next.click();
    // The page slides to its next side; measure once it has arrived
    await page.waitForTimeout(450);
  }
  await button.click();
}

async function loginAs(page: Page, credentials: { email: string; password: string }) {
  await submitLogin(page, credentials);
  await completeTwoFactorIfAsked(page);
  await waitForHome(page);
}

test("sends a signed-out visitor to the login screen", async ({ page }) => {
  await page.goto("/oyun");
  await page.waitForURL("**/login");
  expect(await page.content()).not.toMatch(GAME_TEXT);
});

for (const [name, credentials] of [
  ["a reader", SEED.reader],
  ["a writer", SEED.writer],
  ["an editor", SEED.editor],
] as const) {
  test(`answers 403 to ${name}`, async ({ page }) => {
    await loginAs(page, credentials);
    const response = await page.goto("/oyun");
    expect(response?.status()).toBe(403);
    await expect(page.getByText("Bu sayfaya erişim yetkiniz yok")).toBeVisible();
    expect(await page.content()).not.toMatch(GAME_TEXT);
  });
}

test("lets an admin play through, one room at a time, and refuses the same steps to a reader", async ({
  page,
  browser,
}) => {
  await loginAs(page, SEED.admin);
  const response = await page.goto("/oyun");
  expect(response?.status()).toBe(200);

  // Out of search, and the cover gives nothing of the story away
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("heading", { level: 1, name: "LANETLİ MALİKÂNEDEN ÇIKABİLECEK MİSİN?" })).toBeVisible();
  expect(await page.content()).not.toMatch(/Büyük meşe kapı|PORTRELER KORİDORU|BİTMEYEN VALS|MERAKLISINA/);

  // Entering asks the server for the first room; keep that request to replay it later
  const actionRequest = page.waitForRequest((request) => request.method() === "POST" && !!request.headers()["next-action"]);
  await press(page, "Malikâneye gir");
  const entered = await actionRequest;
  await expect(page.getByRole("heading", { level: 1, name: "GİRİŞ KAPISI" })).toBeVisible();
  // Only the room the reader stands in is in the page
  expect(await page.content()).not.toMatch(/Koridora adım attığın anda|Son basamağa çıktığında/);

  // The keyboard plays too: focus lands on the room's title, Tab reaches the doors
  await expect(page.getByRole("heading", { level: 1, name: "GİRİŞ KAPISI" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /Portrelerin arasındaki koridora ilerle/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "PORTRELER KORİDORU" })).toBeVisible();
  expect(await page.content()).not.toMatch(/Son basamağa çıktığında/);

  await press(page, /Piyano sesini takip et/);
  await expect(page.getByRole("heading", { level: 1, name: "BALO SALONU" })).toBeVisible();
  await press(page, /Piyanoya koş ve melodiyi durdur/);

  await expect(page.getByRole("heading", { level: 1, name: "BİTMEYEN VALS" })).toBeVisible();
  await expect(page.getByText("Malikâne yalnızca yeni bir müzisyen buldu.")).toBeVisible();
  await expect(page.getByText("İzlediğin yol: A · C · H")).toBeVisible();
  await expect(page.getByText("Ulaştığın sonlar: 1/5")).toBeVisible();
  // There is no way back to the previous room
  // ("Önceki yüz" turns the same page back, it does not undo a choice)
  await expect(page.getByRole("button", { name: /geri|önceki seçim/i })).toHaveCount(0);

  // The history comes only after an ending
  await press(page, "PostScript Malikânesi'nin hikâyesini oku");
  await expect(page.getByRole("heading", { level: 1, name: "POSTSCRIPT MALİKÂNESİ'NİN HİKÂYESİ" })).toBeVisible();
  await expect(page.getByText("“Hikâye henüz bitmedi.”")).toBeVisible();
  await press(page, "Sona dön");
  await expect(page.getByRole("heading", { level: 1, name: "BİTMEYEN VALS" })).toBeVisible();

  // Starting again forgets the route, keeps the tally
  await press(page, "Tekrar malikâneye gir");
  await expect(page.getByRole("heading", { level: 1, name: "LANETLİ MALİKÂNEDEN ÇIKABİLECEK MİSİN?" })).toBeVisible();
  await expect(page.getByText("Ulaştığın sonlar: 1/5")).toBeVisible();
  await press(page, "Tekrar malikâneye gir");
  await press(page, /Merdivenlerden ikinci kata çık/);
  await press(page, /Arkana bile bakmadan merdivenlerden aşağı kaç/);
  await expect(page.getByRole("heading", { level: 1, name: "KIŞ BAHÇESİ" })).toBeVisible();
  await press(page, /Gümüş anahtarı al/);
  await expect(page.getByRole("heading", { level: 1, name: "TAŞTAN MİSAFİR" })).toBeVisible();
  await expect(page.getByText("İzlediğin yol: B · F · M")).toBeVisible();
  await expect(page.getByText("Ulaştığın sonlar: 2/5")).toBeVisible();

  // The same server action, sent with a reader's session, returns no scene.
  // Replayed from the admin's session first, so a replay that is simply broken
  // cannot pass for a refusal.
  const replayFrom = (from: Page) =>
    from.evaluate(
      async ({ action, body, contentType }) => {
        const answer = await fetch("/oyun", {
          method: "POST",
          headers: { "Next-Action": action, Accept: "text/x-component", "Content-Type": contentType },
          body,
        });
        return answer.text();
      },
      {
        action: entered.headers()["next-action"]!,
        body: entered.postData() ?? "[]",
        contentType: entered.headers()["content-type"] ?? "text/plain;charset=UTF-8",
      },
    );
  expect(await replayFrom(page)).toContain("GİRİŞ KAPISI");

  const readerContext = await browser.newContext();
  const readerPage = await readerContext.newPage();
  await loginAs(readerPage, SEED.reader);
  const refused = await replayFrom(readerPage);
  expect(refused).not.toMatch(GAME_TEXT);
  expect(refused).not.toContain("GİRİŞ KAPISI");
  expect(refused).toContain("Bu işlem için yetkiniz yok.");
  await readerContext.close();
});

test("lets the listed writer in once the address is verified", async ({ page }) => {
  const writer = { email: "semrailhan@outlook.com", password: "Malikane-Onizleme-2026", displayName: "Semra İlhan" };
  await registerReader(page, writer);
  const message = await waitForMail(writer.email);
  await page.goto(linkFrom(message.text));
  await page.getByLabel("Şifre").fill(writer.password);
  await page.getByRole("button", { name: "Doğrula" }).click();
  await page.waitForURL("**/login?verified=1");

  await loginAs(page, writer);
  const response = await page.goto("/oyun");
  expect(response?.status()).toBe(200);
  await press(page, "Malikâneye gir");
  await expect(page.getByRole("heading", { level: 1, name: "GİRİŞ KAPISI" })).toBeVisible();
});

test("runs no animation for a reader who asked for reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await loginAs(page, SEED.admin);
  await page.goto("/oyun");
  await press(page, "Malikâneye gir");
  await expect(page.getByRole("heading", { level: 1, name: "GİRİŞ KAPISI" })).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await context.close();
});
