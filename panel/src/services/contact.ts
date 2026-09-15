import "server-only";
import { z } from "zod";
import * as templates from "@emails/templates";
import { badRequest, rateLimited } from "@/lib/errors";
import { sendMail } from "@/lib/mail/transport";
import { consumeAttempt } from "@/lib/rate-limit";
import { assertHuman } from "@/lib/turnstile";
import { buildImprint } from "@/lib/legal";
import { getSiteSettings } from "./site-settings";
import type { RequestMeta } from "./auth";

/**
 * The contact form of the design (D-145). What a visitor types is mailed to
 * the magazine's own address and kept nowhere else: no row is written, so the
 * message lives only in the mailbox that answers it.
 *
 * The form mails a fixed address — ours — so it cannot be used to mail a
 * stranger. Turnstile and a per-IP limit are still checked, because an open
 * form is a way to flood our own inbox.
 */
export const contactSchema = z.strictObject({
  name: z.string().trim().min(2, "Adınızı yazın.").max(80),
  email: z.email("Geçerli bir e-posta adresi yazın.").max(254),
  subject: z.string().trim().max(120).optional().nullable(),
  topic: z.string().trim().max(80).optional().nullable(),
  message: z.string().trim().min(10, "Mesajınızı biraz daha yazın.").max(4000),
});

export async function sendContactMessage(
  rawInput: unknown,
  meta: RequestMeta,
  botToken?: string | null,
): Promise<void> {
  const parsed = contactSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Mesaj gönderilemedi.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;

  const limit = await consumeAttempt("contact_form_ip", meta.ip ?? "unknown");
  if (!limit.allowed) {
    throw rateLimited("Çok fazla mesaj gönderdiniz. Bir saat sonra tekrar deneyin.");
  }

  await assertHuman(botToken, meta.ip, "contact");

  const { email: inbox } = buildImprint(await getSiteSettings());
  if (!inbox) {
    throw badRequest("Şu anda mesaj alamıyoruz. Lütfen daha sonra tekrar deneyin.");
  }

  const message = templates.contactMessage({
    name: input.name,
    email: input.email,
    subject: input.subject || null,
    topic: input.topic || null,
    message: input.message,
  });
  await sendMail({ to: inbox, subject: message.subject, text: message.text });
}
