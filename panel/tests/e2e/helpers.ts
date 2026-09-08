/**
 * Shared steps for the end to end scenarios.
 */
import type { Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { generateSync } from "otplib";

export const MAIL_DIR = path.join(process.cwd(), ".e2e", "mail");

export const SEED = {
  admin: { email: "admin@postscriptmag.com", password: "ChangeMe!Admin2026" },
  editor: { email: "editor@postscript.local", password: "Editor!Parola2026" },
  writer: { email: "yazar@postscript.local", password: "Yazar!Parola2026" },
  reader: { email: "okur@postscript.local", password: "Okur!Parola2026" },
  minor: { email: "genc@postscript.local", password: "Genc!Parola2026" },
  applicant: { email: "aday@postscript.local", password: "Aday!Parola2026" },
};

/** The fixed second factor the e2e seed gives the staff accounts. */
const E2E_TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

/** A valid six digit code for the e2e TOTP secret, right now. */
export function totpCode(): string {
  return generateSync({ secret: E2E_TOTP_SECRET, strategy: "totp" });
}

/* ------------------------------------------------------------------ */
/* Mail                                                                */
/* ------------------------------------------------------------------ */

type Mail = { to: string; subject: string; text: string; sentAt: string };

/** Newest message sent to an address, read from the file mail adapter. */
export async function lastMailTo(address: string): Promise<Mail | null> {
  let names: string[];
  try {
    names = await readdir(MAIL_DIR);
  } catch {
    return null;
  }

  const messages: Mail[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    messages.push(JSON.parse(await readFile(path.join(MAIL_DIR, name), "utf8")) as Mail);
  }

  return (
    messages
      .filter((message) => message.to.toLowerCase() === address.toLowerCase())
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
      .at(-1) ?? null
  );
}

/** Polls until a message for the address appears, then returns it. */
export async function waitForMail(address: string, timeoutMs = 15_000): Promise<Mail> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const message = await lastMailTo(address);
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No mail arrived for ${address} within ${timeoutMs}ms`);
}

export function linkFrom(text: string): string {
  const match = /(https?:\/\/\S+)/.exec(text);
  if (!match) throw new Error("No link found in the message");
  return match[1]!;
}

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */

/**
 * Registers a new writer through the public form (/yazar-basvuru) and waits
 * for the verification gate. The birth date defaults to an adult, fixed one.
 */
export async function registerWriter(
  page: Page,
  input: {
    displayName: string;
    email: string;
    password: string;
    birthDate?: string;
    area?: string;
    phone?: string;
  },
): Promise<void> {
  await page.goto("/yazar-basvuru");
  await page.getByLabel("Ad Soyad").fill(input.displayName);
  await page.getByLabel("Doğum Tarihi").fill(input.birthDate ?? "1994-04-12");
  await page.getByLabel("E-posta").fill(input.email);
  await page.getByLabel("Telefon").fill(input.phone ?? "0532 123 45 67");
  await page.getByLabel(input.area ?? "Sanat & Edebiyat").check();
  await page.getByLabel("Şifre").fill(input.password);
  await page.getByRole("button", { name: "Yazar hesabı oluştur" }).click();
  await page.waitForURL("**/verify-email/pending");
}

/** Submits the login form. Does not assume where it lands. */
export async function submitLogin(
  page: Page,
  credentials: { email: string; password: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(credentials.email);
  await page.getByLabel("Şifre").fill(credentials.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

/**
 * Completes the second factor when the login landed on the code screen.
 * The staff accounts seeded for e2e have 2FA on with a known secret, so the
 * code is generated rather than read from a mail. Waits for the redirect so
 * the URL check cannot race the server action.
 */
export async function completeTwoFactorIfAsked(page: Page): Promise<void> {
  await page.waitForURL(/(\/login\/2fa|\/admin|\/editor|\/writer|\/magazine)/);
  if (!page.url().includes("/login/2fa")) return;
  await page.getByLabel("Doğrulama kodu").fill(totpCode());
  await page.getByRole("button", { name: "Doğrula" }).click();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Çıkış" }).click();
  await page.waitForURL("**/login");
}

/**
 * Logs in to a panel account and waits for its home. Kept as its own helper so
 * the specs read the same way they did when panel logins had a second step.
 */
export async function loginElevated(
  page: Page,
  name: "admin" | "editor",
  credentials: { email: string; password: string },
): Promise<void> {
  await submitLogin(page, credentials);
  await completeTwoFactorIfAsked(page);
  await page.waitForURL(name === "admin" ? "**/admin" : "**/editor");
}
