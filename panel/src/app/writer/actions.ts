"use server";

/**
 * Writer panel actions: acknowledging announcements, accepting the framework
 * agreement, signing or declining a rights grant, and the author's own
 * article writing (step 1 of the review chain, D-059).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acknowledge, markRead } from "@/services/announcements";
import { acceptAgreement } from "@/services/agreements";
import {
  createArticleAsWriter,
  declineWorkAndReturnForRevision,
  transitionArticle,
  updateArticleAsWriter,
} from "@/services/articles";
import { approveWork } from "@/services/rights";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { checkbox, listField, optionalText, runAction, text, type ActionState } from "@/lib/action";

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

export async function acceptAgreementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    await acceptAgreement(
      { ...user },
      {
        agreementVersionId: text(formData, "agreementVersionId"),
        renderedHash: text(formData, "renderedHash"),
        acknowledged: checkbox(formData, "acknowledged") as true,
      },
      meta,
    );

    // The whole writer panel unlocks on acceptance, so refresh the shell too
    revalidatePath("/writer", "layout");
    return { success: "Sözleşmeyi onayladınız. Yazar sayfalarınız açıldı." };
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
        subcategory: optionalText(formData, "subcategory"),
        tags: listField(formData, "tags"),
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
    await updateArticleAsWriter(
      { ...user },
      articleId,
      {
        title: text(formData, "title"),
        summary: optionalText(formData, "summary"),
        bodyMarkdown: text(formData, "bodyMarkdown"),
        slug: optionalText(formData, "slug"),
        category: optionalText(formData, "category"),
        subcategory: optionalText(formData, "subcategory"),
        tags: listField(formData, "tags"),
      },
      meta,
    );

    revalidatePath(`/writer/articles/${articleId}`);
    revalidatePath("/writer/articles");
    return { success: "Yazı kaydedildi." };
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
