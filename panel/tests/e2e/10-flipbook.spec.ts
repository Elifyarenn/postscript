/**
 * D-345 — the reader turns its pages like a book.
 *
 * An admin lays out five pages on the seeded issue and opens it in the reader:
 * two pages side by side on a wide screen, one on a phone; the buttons, the
 * keyboard, the contents and a drag from a page's corner all turn the page;
 * zooming in leaves the book for the plain view and fitting the page brings
 * it back; the page turning can be switched off.
 */
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { loginElevated, SEED } from "./helpers";

test.describe.configure({ mode: "serial" });

const PAGES = 5;
const colours = ["#6b1d2f", "#2f1015", "#dcd0c4", "#3c6e71", "#e6ddd2"];

async function pagePicture(index: number): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const buffer = await sharp({ create: { width: 600, height: 848, channels: 3, background: colours[index]! } })
    .png()
    .toBuffer();
  return { name: `sayfa-${index + 1}.png`, mimeType: "image/png", buffer };
}

const count = (page: Page) => page.locator(".reader-count");
/** The pages StPageFlip is showing now. */
const shownPages = (page: Page) => page.locator(".reader-flip .stf__item:visible");

/** Every page shown lies inside the window, drawn and not pushed out of sight. */
async function expectOnScreen(page: Page, pages: number) {
  await expect(shownPages(page)).toHaveCount(pages);
  const viewport = page.viewportSize()!;
  for (const box of await Promise.all((await shownPages(page).all()).map((item) => item.boundingBox()))) {
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  }
}

test("an admin lays out five pages on the seeded issue", async ({ page }) => {
  await loginElevated(page, "admin", SEED.admin);
  await page.goto("/editor/issues");
  await page.getByRole("link", { name: "Sayfalar" }).first().click();
  await expect(page.getByRole("heading", { name: "Sayfa görseli yükle" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(await Promise.all(colours.map((_, index) => pagePicture(index))));
  await page.getByRole("button", { name: `${PAGES} görseli yükle` }).click();
  await expect(page.getByText(`${PAGES} sayfa`, { exact: true })).toBeVisible({ timeout: 60_000 });
});

test("the admin draws an information area on the second page", async ({ page }) => {
  await loginElevated(page, "admin", SEED.admin);
  await page.goto("/editor/issues");
  await page.getByRole("link", { name: "Sayfalar" }).first().click();
  await page.getByRole("link", { name: /Etkileşim alanları/ }).nth(1).click();

  const picture = (await page.locator(".touch-none img").boundingBox())!;
  await page.mouse.move(picture.x + picture.width * 0.2, picture.y + picture.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(picture.x + picture.width * 0.6, picture.y + picture.height * 0.5, { steps: 6 });
  await page.mouse.up();

  // The editor's labels are not tied to their controls; the control is found in its field
  const field = (label: string) =>
    page.locator("div.space-y-1\\.5", { has: page.getByText(label, { exact: true }) }).locator("input, select, textarea");
  await field("Etkileşim türü").selectOption("info");
  await field("Alan adı").fill("Deneme alanı");
  await field("Kutu başlığı").fill("Deneme kutusu");
  await field("Açıklama").fill("Sayfa çevrilse de alan çalışır.");
  await page.getByRole("button", { name: "Etkileşimleri kaydet" }).click();
  await expect(page.getByText(/kaydedildi/i)).toBeVisible();
});

test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("two pages side by side, turned by the buttons, the keyboard and a drag; its areas still open", async ({ page }) => {
    await loginElevated(page, "admin", SEED.admin);
    await page.goto("/magazine/issues/1/oku");

    // The cover alone, then pairs: the same spreads the plain view had
    await expect(page.locator(".reader-flip .stf__parent")).toBeVisible();
    await expect(count(page)).toHaveText(`1 / ${PAGES}`);
    await expectOnScreen(page, 1);

    await page.getByRole("button", { name: "Sonraki sayfa" }).click();
    await expect(count(page)).toHaveText(`2–3 / ${PAGES}`);
    await expectOnScreen(page, 2);

    await page.keyboard.press("ArrowRight");
    await expect(count(page)).toHaveText(`4–5 / ${PAGES}`);
    await page.keyboard.press("ArrowLeft");
    await expect(count(page)).toHaveText(`2–3 / ${PAGES}`);

    // Taken by the bottom right corner and dragged across to the left
    const right = await page.locator(".reader-flip .stf__item.--right:visible").boundingBox();
    expect(right).not.toBeNull();
    await page.mouse.move(right!.x + right!.width - 4, right!.y + right!.height - 4);
    await page.mouse.down();
    await page.mouse.move(right!.x + right!.width / 2, right!.y + right!.height - 30, { steps: 8 });
    await page.mouse.move(right!.x - right!.width * 0.8, right!.y + right!.height - 30, { steps: 12 });
    await page.mouse.up();
    await expect(count(page)).toHaveText(`4–5 / ${PAGES}`);

    // A page's own areas still open in the book: page 2 is the left of 2–3
    await page.keyboard.press("ArrowLeft");
    await expect(count(page)).toHaveText(`2–3 / ${PAGES}`);
    await page.getByRole("button", { name: "Deneme alanı" }).click();
    await expect(page.getByRole("dialog", { name: "Deneme kutusu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(count(page)).toHaveText(`2–3 / ${PAGES}`);

    await page.keyboard.press("Home");
    await expect(count(page)).toHaveText(`1 / ${PAGES}`);
    await page.keyboard.press("End");
    await expect(count(page)).toHaveText(`4–5 / ${PAGES}`);
  });

  test("zoomed in it is the plain view, as before; fitted again it is the book", async ({ page }) => {
    await loginElevated(page, "admin", SEED.admin);
    await page.goto("/magazine/issues/1/oku");
    await expect(page.locator(".reader-flip .stf__parent")).toBeVisible();
    await page.getByRole("button", { name: "Sonraki sayfa" }).click();
    await expect(count(page)).toHaveText(`2–3 / ${PAGES}`);

    await page.getByRole("button", { name: "Yakınlaştır" }).click();
    await expect(page.locator(".reader-flip")).toHaveCount(0);
    await expect(page.locator(".reader-pages .page-image")).toHaveCount(2);
    await expect(count(page)).toHaveText(`2–3 / ${PAGES}`);

    await page.getByRole("button", { name: "Sayfaya sığdır" }).click();
    await expect(page.locator(".reader-flip .stf__parent")).toBeVisible();
    await expect(count(page)).toHaveText(`2–3 / ${PAGES}`);
    await expectOnScreen(page, 2);
  });

  test("the page turning can be switched off, and one page at a time is still one page", async ({ page }) => {
    await loginElevated(page, "admin", SEED.admin);
    await page.goto("/magazine/issues/1/oku");
    await expect(page.locator(".reader-flip .stf__parent")).toBeVisible();

    await page.getByRole("button", { name: "Tek sayfa görünümü" }).click();
    await expectOnScreen(page, 1);
    await page.getByRole("button", { name: "Sonraki sayfa" }).click();
    await expect(count(page)).toHaveText(`2 / ${PAGES}`);

    await page.getByRole("button", { name: "Sayfa çevirmeyi kapat" }).click();
    await expect(page.locator(".reader-flip")).toHaveCount(0);
    await expect(page.locator(".reader-pages .page-image")).toHaveCount(1);
    await expect(count(page)).toHaveText(`2 / ${PAGES}`);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("one page at a time, turned by the buttons", async ({ page }) => {
    await loginElevated(page, "admin", SEED.admin);
    await page.goto("/magazine/issues/1/oku");
    await expect(page.locator(".reader-flip .stf__parent")).toBeVisible();
    await expectOnScreen(page, 1);

    await page.getByRole("button", { name: "Sonraki sayfa" }).click();
    await expect(count(page)).toHaveText(`2 / ${PAGES}`);
    await expectOnScreen(page, 1);
  });
});

test("a reader who asked for less motion gets the plain view", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await loginElevated(page, "admin", SEED.admin);
  await page.goto("/magazine/issues/1/oku");
  await expect(page.locator(".reader-pages .page-image")).toHaveCount(1);
  await expect(page.locator(".reader-flip")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Sayfa çevirmeyi/ })).toHaveCount(0);
  await context.close();
});
