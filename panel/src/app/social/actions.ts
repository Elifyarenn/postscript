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
import {
  bookmarkPost,
  createPost,
  deleteOwnPost,
  likePost,
  removePostBookmark,
  repostPost,
  unlikePost,
  unrepostPost,
} from "@/services/posts";
import { reportContent } from "@/services/reports";

/* ------------------------------------------------------------------ */
/* Posts (D-090)                                                       */
/* ------------------------------------------------------------------ */

export async function createPostAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    const meta = await requestMetadata();

    const replyToId = text(formData, "replyToId");
    await createPost(
      { ...user },
      { body: text(formData, "body"), replyToId: replyToId === "" ? null : replyToId },
      meta,
    );

    // A post shows up in the feed, on profiles and in threads alike
    revalidatePath("/social", "layout");
    return { success: replyToId ? "Yanıtınız paylaşıldı." : "Gönderiniz paylaşıldı." };
  });
}

/** Runs a one-button post interaction and refreshes every community page. */
function postInteraction(
  run: (actor: Parameters<typeof likePost>[0], postId: string) => Promise<void>,
  success: string,
) {
  return async (_state: ActionState, formData: FormData): Promise<ActionState> =>
    runAction(async () => {
      await assertCsrfFromForm(formData);
      const { user } = await requireAuth();
      await run({ ...user }, text(formData, "postId"));
      revalidatePath("/social", "layout");
      return { success };
    });
}

export async function likePostAction(state: ActionState, formData: FormData): Promise<ActionState> {
  return postInteraction(likePost, "Beğenildi.")(state, formData);
}

export async function unlikePostAction(state: ActionState, formData: FormData): Promise<ActionState> {
  return postInteraction(unlikePost, "Beğeni geri alındı.")(state, formData);
}

export async function repostAction(state: ActionState, formData: FormData): Promise<ActionState> {
  return postInteraction(repostPost, "Yeniden paylaşıldı.")(state, formData);
}

export async function unrepostAction(state: ActionState, formData: FormData): Promise<ActionState> {
  return postInteraction(unrepostPost, "Yeniden paylaşım geri alındı.")(state, formData);
}

export async function bookmarkPostAction(state: ActionState, formData: FormData): Promise<ActionState> {
  return postInteraction(bookmarkPost, "Kaydedildi.")(state, formData);
}

export async function removePostBookmarkAction(
  state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return postInteraction(removePostBookmark, "Kaydedilenlerden çıkarıldı.")(state, formData);
}

export async function deletePostAction(state: ActionState, formData: FormData): Promise<ActionState> {
  return postInteraction(deleteOwnPost, "Gönderi silindi.")(state, formData);
}

/* ------------------------------------------------------------------ */
/* Reports (D-090)                                                     */
/* ------------------------------------------------------------------ */

export async function reportAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    const meta = await requestMetadata();

    const result = await reportContent(
      { ...user },
      {
        targetType: text(formData, "targetType"),
        targetId: text(formData, "targetId"),
        category: text(formData, "category"),
        reason: text(formData, "reason") || null,
      },
      meta,
    );

    return {
      success: result.duplicate
        ? "Bu içeriği zaten bildirdiniz; bildiriminiz inceleme sırasında."
        : "Bildiriminiz alındı. Yöneticiler en geç 24 saat içinde inceleyecek.",
    };
  });
}

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
