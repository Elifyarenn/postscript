/**
 * Where a writer stands in one issue's process, as one badge (D-261): from
 * "Yakında" through the topic's review to "Teslim edildi" or "Süre doldu".
 * Pure, so the writer panel and the admin summary say the same thing.
 */
import type { ArticleStatus, TopicProposalStatus } from "@/db/schema";
import type { PeriodState } from "@/lib/issue-periods";

export type WriterStage =
  | "period_upcoming"
  | "topic_missing"
  | "topic_submitted"
  | "topic_revision_requested"
  | "topic_accepted"
  | "topic_rejected"
  | "topic_writing"
  | "topic_delivered"
  | "period_closed";

export function writerStage(input: {
  topicState: PeriodState;
  submissionState: PeriodState;
  proposalStatus: TopicProposalStatus | null;
  articleStatus: ArticleStatus | null;
}): WriterStage {
  const { topicState, submissionState, proposalStatus, articleStatus } = input;

  if (proposalStatus === null) {
    if (topicState === "open") return "topic_missing";
    if (topicState === "upcoming" || topicState === "unset") return "period_upcoming";
    return "period_closed";
  }
  if (proposalStatus === "submitted") return "topic_submitted";
  if (proposalStatus === "revision_requested") return "topic_revision_requested";
  if (proposalStatus === "rejected") return "topic_rejected";

  // Accepted: the article decides the rest. Anything past a draft was handed in.
  if (articleStatus !== null && articleStatus !== "draft") return "topic_delivered";
  if (submissionState === "closed") return "period_closed";
  return articleStatus === "draft" ? "topic_writing" : "topic_accepted";
}

/** The sentence under the badge, for the writer. */
export const WRITER_STAGE_TEXT: Record<WriterStage, string> = {
  period_upcoming: "Konu belirleme henüz başlamadı.",
  topic_missing: "Bu sayı için konunuzu belirleyin.",
  topic_submitted: "Editör değerlendirmesi bekleniyor.",
  topic_revision_requested: "Değişiklik istendi: notu okuyup konunuzu düzenleyin ve yeniden gönderin.",
  topic_accepted: "Konu kabul edildi — yazmaya başlayabilirsin.",
  topic_rejected: "Konunuz bu sayı için kabul edilmedi.",
  topic_writing: "Yazınız taslakta; yazı kabul döneminde teslim edebilirsiniz.",
  topic_delivered: "Yazınız teslim edildi.",
  period_closed: "Bu sayının süresi doldu.",
};
