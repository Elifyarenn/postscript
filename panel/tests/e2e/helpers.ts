/**
 * Shared steps for the end to end scenarios.
 */
import { expect, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const MAIL_DIR = path.join(process.cwd(), ".e2e", "mail");

export const SEED = {
  admin: { email: "admin@postscript.local", password: "ChangeMe!Admin2026" },
  editor: { email: "editor@postscript.local", password: "Editor!Parola2026" },
  writer: { email: "yazar@postscript.local", password: "Yazar!Parola2026" },
  reader: { email: "okur@postscript.local", password: "Okur!Parola2026" },
  minor: { email: "genc@postscript.local", password: "Genc!Parola2026" },
};

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
 * Logs in an account that has no second factor yet and completes the mandatory
 * TOTP enrolment, reading the secret the setup page prints and generating a
 * real code from it.
 */
export async function loginWithTotpSetup(
  page: Page,
  credentials: { email: string; password: string },
): Promise<string> {
  await submitLogin(page, credentials);
  await page.waitForURL("**/two-factor/setup");

  const secret = (await page.locator("code").first().innerText()).trim();
  await enterTotpCode(page, secret, "Doğrula ve aç");

  // The recovery codes are shown once, right after enrolment, and the way
  // onwards only opens after confirming they were kept
  await expect(page.getByText("Kurtarma kodları", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Panele devam et" })).toBeDisabled();

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Panele devam et" }).click();

  return secret;
}

/** Logs in an account that already has a confirmed second factor. */
export async function loginWithTotp(
  page: Page,
  credentials: { email: string; password: string },
  secret: string,
): Promise<void> {
  await submitLogin(page, credentials);
  await page.waitForURL("**/two-factor");
  await enterTotpCode(page, secret, "Doğrula");
}

async function enterTotpCode(page: Page, secret: string, buttonName: string): Promise<void> {
  const totp = new OTPAuth.TOTP({
    issuer: "postscript",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  await page.getByLabel(/kod/i).first().fill(totp.generate());
  await page.getByRole("button", { name: buttonName }).click();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Çıkış" }).click();
  await page.waitForURL("**/login");
}

/* ------------------------------------------------------------------ */
/* Secrets shared between spec files                                   */
/* ------------------------------------------------------------------ */

const SECRETS_FILE = path.join(process.cwd(), ".e2e", "secrets.json");

/**
 * TOTP enrolment happens once per account, but several spec files need to log
 * in as that account afterwards. The secret is kept in the run's data
 * directory, which is wiped before every run.
 */
export async function saveSecret(name: string, secret: string): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(path.dirname(SECRETS_FILE), { recursive: true });

  const existing = await loadSecrets();
  existing[name] = secret;
  await writeFile(SECRETS_FILE, JSON.stringify(existing, null, 2), "utf8");
}

async function loadSecrets(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(SECRETS_FILE, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function loadSecret(name: string): Promise<string | null> {
  return (await loadSecrets())[name] ?? null;
}

/**
 * Logs in as an account with mandatory two factor authentication, enrolling on
 * the first call and reusing the stored secret afterwards.
 */
export async function loginElevated(
  page: Page,
  name: "admin" | "editor",
  credentials: { email: string; password: string },
): Promise<void> {
  const stored = await loadSecret(name);

  if (stored) {
    await loginWithTotp(page, credentials, stored);
    return;
  }

  // Enrolment ends by following the "continue" button to the role's home
  const secret = await loginWithTotpSetup(page, credentials);
  await saveSecret(name, secret);
  await page.waitForURL(name === "admin" ? "**/admin" : "**/editor");
}
