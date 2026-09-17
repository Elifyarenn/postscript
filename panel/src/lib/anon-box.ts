/**
 * The magazine's anonymous box rule (D-092, D-185), as a pure function.
 *
 * Since D-185 there is one box, the magazine's: members leave stories,
 * memories, confessions and gossip for the "Eğlence & Dedikodu" section, and
 * only the admins read them. The per-member boxes, and with them the
 * recipient-side refusals (closed box, block, mute, minor recipient), are gone.
 */
import { SENDER_BIRTH_DATE_MISSING } from "./direct-messages";

/** Room for a short story or a memory, not only a question. */
export const MAX_ANON_MESSAGE_LENGTH = 2000;

/** A day's worth from one member; plenty for gossip, too few to flood the box. */
export const ANON_PER_SENDER_PER_DAY = 5;

export type AnonContext = {
  senderAdult: boolean;
  /** No birth date on the sender's account: the age is unknown (D-182). */
  senderBirthDateMissing?: boolean;
  sentTodayTotal: number;
};

export type AnonProblem = { status: 403 | 429; message: string };

export function anonMessageProblem(context: AnonContext): AnonProblem | null {
  if (context.senderBirthDateMissing) {
    return { status: 403, message: SENDER_BIRTH_DATE_MISSING };
  }
  if (!context.senderAdult) {
    return { status: 403, message: "Anonim kutuya yazmak 18 yaşını doldurmuş üyelere açıktır." };
  }
  if (context.sentTodayTotal >= ANON_PER_SENDER_PER_DAY) {
    return { status: 429, message: "Bugün anonim kutuya yeterince yazdınız. Yarın yine bekleriz." };
  }
  return null;
}
