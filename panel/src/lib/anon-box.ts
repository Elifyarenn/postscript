/**
 * The anonymous box rule (D-092), as a pure function.
 *
 * Everything that is about the recipient — a closed box, a block, a mute, a
 * recipient under eighteen — answers with the same sentence, so a sender can
 * never tell which one it was.
 */

export const MAX_ANON_MESSAGE_LENGTH = 500;

/** A day's worth to one person; enough for a question, too few to harass. */
export const ANON_PER_RECIPIENT_PER_DAY = 3;
export const ANON_PER_SENDER_PER_DAY = 20;

export type AnonContext = {
  senderAdult: boolean;
  recipientAdult: boolean;
  boxEnabled: boolean;
  blocked: boolean;
  muted: boolean;
  sentToRecipientToday: number;
  sentTodayTotal: number;
};

export type AnonProblem = { status: 403 | 429; message: string };

export const ANON_BOX_CLOSED = "Bu üyenin anonim kutusu mesaj almıyor.";

export function anonMessageProblem(context: AnonContext): AnonProblem | null {
  if (!context.senderAdult) {
    return { status: 403, message: "Anonim mesaj göndermek 18 yaşını doldurmuş üyelere açıktır." };
  }
  if (!context.boxEnabled || context.blocked || context.muted || !context.recipientAdult) {
    return { status: 403, message: ANON_BOX_CLOSED };
  }
  if (context.sentToRecipientToday >= ANON_PER_RECIPIENT_PER_DAY) {
    return { status: 429, message: "Bu üyeye bugün yeterince anonim mesaj gönderdiniz." };
  }
  if (context.sentTodayTotal >= ANON_PER_SENDER_PER_DAY) {
    return { status: 429, message: "Bugünkü anonim mesaj sınırınıza ulaştınız." };
  }
  return null;
}
