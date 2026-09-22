"use server";

/**
 * Laying an issue out (D-234): CSRF check → session → service → revalidate.
 * Every rule, including who may do this at all, is re-checked in the service.
 */
import { revalidatePath } from "next/cache";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, type ActionState } from "@/lib/action";
import { badRequest } from "@/lib/errors";
import {
  addIssuePage,
  duplicateIssuePage,
  moveIssuePage,
  removeIssuePage,
  updateIssuePage,
} from "@/services/issue-pages";

/** A form field that is empty means "nothing", not an empty string. */
function optional(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function pageInput(formData: FormData): Record<string, unknown> {
  const raw = formData.get("blocks");
  let blocks: unknown = [];
  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      blocks = JSON.parse(raw);
    } catch {
      throw badRequest("Etkileşim blokları okunamadı. Sayfayı yenileyip tekrar deneyin.");
    }
  }

  return {
    template: text(formData, "template"),
    tocTitle: optional(formData, "tocTitle"),
    inContents: formData.get("inContents") === "1",
    heading: optional(formData, "heading"),
    standfirst: optional(formData, "standfirst"),
    byline: optional(formData, "byline"),
    body: optional(formData, "body"),
    caption: optional(formData, "caption"),
    section: optional(formData, "section"),
    imageMediaId: optional(formData, "imageMediaId"),
    articleId: optional(formData, "articleId"),
    blocks,
  };
}

function refresh(issueId: string): void {
  revalidatePath(`/editor/issues/${issueId}/sayfalar`);
  revalidatePath("/magazine/issues", "layout");
}

export async function addIssuePageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const issueId = text(formData, "issueId");

    await addIssuePage({ ...user }, issueId, pageInput(formData), await requestMetadata());
    refresh(issueId);
    return { success: "Sayfa eklendi." };
  });
}

export async function updateIssuePageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    await updateIssuePage({ ...user }, text(formData, "pageId"), pageInput(formData), await requestMetadata());
    refresh(text(formData, "issueId"));
    return { success: "Sayfa kaydedildi." };
  });
}

export async function moveIssuePageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const direction = formData.get("direction") === "up" ? "up" : "down";

    await moveIssuePage({ ...user }, text(formData, "pageId"), direction, await requestMetadata());
    refresh(text(formData, "issueId"));
  });
}

export async function duplicateIssuePageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    await duplicateIssuePage({ ...user }, text(formData, "pageId"), await requestMetadata());
    refresh(text(formData, "issueId"));
    return { success: "Sayfa çoğaltıldı." };
  });
}

export async function removeIssuePageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    await removeIssuePage({ ...user }, text(formData, "pageId"), await requestMetadata());
    refresh(text(formData, "issueId"));
    return { success: "Sayfa kaldırıldı." };
  });
}
