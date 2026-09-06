/**
 * E-mail transport behind an adapter (specification §2).
 *
 * The application only ever calls `sendMail`. Swapping SMTP for Resend or SES
 * means writing one more adapter here and changing nothing else. Tests use the
 * in-memory adapter and assert on what would have been sent.
 */
import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
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
    ...(config.SMTP_USER
      ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? "" } }
      : {}),
  });

  return {
    name: "smtp",
    async send(message) {
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
    adapter = process.env.NODE_ENV === "test" ? new MemoryMailAdapter() : createSmtpAdapter();
  }
  return adapter;
}

/**
 * Sends a message. Delivery problems are logged, never thrown: a failing mail
 * server must not roll back a promotion or a signature that already happened.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  try {
    await getMailAdapter().send(message);
  } catch (error) {
    console.error(`Mail delivery failed for subject "${message.subject}"`, error);
  }
}
