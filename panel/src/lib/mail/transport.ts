/**
 * E-mail transport behind an adapter (specification §2).
 *
 * The transport only knows how to hand one message to a mail server. Services
 * do not call it: they call `sendMail` in `@/services/mail-queue`, which stores
 * the message first and delivers it through this module (D-269). Swapping SMTP
 * for Resend's API or SES means writing one more adapter here and changing
 * nothing else. Tests use the in-memory adapter and assert on what was sent.
 */
import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { MailConfigError, mailConfigProblems } from "@/lib/mail/config";

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
};

export type MailAdapter = {
  name: string;
  send(message: MailMessage): Promise<void>;
};

/* ------------------------------------------------------------------ */
/* Adapters                                                            */
/* ------------------------------------------------------------------ */

function createSmtpAdapter(): MailAdapter {
  const config = env();
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    // nodemailer waits two minutes by default; a serverless run cannot
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    ...(config.SMTP_USER
      ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? "" } }
      : {}),
  });

  return {
    name: "smtp",
    async send(message) {
      // Checked on every send, so a fixed variable takes effect with the next attempt
      const problems = mailConfigProblems({
        nodeEnv: process.env.NODE_ENV,
        mailFrom: config.MAIL_FROM,
        smtpHost: config.SMTP_HOST,
        smtpUser: config.SMTP_USER,
        smtpPassword: config.SMTP_PASSWORD,
      });
      if (problems.length > 0) throw new MailConfigError(problems);

      await transporter.sendMail({
        from: config.MAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      });
    },
  };
}

/**
 * Writes each message as a JSON file instead of sending it. Selected with
 * `MAIL_TRANSPORT=file`, which is the Docker-free development path: there is no
 * SMTP server, but verification and reset links still have to be readable.
 * The end to end tests read the same directory.
 */
export function createFileAdapter(directory: string): MailAdapter {
  return {
    name: "file",
    async send(message) {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const path = await import("node:path");

      await mkdir(directory, { recursive: true });
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;

      await writeFile(
        path.join(directory, name),
        JSON.stringify(
          {
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
            attachments: message.attachments?.map((a) => a.filename),
            sentAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        "utf8",
      );
    },
  };
}

/** Collects messages instead of sending them. Used by tests and by `NODE_ENV=test`. */
export class MemoryMailAdapter implements MailAdapter {
  readonly name = "memory";
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
  }

  clear(): void {
    this.outbox.length = 0;
  }

  /** Most recent message for an address, which is what tests usually want. */
  lastTo(address: string): MailMessage | undefined {
    return [...this.outbox].reverse().find((m) => m.to.toLowerCase() === address.toLowerCase());
  }
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

let adapter: MailAdapter | null = null;

export function setMailAdapter(next: MailAdapter): void {
  adapter = next;
}

export function getMailAdapter(): MailAdapter {
  if (!adapter) {
    if (process.env.NODE_ENV === "test") {
      adapter = new MemoryMailAdapter();
    } else if (process.env.MAIL_TRANSPORT === "file") {
      adapter = createFileAdapter(process.env.MAIL_DIR ?? ".mail");
    } else {
      adapter = createSmtpAdapter();
    }
  }
  return adapter;
}

/** Hands one message to the active adapter. Throws on failure; the queue decides what next. */
export async function deliverMail(message: MailMessage): Promise<void> {
  await getMailAdapter().send(message);
}
