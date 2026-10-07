"use server";

/**
 * Writer panel actions: acknowledging announcements, uploading the signed
 * contract (D-275), signing or declining a rights grant, and the author's own
 * article writing (step 1 of the review chain, D-059).
 */
import { countWords, formatWordCount } from "@/lib/word-count";
import { ARTICLE_WORD_WARNING } from "@/lib/category-budget";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acknowledge, markRead } from "@/services/announcements";
import { uploadSignedContract } from "@/services/signed-contracts";
import {
  createArticleAsWriter,
  declineWorkAndReturnForRevision,
  transitionArticle,
  updateArticleAsWriter,
} from "@/services/articles";
import { approveWork, confirmUncoveredSubmissions } from "@/services/rights";
import { requestMetadata, requireAuth, requireRole } from "@/lib/auth/session";
import { badRequest } from "@/lib/errors";
import { assertCsrfFromForm } from "@/lib/csrf";
import { checkbox, numberField, optionalText, runAction, text, type ActionState } from "@/lib/action";
import { reviseTopicProposal, submitTopicProposal } from "@/services/topics";

export async function acknowledgeAnnouncementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    await acknowledge({ ...user }, text(formData, "announcementId"), meta);
    revalidatePath("/writer", "layout");
    return { success: "Duyuru onaylandı." };
  });
}

export async function markAnnouncementReadAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");

    await markRead({ ...user }, text(formData, "announcementId"));
    revalidatePath("/writer/announcements");
    return { success: "Okundu olarak işaretlendi." };
  });
}

/**
 * The signed contract, as a PDF (D-275). Used by team members from their
 * panel and by an approved applicant, so the session is enough here; the
 * service decides who may upload.
 */
export async function uploadSignedContractAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw badRequest("Dosya seçilmedi.");

    // Which prepared document this is the signed copy of, if any (D-289)
    const documentId = String(formData.get("documentId") ?? "").trim() || null;
    await uploadSignedContract(
      { ...user },
      { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, declaredMime: file.type, documentId },
      await requestMetadata(),
    );

    revalidatePath("/writer", "layout");
    revalidatePath("/writer-application/contract");
    revalidatePath("/cizer");
    revalidatePath("/account");
    return { success: "Sözleşmeniz yüklendi. Yönetici doğruladığında burada göreceksiniz." };
  });
}

export async function approveWorkAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    await approveWork(
      { ...user },
      {
        grantId: text(formData, "grantId"),
        articleHash: text(formData, "articleHash"),
        bylineChoice: text(formData, "bylineChoice") as "real_name" | "pen_name",
        acknowledged: checkbox(formData, "acknowledged") as true,
      },
      meta,
    );

    revalidatePath("/writer/approvals");
    return { success: "Eser Onayı kaydedildi. Kaydın PDF kopyası e-posta ile gönderildi." };
  });
}

export async function declineWorkAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    await declineWorkAndReturnForRevision(
      { ...user },
      { grantId: text(formData, "grantId"), reason: text(formData, "reason") },
      meta,
    );

    revalidatePath("/writer/approvals");
    return { success: "Onayı reddettiniz, editöre bildirildi." };
  });
}

/* ------------------------------------------------------------------ */
/* The author's own articles (step 1 of the review chain, D-059)      */
/* ------------------------------------------------------------------ */

/** "topic:<id>" or "issue:<id>"; anything else reaches the service as nothing chosen. */
function articleTarget(raw: string | null): { topicProposalId?: string; issueId?: string } {
  const [kind, id] = (raw ?? "").split(":");
  if (kind === "topic" && id) return { topicProposalId: id };
  if (kind === "issue" && id) return { issueId: id };
  return {};
}

export async function createArticleAsWriterAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    const article = await createArticleAsWriter(
      { ...user },
      {
        title: text(formData, "title"),
        summary: optionalText(formData, "summary"),
        bodyMarkdown: text(formData, "bodyMarkdown"),
        slug: optionalText(formData, "slug"),
        category: optionalText(formData, "category"),
        // An accepted topic, or an issue without windows (D-261), from one select
        ...articleTarget(optionalText(formData, "target")),
      },
      meta,
    );

    destination = `/writer/articles/${article.id}`;
  });

  if (destination) redirect(destination);
  return result;
}

export async function updateArticleAsWriterAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    const articleId = text(formData, "articleId");
    const saved = await updateArticleAsWriter(
      { ...user },
      articleId,
      {
        title: text(formData, "title"),
        summary: optionalText(formData, "summary"),
        bodyMarkdown: text(formData, "bodyMarkdown"),
        slug: optionalText(formData, "slug"),
        category: optionalText(formData, "category"),
        changeNote: optionalText(formData, "changeNote"),
      },
      meta,
    );

    revalidatePath(`/writer/articles/${articleId}`);
    revalidatePath("/writer/articles");
    // Over 500 words is a warning, never a refusal (D-331)
    const words = countWords(saved.bodyMarkdown);
    return {
      success:
        words > ARTICLE_WORD_WARNING
          ? `Yazı kaydedildi. Uyarı: yazı ${formatWordCount(words)}, önerilen üst sınır ${ARTICLE_WORD_WARNING} kelime.`
          : "Yazı kaydedildi.",
    };
  });
}

/**
 * Confirms, in one deliberate step, the works that were already submitted
 * before the writer accepted the contract (D-238). Accepting the contract does
 * not cover them on its own.
 */
export async function confirmUncoveredSubmissionsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    const count = await confirmUncoveredSubmissions({ ...user }, meta);

    revalidatePath("/writer/agreement");
    revalidatePath("/writer/articles");
    return {
      success:
        count === 0
          ? "Teyit bekleyen yazı kalmadı."
          : `${count} yazı için yayın izni beyanı kaydedildi.`,
    };
  });
}

/** Sends the author's draft to the review chain: `draft → in_review` (D-059). */
export async function submitArticleAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    const articleId = text(formData, "articleId");
    await transitionArticle({ ...user }, articleId, "in_review", meta, {});

    revalidatePath(`/writer/articles/${articleId}`);
    revalidatePath("/writer/articles");
    return { success: "Yazı incelemeye gönderildi. Kategori editörünüz onaylayana dek bekleyecek." };
  });
}

/* ------------------------------------------------------------------ */
/* Topic proposals (D-261)                                             */
/* ------------------------------------------------------------------ */

function topicFields(formData: FormData) {
  return {
    title: text(formData, "title"),
    description: text(formData, "description"),
    category: optionalText(formData, "category"),
  };
}

export async function submitTopicAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    await submitTopicProposal({ ...user }, text(formData, "issueId"), topicFields(formData), meta);

    revalidatePath("/writer/topics");
    revalidatePath("/writer");
    return { success: "Konunuz gönderildi; editör değerlendirmesi bekleniyor." };
  });
}

export async function reviseTopicAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    await reviseTopicProposal(
      { ...user },
      text(formData, "proposalId"),
      topicFields(formData),
      numberField(formData, "version") ?? 0,
      meta,
    );

    revalidatePath("/writer/topics");
    revalidatePath("/writer");
    return { success: "Konunuz yeniden gönderildi; editör değerlendirmesi bekleniyor." };
  });
}
