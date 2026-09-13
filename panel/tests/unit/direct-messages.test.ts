import { describe, expect, it } from "vitest";
import { directMessageProblem, orderedPair, type DirectMessageContext } from "@/lib/direct-messages";

const open: DirectMessageContext = {
  senderAdult: true,
  recipientAdult: true,
  blocked: false,
  recipientPolicy: "everyone",
  recipientFollowsSender: false,
  recipientHasWritten: false,
};

describe("private message rule (D-091)", () => {
  it("lets adults write to someone who accepts everyone", () => {
    expect(directMessageProblem(open)).toBeNull();
  });

  it("puts a block and the age limit above every preference", () => {
    expect(directMessageProblem({ ...open, blocked: true, recipientHasWritten: true })).not.toBeNull();
    expect(directMessageProblem({ ...open, senderAdult: false })).not.toBeNull();
    expect(directMessageProblem({ ...open, recipientAdult: false, recipientHasWritten: true })).not.toBeNull();
  });

  it("does not tell the sender that the recipient is a minor", () => {
    expect(directMessageProblem({ ...open, recipientAdult: false })).not.toMatch(/18/);
  });

  it("honours 'following' unless the recipient already wrote", () => {
    const following = { ...open, recipientPolicy: "following" as const };
    expect(directMessageProblem(following)).not.toBeNull();
    expect(directMessageProblem({ ...following, recipientFollowsSender: true })).toBeNull();
    expect(directMessageProblem({ ...following, recipientHasWritten: true })).toBeNull();
  });

  it("means nobody, even for an answer", () => {
    expect(
      directMessageProblem({ ...open, recipientPolicy: "nobody", recipientHasWritten: true, recipientFollowsSender: true }),
    ).not.toBeNull();
  });

  it("orders a pair the same way whoever comes first", () => {
    const a = "0a4f5c1e-0000-4000-8000-000000000001";
    const b = "f1c2d3e4-0000-4000-8000-000000000002";
    expect(orderedPair(a, b)).toEqual([a, b]);
    expect(orderedPair(b, a)).toEqual([a, b]);
  });
});
