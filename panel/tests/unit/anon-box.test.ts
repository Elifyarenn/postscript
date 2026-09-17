import { describe, expect, it } from "vitest";
import { ANON_PER_SENDER_PER_DAY, anonMessageProblem, type AnonContext } from "@/lib/anon-box";

const open: AnonContext = {
  senderAdult: true,
  sentTodayTotal: 0,
};

describe("the magazine's anonymous box rule (D-092, D-185)", () => {
  it("lets an adult member write", () => {
    expect(anonMessageProblem(open)).toBeNull();
  });

  it("asks a sender without a birth date for one (D-182)", () => {
    const problem = anonMessageProblem({ ...open, senderAdult: false, senderBirthDateMissing: true });
    expect(problem?.status).toBe(403);
    expect(problem?.message).toMatch(/doğum tarihi/);
  });

  it("keeps minors from sending", () => {
    expect(anonMessageProblem({ ...open, senderAdult: false })?.status).toBe(403);
  });

  it("limits a day's messages from one member", () => {
    expect(anonMessageProblem({ ...open, sentTodayTotal: ANON_PER_SENDER_PER_DAY })?.status).toBe(429);
    expect(anonMessageProblem({ ...open, sentTodayTotal: ANON_PER_SENDER_PER_DAY - 1 })).toBeNull();
  });
});
