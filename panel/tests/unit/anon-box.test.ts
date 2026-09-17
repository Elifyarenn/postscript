import { describe, expect, it } from "vitest";
import {
  ANON_BOX_CLOSED,
  ANON_PER_RECIPIENT_PER_DAY,
  ANON_PER_SENDER_PER_DAY,
  anonMessageProblem,
  type AnonContext,
} from "@/lib/anon-box";

const open: AnonContext = {
  senderAdult: true,
  recipientAdult: true,
  boxEnabled: true,
  blocked: false,
  muted: false,
  sentToRecipientToday: 0,
  sentTodayTotal: 0,
};

describe("anonymous box rule (D-092)", () => {
  it("lets an adult write to an open box", () => {
    expect(anonMessageProblem(open)).toBeNull();
  });

  it("answers every recipient-side refusal with the same sentence", () => {
    for (const refusal of [
      { boxEnabled: false },
      { blocked: true },
      { muted: true },
      { recipientAdult: false },
    ]) {
      expect(anonMessageProblem({ ...open, ...refusal })).toEqual({ status: 403, message: ANON_BOX_CLOSED });
    }
  });

  it("asks a sender without a birth date for one (D-182)", () => {
    const problem = anonMessageProblem({ ...open, senderAdult: false, senderBirthDateMissing: true });
    expect(problem?.status).toBe(403);
    expect(problem?.message).toMatch(/doğum tarihi/);
  });

  it("keeps minors from sending", () => {
    expect(anonMessageProblem({ ...open, senderAdult: false })?.status).toBe(403);
  });

  it("limits a day's messages per recipient and in total", () => {
    expect(anonMessageProblem({ ...open, sentToRecipientToday: ANON_PER_RECIPIENT_PER_DAY })?.status).toBe(429);
    expect(anonMessageProblem({ ...open, sentTodayTotal: ANON_PER_SENDER_PER_DAY })?.status).toBe(429);
    expect(anonMessageProblem({ ...open, sentToRecipientToday: ANON_PER_RECIPIENT_PER_DAY - 1 })).toBeNull();
  });
});
