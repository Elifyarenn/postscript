"use server";

/**
 * Admin actions: role changes, bans, agreement versions,
 * the rights form template and the KVKK notice.
 *
 * Every one of these re-checks `requireRole("admin")`; nothing here trusts the
 * fact that the page rendered.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  changeRole,
  deleteUserAsAdmin,
  exportUserData,
  promoteToWriter,
  setBanned,
  setBirthDateAsAdmin,
  setEditorStatus,
  setIllustrator,
  setAuthorized,
  setWriterStatus,
} from "@/services/users";
import { createVersionFromTemplate, publishAgreementVersion, replaceVersionTextWithTemplate } from "@/services/agreements";
import { adminDecideApplication } from "@/services/writer-applications";
import { grantIssueSubmission, revokeIssueSubmission } from "@/services/issue-grants";
import { grantIssueArea, revokeIssueArea } from "@/services/issue-area-grants";
import {
  approveSignedContract,
  rejectSignedContract,
  uploadCountersigned,
  uploadSignedContractForMember,
  VERIFIED_MESSAGE,
} from "@/services/signed-contracts";
import {
  clearContributorDocuments,
  mailContributorDocuments,
  prepareContributorDocuments,
  queueAllContributorDocuments,
  queueUploadReminders,
} from "@/services/contributor-documents";
import { removeUnlicensedFormerWriterWorks } from "@/services/unlicensed-works";
import { createAnnouncement, publishAnnouncement } from "@/services/announcements";
import type { AnnouncementSeverity } from "@/db/schema";
import {
  addBannedWord,
  removeBannedWord,
  removeChatMessage,
  removeCommunityComment,
} from "@/services/community";
import {
  createWriterArea,
  deleteWriterArea,
  setWriterAreas,
  updateWriterArea,
} from "@/services/writer-areas";
import { setEditorDuties } from "@/services/editor-categories";
import { setHybridWriterRole } from "@/services/users";
import { saveSiteSettings, SITE_SETTING_KEYS } from "@/services/site-settings";
import { publishKvkkVersion } from "@/services/kvkk";
import { requestMetadata, requireRole, revokeAllSessions } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import {
  checkbox,
  numberField,
  optionalText,
  runAction,
  text,
  type ActionState,
} from "@/lib/action";
import { badRequest } from "@/lib/errors";

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export async function promoteToWriterAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    await promoteToWriter({ ...user }, targetId, meta, optionalText(formData, "note") ?? undefined);

    revalidatePath(`/admin/users/${targetId}`);
    revalidatePath("/admin/users");
    return { success: "Kullanıcı yazar rolüne yükseltildi." };
  });
}

export async function changeRoleAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    // The role goes to the service unparsed; `changeRole` validates it (D-070)
    await changeRole(
      { ...user },
      targetId,
      text(formData, "role"),
      meta,
      optionalText(formData, "note") ?? undefined,
    );

    revalidatePath(`/admin/users/${targetId}`);
    revalidatePath("/admin/users");
    return { success: "Rol güncellendi." };
  });
}

export async function setWriterStatusAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    await setWriterStatus(
      { ...user },
      targetId,
      text(formData, "writerStatus") as "active" | "suspended" | "pending_agreement",
      meta,
    );

    revalidatePath(`/admin/users/${targetId}`);
    return { success: "Yazar durumu güncellendi." };
  });
}

export async function setEditorStatusAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    await setEditorStatus(
      { ...user },
      targetId,
      text(formData, "editorStatus") as "active" | "suspended",
      meta,
    );

    revalidatePath(`/admin/users/${targetId}`);
    revalidatePath("/admin/users");
    return { success: "Editör durumu güncellendi." };
  });
}

export async function setIllustratorAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    await setIllustrator({ ...user }, targetId, text(formData, "illustrator") === "evet", meta);

    revalidatePath(`/admin/users/${targetId}`);
    revalidatePath("/admin/users/illustrators");
    // The about page lists the çizers by name (D-151)
    revalidatePath("/hakkinda");
    return { success: "Tasarımcı işareti güncellendi." };
  });
}

export async function setAuthorizedAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    await setAuthorized({ ...user }, targetId, text(formData, "authorized") === "evet", meta);

    revalidatePath(`/admin/users/${targetId}`);
    revalidatePath("/admin/users/yetkililer");
    return { success: "Yetkili işareti güncellendi." };
  });
}

/** Opens an issue to one writer and mails them at once (D-296). */
export async function grantIssueSubmissionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const userId = text(formData, "userId");
    await grantIssueSubmission({ ...user }, { issueId: text(formData, "issueId"), userId }, await requestMetadata());
    revalidatePath(`/admin/users/${userId}`);
    return { success: "Yazı gönderme izni verildi; yazara e-posta gönderildi." };
  });
}

export async function revokeIssueSubmissionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    await revokeIssueSubmission({ ...user }, text(formData, "grantId"), await requestMetadata());
    revalidatePath(`/admin/users/${text(formData, "userId")}`);
    return { success: "Yazı gönderme izni geri alındı." };
  });
}

/** Gives a writer an area for one issue only and mails them at once (D-306). */
export async function grantIssueAreaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const userId = text(formData, "userId");
    await grantIssueArea(
      { ...user },
      { issueId: text(formData, "issueId"), userId, areaId: text(formData, "areaId") },
      await requestMetadata(),
    );
    revalidatePath(`/admin/users/${userId}`);
    return { success: "Geçici alan verildi; yazara e-posta gönderildi." };
  });
}

export async function revokeIssueAreaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    await revokeIssueArea({ ...user }, text(formData, "grantId"), await requestMetadata());
    revalidatePath(`/admin/users/${text(formData, "userId")}`);
    return { success: "Geçici alan geri alındı." };
  });
}

export async function setBannedAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    await setBanned(
      { ...user },
      targetId,
      checkbox(formData, "banned"),
      optionalText(formData, "reason"),
      meta,
    );

    revalidatePath(`/admin/users/${targetId}`);
    revalidatePath("/admin/users");
    return { success: "Kullanıcı durumu güncellendi." };
  });
}

export async function setBirthDateAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    await setBirthDateAsAdmin({ ...user }, targetId, text(formData, "birthDate"), meta);

    revalidatePath(`/admin/users/${targetId}`);
    return { success: "Doğum tarihi güncellendi." };
  });
}

export async function revokeUserSessionsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    await requireRole("admin");

    await revokeAllSessions(text(formData, "userId"));
    return { success: "Kullanıcının tüm oturumları kapatıldı." };
  });
}

/**
 * Admin-only hard deletion. The account is anonymised and soft deleted (the
 * self-service path's legal treatment), the reason goes to the audit trail.
 * The deleted user's own page no longer exists, so the admin is sent back to
 * the list instead of re-rendering a 404 in place.
 */
export async function deleteUserAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    if (!checkbox(formData, "confirm")) {
      throw badRequest("Silme onayını işaretlemelisiniz.");
    }
    await deleteUserAsAdmin({ ...user }, targetId, text(formData, "reason"), meta);
    destination = "/admin/users?deleted=1";
  });

  if (destination) redirect(destination);
  return result;
}

/* ------------------------------------------------------------------ */
/* Writer applications (stage two)                                     */
/* ------------------------------------------------------------------ */

export async function adminApproveApplicationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await adminDecideApplication(
      { ...user },
      text(formData, "applicationId"),
      "approve",
      optionalText(formData, "note"),
      meta,
    );

    revalidatePath("/admin/applications");
    return {
      success:
        "Başvuru onaylandı. Yazar sözleşmesi tanımlandı; başvuru sahibi imzaya davet edildi.",
    };
  });
}

export async function adminRejectApplicationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await adminDecideApplication(
      { ...user },
      text(formData, "applicationId"),
      "reject",
      text(formData, "note"),
      meta,
    );

    revalidatePath("/admin/applications");
    return { success: "Başvuru reddedildi." };
  });
}

/* ------------------------------------------------------------------ */
/* Community moderation                                                */
/* ------------------------------------------------------------------ */

export async function removeCommentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await removeCommunityComment({ ...user }, text(formData, "commentId"), meta);
    revalidatePath("/admin/community", "layout");
    return { success: "Yorum kaldırıldı." };
  });
}

export async function removeChatMessageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await removeChatMessage({ ...user }, text(formData, "messageId"), meta);
    revalidatePath("/admin/community", "layout");
    return { success: "Mesaj kaldırıldı." };
  });
}

export async function addBannedWordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await addBannedWord({ ...user }, { word: text(formData, "word") }, meta);
    revalidatePath("/admin/community", "layout");
    return { success: "Kelime yasaklı listesine eklendi." };
  });
}

export async function removeBannedWordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await removeBannedWord({ ...user }, text(formData, "wordId"), meta);
    revalidatePath("/admin/community", "layout");
    return { success: "Kelime listeden çıkarıldı." };
  });
}

/* ------------------------------------------------------------------ */
/* Announcements (module 5)                                            */
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
        severity: text(formData, "severity") as AnnouncementSeverity,
        requiresAcknowledgement: checkbox(formData, "requiresAcknowledgement"),
        pinned: checkbox(formData, "pinned"),
      },
      meta,
    );

    revalidatePath("/admin/announcements");
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
    revalidatePath("/admin/announcements");
    return { success: "Duyuru yayınlandı." };
  });
}

export async function exportUserDataAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    const data = await exportUserData({ ...user }, text(formData, "userId"));
    // Shown in the page rather than downloaded, so nothing is written to disk
    return { success: JSON.stringify(data, null, 2) };
  });
}

/* ------------------------------------------------------------------ */
/* Agreements                                                          */
/* ------------------------------------------------------------------ */

/**
 * Creates a version from the template file in `contracts/` (§11: the text is
 * never typed into the panel; a change to the file is a new version).
 */
export async function createVersionFromTemplateAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const draft = await createVersionFromTemplate({ ...user }, meta);

    revalidatePath("/admin/agreements");
    return { success: `Şablondan ${draft.version}. sürüm taslağı oluşturuldu.` };
  });
}

/**
 * Prepares the contributors' contracts and work licence forms (D-276). Sends
 * nothing: no e-mail goes out at this stage.
 */
export async function prepareContributorDocumentsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    const summary = await prepareContributorDocuments({ ...user }, await requestMetadata());

    revalidatePath("/admin/agreements");
    const skipped = summary.skipped.reduce((sum, entry) => sum + entry.count, 0);
    return {
      success:
        `Genel sözleşme: ${summary.generalCreated} yeni · Ruhsat formu: ${summary.licenceCreated} yeni · ` +
        `İnceleme gerekiyor: ${summary.needsReview.total} · Önceden hazır: ${summary.alreadyPrepared.general + summary.alreadyPrepared.licence} · ` +
        `Atlanan kayıt: ${skipped}. E-posta gönderilmedi.`,
    };
  });
}

/** Makes the template's text the current version's text, keeping its number (D-283). */
export async function replaceCurrentVersionTextAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const version = await replaceVersionTextWithTemplate({ ...user }, text(formData, "versionId"), await requestMetadata());
    revalidatePath("/admin/agreements");
    return {
      success: `v${version.version} artık Genel Katkı Sağlayan Sözleşmesi. Gönderilmemiş belgeleri yenilemek için "Gönderilmemiş belgelerin hepsini sil" ve ardından "Belgeleri hazırla"; gönderilmiş belgeler olduğu gibi kalır.`,
    };
  });
}

/** Mails one contributor their prepared documents as PDFs, on the admin's word only (D-285). */
export async function mailContributorDocumentsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const result = await mailContributorDocuments({ ...user }, text(formData, "userId"), await requestMetadata());
    revalidatePath("/admin/agreements");
    return { success: `${result.sent} belge PDF olarak e-posta kuyruğuna alındı.` };
  });
}

/** Queues every contributor's documents mail without sending; /admin/mail sends the batch (D-286). */
export async function queueAllContributorDocumentsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const result = await queueAllContributorDocuments({ ...user }, await requestMetadata());
    revalidatePath("/admin/agreements");
    revalidatePath("/admin/mail");
    return {
      success:
        `${result.mails} e-posta kuyruğa alındı (${result.documents} hazır belge)` +
        (result.alreadyQueued ? ` · ${result.alreadyQueued} kişinin aynı belgeleri zaten kuyrukta` : "") +
        (result.failedBefore
          ? ` · ${result.failedBefore} kişinin aynı belgeleri daha önce gönderilemedi; /admin/mail'den yeniden deneyin`
          : "") +
        `. Göndermek için /admin/mail sayfasında "Kuyruğu şimdi işle".`,
    };
  });
}

/** Deletes the prepared documents so they can be prepared again (D-281). */
export async function clearContributorDocumentsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const removed = await clearContributorDocuments({ ...user }, await requestMetadata());
    revalidatePath("/admin/agreements");
    return { success: `${removed} belge silindi. "Belgeleri hazırla" ile yeniden hazırlayabilirsiniz.` };
  });
}

/**
 * Removes the unlicensed works of removed writers (D-279), only those the
 * admin was shown; the service works the list out again before removing.
 */
export async function removeUnlicensedFormerWriterWorksAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const ids = String(formData.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const result = await removeUnlicensedFormerWriterWorks({ ...user }, ids, await requestMetadata());

    revalidatePath("/admin/agreements");
    return {
      success: `${result.removed} eser kaldırıldı (kayıt ve sürüm geçmişi saklandı) · ${result.documentsRemoved} gönderilmemiş belge silindi.`,
    };
  });
}

/** Queues upload reminders, to one person or everyone waiting; /admin/mail sends them (D-291). */
export async function queueUploadRemindersAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const target = text(formData, "userId");
    const result = await queueUploadReminders({ ...user }, target === "all" ? "all" : [target], await requestMetadata());
    revalidatePath("/admin/agreements/imza");
    return {
      success: `${result.queued} hatırlatma maili kuyruğa alındı. Göndermek için /admin/mail sayfasında "Kuyruğu şimdi işle".`,
    };
  });
}

/** The copy signed by both sides, uploaded by the magazine for a verified upload (D-290). */
export async function uploadCountersignedAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw badRequest("Dosya seçilmedi.");

    await uploadCountersigned(
      { ...user },
      text(formData, "id"),
      { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, declaredMime: file.type },
      await requestMetadata(),
    );

    revalidatePath("/admin/agreements/imza");
    return { success: "İki tarafça imzalı PDF kaydedildi; katkı sağlayan kendi panelinden indirebilir." };
  });
}

/** A member's signed copy, uploaded by the admin when the member could not (D-303). */
export async function uploadSignedContractForMemberAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw badRequest("Dosya seçilmedi.");

    await uploadSignedContractForMember(
      { ...user },
      {
        buffer: Buffer.from(await file.arrayBuffer()),
        fileName: file.name,
        declaredMime: file.type,
        documentId: text(formData, "documentId"),
      },
      await requestMetadata(),
    );

    revalidatePath("/admin/agreements");
    revalidatePath("/admin/agreements/imza");
    return { success: "Kişi adına yüklendi. Doğrulamak için Sözleşme sürümleri sayfasındaki incelenecekler listesine bakın." };
  });
}

/** The signed contract verification (D-275): the admin checked the uploaded PDF. */
export async function approveSignedContractAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    await approveSignedContract({ ...user }, text(formData, "id"), await requestMetadata());

    revalidatePath("/admin/agreements");
    return { success: `Doğrulandı. Üyenin göreceği mesaj: “${VERIFIED_MESSAGE}”` };
  });
}

/** Refuses an uploaded contract; the reason is required and shown to the member. */
export async function rejectSignedContractAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    await rejectSignedContract({ ...user }, text(formData, "id"), optionalText(formData, "reason") ?? "", await requestMetadata());

    revalidatePath("/admin/agreements");
    return { success: "Reddedildi. Üye nedeni görüp yeni dosya yükleyebilir." };
  });
}

export async function publishAgreementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await publishAgreementVersion({ ...user }, text(formData, "versionId"), meta);

    revalidatePath("/admin/agreements");
    return {
      success:
        "Sürüm yayınlandı. Tüm aktif yazarlar yeni sürümü onaylayana kadar sözleşme bekliyor durumuna alındı.",
    };
  });
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/** Publisher details the contract template needs (§9, Sistem ekranı). */
export async function saveSiteSettingsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const input = Object.fromEntries(SITE_SETTING_KEYS.map((key) => [key, text(formData, key)]));
    await saveSiteSettings({ ...user }, input, meta);

    revalidatePath("/admin/settings");
    revalidatePath("/admin/users", "layout");
    return { success: "Yayıncı bilgileri kaydedildi." };
  });
}

/** Publishes a new KVKK notice version; the previous one stops being current (D-104). */
export async function publishKvkkVersionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const notifyMembers = checkbox(formData, "notifyMembers");
    const { version, notified } = await publishKvkkVersion(
      { ...user },
      {
        title: text(formData, "title") || "KVKK Aydınlatma Metni",
        bodyMarkdown: text(formData, "bodyMarkdown"),
        notifyMembers,
      },
      meta,
    );

    revalidatePath("/admin/settings");
    revalidatePath("/kvkk");
    return {
      success: notifyMembers
        ? `KVKK metni sürüm ${version} olarak yayınlandı; ${notified} üyeye bildirim gönderildi.`
        : `KVKK metni sürüm ${version} olarak yayınlandı.`,
    };
  });
}

export async function createWriterAreaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await createWriterArea(
      { ...user },
      {
        name: text(formData, "name"),
        quota: numberField(formData, "quota") ?? 3,
      },
      meta,
    );

    revalidatePath("/admin/categories");
    return { success: "Alan eklendi." };
  });
}

export async function updateWriterAreaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await updateWriterArea(
      { ...user },
      {
        id: text(formData, "id"),
        name: optionalText(formData, "name") ?? undefined,
        quota: numberField(formData, "quota") ?? undefined,
        isActive: checkbox(formData, "isActive"),
        sortOrder: numberField(formData, "sortOrder") ?? undefined,
      },
      meta,
    );

    revalidatePath("/admin/categories");
    return { success: "Alan güncellendi." };
  });
}

export async function deleteWriterAreaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await deleteWriterArea({ ...user }, text(formData, "id"), meta);

    revalidatePath("/admin/categories");
    return { success: "Alan silindi." };
  });
}

/**
 * Admin-only: (re)assign a writer's first and second area. There is no
 * writer-facing path to this — the writer never edits their own areas.
 */
export async function setWriterAreasAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    await setWriterAreas(
      { ...user },
      targetId,
      {
        area: optionalText(formData, "area"),
        area2: optionalText(formData, "area2"),
      },
      meta,
    );

    revalidatePath(`/admin/users/${targetId}`);
    revalidatePath("/admin/users");
    return { success: "Yazar alanları güncellendi." };
  });
}

/**
 * Admin-only: (re)assign an editor's areas (at most two, each unique to one
 * editor) and the main-editor flag in one step (D-059). The unique per-area
 * rule and the two-slot limit are enforced in the service.
 */
export async function setEditorDutiesAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    await setEditorDuties(
      { ...user },
      targetId,
      {
        areaId: optionalText(formData, "areaId") || null,
        areaId2: optionalText(formData, "areaId2") || null,
        isMainEditor: checkbox(formData, "isMainEditor"),
      },
      meta,
    );

    revalidatePath(`/admin/users/${targetId}`);
    revalidatePath("/admin/users");
    return { success: "Editör görevleri güncellendi." };
  });
}

/** Admin-only: makes an editor a hybrid "Editor & Yazar" or takes it back (D-060). */
export async function setHybridWriterRoleAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    const enabled = checkbox(formData, "enabled");
    await setHybridWriterRole({ ...user }, targetId, enabled, meta);

    revalidatePath(`/admin/users/${targetId}`);
    revalidatePath("/admin/users");
    return {
      success: enabled
        ? "Editör artık aynı zamanda yazar; panel anahtarıyla iki panel arasında geçebilir."
        : "Editörün yazarlığı kaldırıldı.",
    };
  });
}
