/**
 * Who may send a private message to whom (D-091), as a pure rule.
 *
 * The order of the checks matters: a block or an age limit wins over
 * everything, a recipient who said "nobody" means nobody, and only then does
 * an existing answer or a follow open the door.
 */
import type { DmPolicy } from "@/db/schema";

export const DM_POLICIES = ["everyone", "following", "nobody"] as const satisfies readonly DmPolicy[];

export const DM_POLICY_LABELS: Record<DmPolicy, string> = {
  everyone: "Tüm üyeler",
  following: "Yalnızca takip ettiğim üyeler",
  nobody: "Kimse",
};

export type DirectMessageContext = {
  senderAdult: boolean;
  recipientAdult: boolean;
  blocked: boolean;
  recipientPolicy: DmPolicy;
  recipientFollowsSender: boolean;
  /** The recipient already wrote in this conversation, so an answer is expected. */
  recipientHasWritten: boolean;
};

/** Null when the message may go; otherwise the reason, worded for the sender. */
export function directMessageProblem(context: DirectMessageContext): string | null {
  if (context.blocked) return "Bu hesapla mesajlaşılamıyor.";
  if (!context.senderAdult) return "Özel mesajlaşma 18 yaşını doldurmuş üyelere açıktır.";
  // Worded without the reason: the sender must not learn the recipient is a minor
  if (!context.recipientAdult) return "Bu üyeye özel mesaj gönderilemiyor.";
  if (context.recipientPolicy === "nobody") return "Bu üye özel mesaj almıyor.";
  if (context.recipientHasWritten) return null;
  if (context.recipientPolicy === "following" && !context.recipientFollowsSender) {
    return "Bu üye yalnızca takip ettiği üyelerden mesaj alıyor.";
  }
  return null;
}

/** The stored order of a pair; canonical lowercase uuids sort like PostgreSQL's uuid type. */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
