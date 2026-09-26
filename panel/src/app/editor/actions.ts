"use server";

/**
 * Editor panel actions.
 *
 * Each one re-checks the role before touching a service, so a hand-crafted
 * POST is refused even though the menu is hidden. The review/media actions are
 * open to every editor; the issue, announcement, approval-reminder and writer
 * application actions belong to the admin-only editor routes (D-059) and
 * demand the admin role.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addComment,
  createArticle,
  resolveComment,
  setPlagiarismStatus,
  transitionArticle,
  updateArticle,
} from "@/services/articles";
import { createIssue, reorderArticles, setIssueStatus, updateIssue } from "@/services/issues";
import { attachMediaToArticle, detachMediaFromArticle, updateMediaLicense, uploadMedia } from "@/services/media";
import {
  createAnnouncement,
  publishAnnouncement,
} from "@/services/announcements";
import { sendApprovalReminders } from "@/services/rights";
import { editorDecideApplication } from "@/services/writer-applications";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import {
  checkbox,
  listField,
  numberField,
  optionalText,
  runAction,
  text,
  type ActionState,
} from "@/lib/action";
import { badRequest } from "@/lib/errors";
import { parseTurkeyLocalDateTime } from "@/lib/utils";
import { parsePeriod } from "@/lib/issue-periods";
import { decideTopicProposal } from "@/services/topics";
import type { LicenseType } from "@/db/schema";

/* ------------------------------------------------------------------ */
/* Articles                                                            */
/* ------------------------------------------------------------------ */

export async function createArticleAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    const article = await createArticle(
      { ...user },
      {
        title: text(formData, "title"),
        summary: optionalText(formData, "summary"),
        bodyMarkdown: text(formData, "bodyMarkdown"),
        authorId: optionalText(formData, "authorId"),
        issueId: optionalText(formData, "issueId"),
        category: optionalText(formData, "category"),
        dueDate: optionalText(formData, "dueDate"),
      },
      meta,
    );

    destination = `/editor/articles/${article.id}`;
  });

  if (destination) redirect(destination);
  return result;
}

export async function updateArticleAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    const articleId = text(formData, "articleId");
    await updateArticle(
      { ...user },
      articleId,
      {
        title: text(formData, "title"),
        summary: optionalText(formData, "summary"),
        bodyMarkdown: text(formData, "bodyMarkdown"),
        authorId: optionalText(formData, "authorId"),
        issueId: optionalText(formData, "issueId"),
        category: optionalText(formData, "category"),
        dueDate: optionalText(formData, "dueDate"),
        changeNote: optionalText(formData, "changeNote"),
        changeKind: text(formData, "changeKind") === "content_change"
          ? "content_change"
          : "correction",
      },
      meta,
    );

    revalidatePath(`/editor/articles/${articleId}`);
    return { success: "Makale kaydedildi." };
  });
}

export async function transitionArticleAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    const articleId = text(formData, "articleId");
    // The target status goes to the service unparsed; it validates it (D-070)
    const target = text(formData, "status");
    const scheduledAtRaw = optionalText(formData, "scheduledAt");
    // The field has no zone; the editor means Turkey's time (D-257)
    const scheduledAt = scheduledAtRaw ? parseTurkeyLocalDateTime(scheduledAtRaw) : null;
    if (scheduledAtRaw && !scheduledAt) {
      throw badRequest("Yayın zamanı okunamadı.", { scheduledAt: ["Yayın zamanı okunamadı."] });
    }

    await transitionArticle({ ...user }, articleId, target, meta, {
      withdrawnReason: optionalText(formData, "withdrawnReason") ?? undefined,
      scheduledAt,
      note: optionalText(formData, "note") ?? undefined,
    });

    revalidatePath(`/editor/articles/${articleId}`);
    revalidatePath("/editor/articles");
    return { success: "Durum güncellendi." };
  });
}

export async function addCommentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    const articleId = text(formData, "articleId");
    await addComment({ ...user }, articleId, text(formData, "body"), meta);

    revalidatePath(`/editor/articles/${articleId}`);
    return { success: "Not eklendi." };
  });
}

export async function resolveCommentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");

    await resolveComment({ ...user }, text(formData, "commentId"));
    revalidatePath(`/editor/articles/${text(formData, "articleId")}`);
    return { success: "Not çözüldü olarak işaretlendi." };
  });
}

export async function setPlagiarismAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    const articleId = text(formData, "articleId");
    await setPlagiarismStatus(
      { ...user },
      articleId,
      text(formData, "status") as "not_run" | "clean" | "flagged",
      optionalText(formData, "note"),
      meta,
    );

    revalidatePath(`/editor/articles/${articleId}`);
    return { success: "İntihal durumu güncellendi." };
  });
}

/* ------------------------------------------------------------------ */
/* Issues                                                              */
/* ------------------------------------------------------------------ */

/**
 * The two windows from the issue form, typed in Turkey's time (D-261). The
 * service checks them again, and so does the database.
 */
function issueWindows(formData: FormData) {
  const topic = parsePeriod(
    { opens: optionalText(formData, "topicOpensAt"), closes: optionalText(formData, "topicClosesAt") },
    "Konu belirleme",
  );
  if (!topic.ok) throw badRequest(topic.message, { topicOpensAt: [topic.message] });
  const submission = parsePeriod(
    { opens: optionalText(formData, "submissionOpensAt"), closes: optionalText(formData, "submissionClosesAt") },
    "Yazı kabulü",
  );
  if (!submission.ok) throw badRequest(submission.message, { submissionOpensAt: [submission.message] });
  return {
    topicOpensAt: topic.period.opensAt,
    topicClosesAt: topic.period.closesAt,
    submissionOpensAt: submission.period.opensAt,
    submissionClosesAt: submission.period.closesAt,
  };
}

export async function createIssueAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const number = numberField(formData, "number");
    if (number === null) throw badRequest("Sayı numarası gerekli.");

    await createIssue(
      { ...user },
      {
        number,
        title: text(formData, "title"),
        theme: optionalText(formData, "theme"),
        blurb: optionalText(formData, "blurb"),
        coverMediaId: optionalText(formData, "coverMediaId"),
        plannedPublishDate: optionalText(formData, "plannedPublishDate"),
        ...issueWindows(formData),
      },
      meta,
    );

    revalidatePath("/editor/issues");
    return { success: "Sayı oluşturuldu." };
  });
}

export async function updateIssueAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const number = numberField(formData, "number");
    if (number === null) throw badRequest("Sayı numarası gerekli.");

    await updateIssue(
      { ...user },
      text(formData, "issueId"),
      {
        number,
        title: text(formData, "title"),
        theme: optionalText(formData, "theme"),
        blurb: optionalText(formData, "blurb"),
        coverMediaId: optionalText(formData, "coverMediaId"),
        plannedPublishDate: optionalText(formData, "plannedPublishDate"),
        ...issueWindows(formData),
      },
      meta,
    );

    revalidatePath("/editor/issues");
    return { success: "Sayı güncellendi." };
  });
}

export async function setIssueStatusAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await setIssueStatus(
      { ...user },
      text(formData, "issueId"),
      text(formData, "status") as "planning" | "in_production" | "published" | "archived",
      meta,
    );

    revalidatePath("/editor/issues");
    return { success: "Sayı durumu güncellendi." };
  });
}

export async function reorderIssueArticlesAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const issueId = text(formData, "issueId");
    // The client sends the whole order as one comma separated list
    await reorderArticles({ ...user }, issueId, listField(formData, "order"), meta);

    revalidatePath("/editor/issues");
    return { success: "Sıralama kaydedildi." };
  });
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export async function uploadMediaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw badRequest("Dosya seçilmedi.");

    await uploadMedia(
      { ...user },
      {
        buffer: Buffer.from(await file.arrayBuffer()),
        fileName: file.name,
        declaredMime: file.type,
        license: {
          licenseType: text(formData, "licenseType") as LicenseType,
          licenseSource: optionalText(formData, "licenseSource"),
          altText: optionalText(formData, "altText"),
        },
      },
      meta,
    );

    revalidatePath("/editor/media");
    return { success: "Görsel yüklendi." };
  });
}

export async function updateMediaLicenseAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    await updateMediaLicense(
      { ...user },
      text(formData, "mediaId"),
      {
        // Validated by the service's schema, not trusted as a cast (D-248)
        licenseType: text(formData, "licenseType"),
        licenseSource: optionalText(formData, "licenseSource"),
        altText: optionalText(formData, "altText"),
      },
      meta,
    );

    revalidatePath("/editor/media");
    return { success: "Lisans bilgisi güncellendi." };
  });
}

export async function attachMediaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");

    const articleId = text(formData, "articleId");
    await attachMediaToArticle({ ...user }, articleId, text(formData, "mediaId"));

    revalidatePath(`/editor/articles/${articleId}`);
    return { success: "Görsel makaleye eklendi." };
  });
}

export async function detachMediaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");

    const articleId = text(formData, "articleId");
    await detachMediaFromArticle({ ...user }, articleId, text(formData, "mediaId"));

    revalidatePath(`/editor/articles/${articleId}`);
    return { success: "Görsel makaleden çıkarıldı." };
  });
}

/* ------------------------------------------------------------------ */
/* Announcements and rights                                            */
/* ------------------------------------------------------------------ */

export async function createAnnouncementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await createAnnouncement(
      { ...user },
      {
        title: text(formData, "title"),
        bodyMarkdown: text(formData, "bodyMarkdown"),
        audience: text(formData, "audience") as "writers" | "editors" | "all_staff",
        requiresAcknowledgement: checkbox(formData, "requiresAcknowledgement"),
        pinned: checkbox(formData, "pinned"),
      },
      meta,
    );

    revalidatePath("/editor/announcements");
    return { success: "Duyuru taslağı oluşturuldu." };
  });
}

export async function publishAnnouncementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await publishAnnouncement({ ...user }, text(formData, "announcementId"), meta);

    revalidatePath("/editor/announcements");
    return { success: "Duyuru yayınlandı." };
  });
}

export async function sendRemindersAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    await requireRole("admin");

    const count = await sendApprovalReminders();
    revalidatePath("/editor/approvals");
    return { success: `${count} yazara hatırlatma gönderildi.` };
  });
}

/* ------------------------------------------------------------------ */
/* Writer applications (stage one)                                     */
/* ------------------------------------------------------------------ */

export async function editorApproveApplicationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await editorDecideApplication(
      { ...user },
      text(formData, "applicationId"),
      "approve",
      optionalText(formData, "note"),
      meta,
    );

    revalidatePath("/editor/applications");
    return { success: "Başvuru onaylandı; yönetim onayına gönderildi." };
  });
}

export async function editorRejectApplicationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await editorDecideApplication(
      { ...user },
      text(formData, "applicationId"),
      "reject",
      text(formData, "note"),
      meta,
    );

    revalidatePath("/editor/applications");
    return { success: "Başvuru reddedildi." };
  });
}

/* ------------------------------------------------------------------ */
/* Topic proposals (D-261)                                             */
/* ------------------------------------------------------------------ */

export async function decideTopicAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    // The role check here is only the door; who may decide is the service's
    // `canReviewTopicProposals` (main editor or admin)
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    const decision = text(formData, "decision");
    await decideTopicProposal(
      { ...user },
      text(formData, "proposalId"),
      {
        decision,
        note: optionalText(formData, "note"),
        expectedVersion: numberField(formData, "version") ?? 0,
      },
      meta,
    );

    revalidatePath("/editor/topics");
    revalidatePath("/admin");
    return {
      success:
        decision === "accept"
          ? "Konu kabul edildi."
          : decision === "revision"
            ? "Yazardan değişiklik istendi."
            : "Konu reddedildi.",
    };
  });
}
