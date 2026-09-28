/**
 * Checks on the SMTP settings before anything is sent (D-269).
 *
 * The checks do not live in the `env()` schema on purpose: a failed schema
 * takes every page down, while a wrong sender only has to stop the mail. A job
 * refused here stays in the queue with the reason, and goes out once the
 * setting is corrected.
 */

export type MailConfigInput = {
  nodeEnv: string | undefined;
  mailFrom: string | undefined;
  smtpHost: string | undefined;
  smtpUser: string | undefined;
  smtpPassword: string | undefined;
};

/** Domains that never belong to a real mailbox; a message from them is spam or bounced. */
const RESERVED_SUFFIXES = [".local", ".localhost", ".test", ".example", ".invalid", ".internal"];

/** The address inside `Name <address>`, or the whole value when it is bare. */
export function senderAddress(mailFrom: string): string | null {
  const trimmed = mailFrom.trim();
  const bracketed = /<([^<>\s]+)>\s*$/.exec(trimmed);
  const address = bracketed ? bracketed[1]! : trimmed;
  return /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(address) ? address : null;
}

/** Whether an address belongs to a reserved, never-deliverable domain. */
export function isReservedAddress(address: string): boolean {
  const domain = address.split("@")[1]?.toLowerCase() ?? "";
  return RESERVED_SUFFIXES.some((suffix) => domain.endsWith(suffix)) || domain === "localhost";
}

/**
 * Problems that must stop real delivery. Development and tests may use any
 * sender, since their mail goes to Mailpit, a file or memory. The messages
 * name the variable, never its value, because they end up in logs.
 */
export function mailConfigProblems(input: MailConfigInput): string[] {
  if (input.nodeEnv !== "production") return [];

  const problems: string[] = [];
  const address = input.mailFrom ? senderAddress(input.mailFrom) : null;

  if (!input.mailFrom?.trim()) {
    problems.push("MAIL_FROM tanımlı değil.");
  } else if (!address) {
    problems.push("MAIL_FROM geçerli bir gönderen adresi değil.");
  } else if (isReservedAddress(address)) {
    problems.push("MAIL_FROM yerel veya ayrılmış bir alan adı kullanıyor; üretimde gönderilmez.");
  }

  const host = input.smtpHost?.trim().toLowerCase() ?? "";
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1") {
    problems.push("SMTP_HOST üretimde yerel bir sunucuyu gösteriyor.");
  }

  if (input.smtpUser && !input.smtpPassword) {
    problems.push("SMTP_USER tanımlı ama SMTP_PASSWORD boş.");
  }

  return problems;
}

/** Thrown by the SMTP adapter when the settings would send from a wrong place. */
export class MailConfigError extends Error {
  constructor(problems: string[]) {
    super(`E-posta yapılandırması hatalı: ${problems.join(" ")}`);
    this.name = "MailConfigError";
  }
}
