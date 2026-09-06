"use server";

/**
 * Admin actions: role changes, identity verification, bans, agreement versions,
 * the rights form template and the KVKK notice.
 *
 * Every one of these re-checks `requireRole("admin")`; nothing here trusts the
 * fact that the page rendered.
 */
import { revalidatePath } from "next/cache";
import {
  changeRole,
  exportUserData,
  markIdentityVerified,
  promoteToWriter,
  setBanned,
  setBirthDateAsAdmin,
  setWriterStatus,
} from "@/services/users";
import {
  createAgreementDraft,
  publishAgreementVersion,
  updateAgreementDraft,
} from "@/services/agreements";
import { setRightsTemplate } from "@/services/settings";
import { uploadIdentityDocument } from "@/services/media";
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

export async function verifyIdentityAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const targetId = text(formData, "userId");
    await markIdentityVerified({ ...user }, targetId, meta);

    revalidatePath(`/admin/users/${targetId}`);
    return { success: "Kimlik doğrulandı olarak işaretlendi." };
  });
}

export async function uploadIdentityDocumentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw badRequest("Dosya seçilmedi.");

    const targetId = text(formData, "userId");
    await uploadIdentityDocument(
      { ...user },
      {
        buffer: Buffer.from(await file.arrayBuffer()),
        fileName: file.name,
        declaredMime: file.type,
        subjectUserId: targetId,
      },
      meta,
    );

    revalidatePath(`/admin/users/${targetId}`);
    return { success: "Belge yüklendi. 90 gün sonra otomatik silinecek." };
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

export async function createAgreementDraftAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await createAgreementDraft(
      { ...user },
      { title: text(formData, "title"), bodyMarkdown: text(formData, "bodyMarkdown") },
      meta,
    );

    revalidatePath("/admin/agreements");
    return { success: "Taslak oluşturuldu." };
  });
}

export async function updateAgreementDraftAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await updateAgreementDraft(
      { ...user },
      text(formData, "versionId"),
      { title: text(formData, "title"), bodyMarkdown: text(formData, "bodyMarkdown") },
      meta,
    );

    revalidatePath("/admin/agreements");
    return { success: "Taslak güncellendi." };
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

export async function setRightsTemplateAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await setRightsTemplate(
      { ...user },
      {
        grantType: text(formData, "grantType"),
        rightAdaptation: checkbox(formData, "rightAdaptation"),
        rightReproduction: checkbox(formData, "rightReproduction"),
        rightDistribution: checkbox(formData, "rightDistribution"),
        rightCommunicationToPublic: checkbox(formData, "rightCommunicationToPublic"),
        channels: formData.getAll("channels").filter((v): v is string => typeof v === "string"),
        exclusivityMonths: numberField(formData, "exclusivityMonths"),
        territory: text(formData, "territory") || "worldwide",
        commercialUseIncluded: checkbox(formData, "commercialUseIncluded"),
      },
      meta,
    );

    revalidatePath("/admin/settings");
    return { success: "Form şablonu güncellendi." };
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
