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
  setWriterStatus,
} from "@/services/users";
import { createVersionFromTemplate, publishAgreementVersion } from "@/services/agreements";
import { adminDecideApplication } from "@/services/writer-applications";
import { createAnnouncement, publishAnnouncement } from "@/services/announcements";
import { setAccessMode } from "@/services/access-mode";
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
import { saveSiteSettings, SITE_SETTING_KEYS } from "@/services/site-settings";
import { requestMetadata, requireRole, revokeAllSessions } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { db } from "@/db/client";
import { kvkkVersions } from "@/db/schema";
import { sha256Hex } from "@/lib/crypto";
import { and, eq, ne, desc } from "drizzle-orm";
import {
  checkbox,
  numberField,
  optionalText,
  runAction,
  text,
  type ActionState,
} from "@/lib/action";
import { badRequest } from "@/lib/errors";
import type { Role } from "@/db/schema";

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
    await changeRole(
      { ...user },
      targetId,
      text(formData, "role") as Role,
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
    revalidatePath("/admin/community");
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
    revalidatePath("/admin/community");
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
    revalidatePath("/admin/community");
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
    revalidatePath("/admin/community");
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

export async function setAccessModeAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await setAccessMode(
      { ...user },
      { mode: text(formData, "mode") as "open" | "closed" },
      meta,
    );

    revalidatePath("/admin/settings");
    revalidatePath("/login");
    revalidatePath("/register");
    return { success: "Erişim modu güncellendi." };
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

/** Publishes a new KVKK notice version; the previous one stops being current. */
export async function publishKvkkVersionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    const bodyMarkdown = text(formData, "bodyMarkdown");
    if (bodyMarkdown.length < 50) throw badRequest("Aydınlatma metni çok kısa.");

    const latest = await db
      .select({ version: kvkkVersions.version })
      .from(kvkkVersions)
      .orderBy(desc(kvkkVersions.version))
      .limit(1);

    const version = (latest[0]?.version ?? 0) + 1;

    await db.transaction(async (tx) => {
      // Only one row may be current, so the old one is cleared first
      await tx
        .update(kvkkVersions)
        .set({ isCurrent: false, updatedAt: new Date() })
        .where(and(eq(kvkkVersions.isCurrent, true), ne(kvkkVersions.version, version)));

      await tx.insert(kvkkVersions).values({
        version,
        title: text(formData, "title") || "KVKK Aydınlatma Metni",
        bodyMarkdown,
        bodyHash: sha256Hex(bodyMarkdown),
        publishedAt: new Date(),
        publishedBy: user.id,
        isCurrent: true,
      });
    });

    revalidatePath("/admin/settings");
    revalidatePath("/kvkk");
    return { success: `KVKK metni sürüm ${version} olarak yayınlandı.` };
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
    revalidatePath("/yazar-basvuru");
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
    revalidatePath("/yazar-basvuru");
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
