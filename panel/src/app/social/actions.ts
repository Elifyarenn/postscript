"use server";

/**
 * Community actions (D-089): the handle, follows, blocks, the reading list and
 * notifications. Each one is CSRF check → session → service → revalidate; the
 * rules themselves live in `src/services/social.ts`.
 */
import { revalidatePath } from "next/cache";
import { requestMetadata, requireAuth } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, type ActionState } from "@/lib/action";
import { normalizeUsername } from "@/lib/username";
import {
  blockMember,
  bookmarkArticle,
  followMember,
  removeBookmark,
  setUsername,
  unblockMember,
  unfollowMember,
} from "@/services/social";
import { markAllNotificationsRead } from "@/services/notifications";

export async function setUsernameAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    const meta = await requestMetadata();

    const username = await setUsername({ ...user }, { username: text(formData, "username") }, meta);

    // The sidebar links to the profile, so every community page changes
    revalidatePath("/social", "layout");
    return { success: `Kullanıcı adınız @${username} olarak kaydedildi.` };
  });
}

/** The profile a follow or block button sat on, re-rendered with its new state. */
function revalidateProfile(formData: FormData): string {
  const username = normalizeUsername(text(formData, "username"));
  revalidatePath(`/social/u/${username}`, "layout");
  return username;
}

export async function followAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    await followMember({ ...user }, text(formData, "username"));
    revalidateProfile(formData);
    return { success: "Takip ediliyor." };
  });
}

export async function unfollowAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    await unfollowMember({ ...user }, text(formData, "username"));
    revalidateProfile(formData);
    return { success: "Takip bırakıldı." };
  });
}

export async function blockAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    await blockMember({ ...user }, text(formData, "username"));
    revalidateProfile(formData);
    revalidatePath("/social/settings");
    return { success: "Hesap engellendi." };
  });
}

export async function unblockAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    await unblockMember({ ...user }, text(formData, "username"));
    revalidateProfile(formData);
    revalidatePath("/social/settings");
    return { success: "Engel kaldırıldı." };
  });
}

export async function bookmarkArticleAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    await bookmarkArticle({ ...user }, text(formData, "articleId"));
    revalidatePath(`/magazine/articles/${text(formData, "slug")}`);
    revalidatePath("/social/bookmarks");
    return { success: "Kaydedildi." };
  });
}

export async function removeBookmarkAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    await removeBookmark({ ...user }, text(formData, "articleId"));
    revalidatePath(`/magazine/articles/${text(formData, "slug")}`);
    revalidatePath("/social/bookmarks");
    return { success: "Kaydedilenlerden çıkarıldı." };
  });
}

export async function markNotificationsReadAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    await markAllNotificationsRead({ ...user });
    revalidatePath("/social", "layout");
    return { success: "Tümü okundu." };
  });
}
