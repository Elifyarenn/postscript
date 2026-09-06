"use server";

/**
 * Editor panel actions.
 *
 * Each one re-checks the role through `requireRole("editor")` before touching a
 * service, so a hand-crafted POST is refused even though the menu is hidden.
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
import { sendGrantReminders, updateGrantFields } from "@/services/rights";
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
import type { ArticleStatus, LicenseType } from "@/db/schema";

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
        tags: listField(formData, "tags"),
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
        tags: listField(formData, "tags"),
        dueDate: optionalText(formData, "dueDate"),
        changeNote: optionalText(formData, "changeNote"),
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
    const target = text(formData, "status") as ArticleStatus;
    const scheduledAtRaw = optionalText(formData, "scheduledAt");

    await transitionArticle({ ...user }, articleId, target, meta, {
      withdrawnReason: optionalText(formData, "withdrawnReason") ?? undefined,
      scheduledAt: scheduledAtRaw ? new Date(scheduledAtRaw) : null,
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

export async function createIssueAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    const number = numberField(formData, "number");
    if (number === null) throw badRequest("Sayı numarası gerekli.");

    await createIssue(
      { ...user },
      {
        number,
        title: text(formData, "title"),
        theme: optionalText(formData, "theme"),
        coverMediaId: optionalText(formData, "coverMediaId"),
        plannedPublishDate: optionalText(formData, "plannedPublishDate"),
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
    const { user } = await requireRole("editor");
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
        coverMediaId: optionalText(formData, "coverMediaId"),
        plannedPublishDate: optionalText(formData, "plannedPublishDate"),
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
    const { user } = await requireRole("editor");
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
    const { user } = await requireRole("editor");
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
        licenseType: text(formData, "licenseType") as LicenseType,
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
    const { user } = await requireRole("editor");
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
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    await publishAnnouncement({ ...user }, text(formData, "announcementId"), meta);

    revalidatePath("/editor/announcements");
    return { success: "Duyuru yayınlandı." };
  });
}

export async function updateGrantFieldsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    const months = numberField(formData, "exclusivityMonths");

    await updateGrantFields(
      { ...user },
      text(formData, "grantId"),
      {
        grantType: text(formData, "grantType") as
          | "assignment"
          | "exclusive_license"
          | "non_exclusive_license",
        rightAdaptation: checkbox(formData, "rightAdaptation"),
        rightReproduction: checkbox(formData, "rightReproduction"),
        rightDistribution: checkbox(formData, "rightDistribution"),
        rightCommunicationToPublic: checkbox(formData, "rightCommunicationToPublic"),
        channels: formData.getAll("channels").filter((v): v is string => typeof v === "string"),
        exclusivityMonths: months,
        territory: text(formData, "territory") || "worldwide",
        commercialUseIncluded: checkbox(formData, "commercialUseIncluded"),
      },
      meta,
    );

    revalidatePath("/editor/rights");
    return { success: "Form alanları güncellendi." };
  });
}

export async function sendRemindersAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    await requireRole("editor");

    const count = await sendGrantReminders();
    revalidatePath("/editor/rights");
    return { success: `${count} yazara hatırlatma gönderildi.` };
  });
}
