/**
 * A writer's place in an issue's process, as one badge (D-261).
 */
import { describe, expect, it } from "vitest";
import { writerStage } from "@/lib/topic-stage";

const base = {
  topicState: "open" as const,
  submissionState: "upcoming" as const,
  proposalStatus: null,
  articleStatus: null,
};

describe("writerStage", () => {
  it("asks for a topic while the window is open, and says when it is not yet", () => {
    expect(writerStage(base)).toBe("topic_missing");
    expect(writerStage({ ...base, topicState: "upcoming" })).toBe("period_upcoming");
    expect(writerStage({ ...base, topicState: "closed" })).toBe("period_closed");
  });

  it("follows the proposal through review", () => {
    expect(writerStage({ ...base, proposalStatus: "submitted" })).toBe("topic_submitted");
    expect(writerStage({ ...base, proposalStatus: "revision_requested" })).toBe("topic_revision_requested");
    expect(writerStage({ ...base, proposalStatus: "rejected" })).toBe("topic_rejected");
    expect(writerStage({ ...base, proposalStatus: "accepted" })).toBe("topic_accepted");
  });

  it("then follows the article: writing, handed in, or too late", () => {
    const accepted = { ...base, proposalStatus: "accepted" as const };
    expect(writerStage({ ...accepted, articleStatus: "draft" })).toBe("topic_writing");
    expect(writerStage({ ...accepted, articleStatus: "in_review" })).toBe("topic_delivered");
    expect(writerStage({ ...accepted, articleStatus: "draft", submissionState: "closed" })).toBe("period_closed");
    expect(writerStage({ ...accepted, articleStatus: "published", submissionState: "closed" })).toBe(
      "topic_delivered",
    );
  });
});
