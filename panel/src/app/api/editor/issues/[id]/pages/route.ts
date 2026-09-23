/**
 * POST /api/editor/issues/:id/pages — takes one delivered page picture.
 *
 * A route handler rather than a server action (D-240), for one reason: the
 * panel uploads several pages at once and shows each one's progress, which
 * needs a request per file that the browser can watch. Everything a server
 * action would check is checked here too — same origin, the double-submit
 * token, the admin role, and then the service, which re-checks the role and
 * decides the file's fate on its bytes rather than its name.
 *
 * With `pageId` the picture replaces an existing page's picture instead of
 * making a new page; the areas drawn on that page are kept, and the answer
 * says whether the new picture is a different shape.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrf } from "@/lib/csrf";
import { errorJson } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { addPageImage, replacePageImage } from "@/services/issue-pages";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const form = await request.formData();
    const token = form.get("csrfToken");
    await assertCsrf(typeof token === "string" ? token : null);

    const { user } = await requireRole("admin");
    const meta = await requestMetadata();
    const { id } = await params;

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw badRequest("Dosya seçilmedi.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const declaredMime = file.type;
    const replaces = form.get("pageId");

    if (typeof replaces === "string" && replaces !== "") {
      const result = await replacePageImage(
        { ...user },
        replaces,
        { buffer, fileName: file.name, declaredMime },
        meta,
      );
      revalidatePath(`/editor/issues/${id}/sayfalar`);
      return NextResponse.json(
        { pageId: replaces, aspectChanged: result.aspectChanged },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const label = form.get("label");
    const page = await addPageImage(
      { ...user },
      id,
      {
        buffer,
        fileName: file.name,
        declaredMime,
        label: typeof label === "string" ? label : null,
      },
      meta,
    );

    revalidatePath(`/editor/issues/${id}/sayfalar`);
    return NextResponse.json(page, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorJson(error);
  }
}
