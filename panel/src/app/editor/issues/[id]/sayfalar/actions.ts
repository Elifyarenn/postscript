"use server";

/**
 * Laying an issue out (D-234): CSRF check → session → service → revalidate.
 * Every rule, including who may do this at all, is re-checked in the service.
 */
import { revalidatePath } from "next/cache";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { listField, runAction, text, type ActionState } from "@/lib/action";
import { badRequest } from "@/lib/errors";
import {
  addIssuePage,
  duplicateIssuePage,
  moveIssuePage,
  removeIssuePage,
  reorderIssuePages,
  saveHotspots,
  updateIssuePage,
  updatePageMeta,
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

/* ------------------------------------------------------------------ */
/* Designed pages (D-236)                                              */
/* ------------------------------------------------------------------ */

/**
 * The fields the page list edits about an uploaded page. The picture itself
 * is uploaded through the route handler, because that is the only way the
 * panel can show progress for several files at once.
 */
export async function updatePageMetaAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    const role = formData.get("template");
    await updatePageMeta(
      { ...user },
      text(formData, "pageId"),
      {
        label: optional(formData, "label"),
        imageAlt: optional(formData, "imageAlt"),
        transcript: optional(formData, "transcript"),
        tocTitle: optional(formData, "tocTitle"),
        inContents: formData.get("inContents") === "1",
        template:
          role === "cover" || role === "back_cover" || role === "full_bleed" ? role : undefined,
      },
      await requestMetadata(),
    );
    refresh(text(formData, "issueId"));
    return { success: "Sayfa bilgileri kaydedildi." };
  });
}

/** The whole order at once, as dragging the list produces it. */
export async function reorderIssuePagesAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const issueId = text(formData, "issueId");

    await reorderIssuePages({ ...user }, issueId, listField(formData, "order"), await requestMetadata());
    refresh(issueId);
    return { success: "Sıralama kaydedildi." };
  });
}

/** Every clickable area of one page, saved as a set. */
export async function saveHotspotsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    const raw = formData.get("areas");
    let areas: unknown = [];
    if (typeof raw === "string" && raw.trim() !== "") {
      try {
        areas = JSON.parse(raw);
      } catch {
        throw badRequest("Etkileşim alanları okunamadı. Sayfayı yenileyip tekrar deneyin.");
      }
    }

    await saveHotspots({ ...user }, text(formData, "pageId"), areas, await requestMetadata());
    refresh(text(formData, "issueId"));
    return { success: "Etkileşim alanları kaydedildi." };
  });
}
