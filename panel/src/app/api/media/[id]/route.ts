/**
 * GET /api/media/:id — serves a stored file to someone entitled to it.
 *
 * Authorisation, in order of least privilege:
 *  - a writer may read the PDF of an agreement they accepted, and the PDF of a
 *    rights grant they are named on
 *  - an editor may read ordinary library media
 *  - only an admin may read an identity document, and only through a five
 *    minute signed URL that is never linked publicly (§11)
 */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { agreementAcceptances, agreementVersions, media, rightsGrants } from "@/db/schema";
import { getAuthContext } from "@/lib/auth/session";
import { canAccessEditorPanel, canViewIdentityDocuments } from "@/lib/auth/rbac";
import { getStorage, signIdentityDocumentUrl } from "@/lib/storage";
import { errorJson } from "@/lib/api";
import { forbidden, notFound, unauthorized } from "@/lib/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContext();
    if (!context) throw unauthorized();

    const { id } = await params;
    const rows = await db.select().from(media).where(eq(media.id, id)).limit(1);
    const row = rows[0];
    if (!row || row.deletedAt) throw notFound("Dosya bulunamadı.");

    // Identity documents: admin only, and handed over as a short-lived signed URL
    if (row.isIdentityDocument) {
      if (!canViewIdentityDocuments(context.user)) throw forbidden();
      if (row.purgedAt) throw notFound("Bu belge saklama süresi dolduğu için silindi.");

      return NextResponse.redirect(await signIdentityDocumentUrl(row.storageKey), {
        status: 302,
        headers: { "cache-control": "no-store" },
      });
    }

    if (!(await mayRead(context.user.id, row.id, canAccessEditorPanel(context.user)))) {
      throw forbidden();
    }

    const body = await getStorage().get({ bucket: "media", key: row.storageKey });

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "content-type": row.mime,
        "content-length": String(body.length),
        // Private: these are contracts and drafts, never CDN material
        "cache-control": "private, no-store",
        "content-disposition": "inline",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}

/** A writer's own contract PDFs, or anything in the library for an editor. */
async function mayRead(userId: string, mediaId: string, isEditor: boolean): Promise<boolean> {
  if (isEditor) return true;

  const ownGrant = await db
    .select({ id: rightsGrants.id })
    .from(rightsGrants)
    .where(and(eq(rightsGrants.formPdfMediaId, mediaId), eq(rightsGrants.grantorId, userId)))
    .limit(1);
  if (ownGrant.length > 0) return true;

  // The agreement PDF is readable by anyone who accepted that version
  const acceptedVersion = await db
    .select({ id: agreementVersions.id })
    .from(agreementVersions)
    .innerJoin(
      agreementAcceptances,
      eq(agreementAcceptances.agreementVersionId, agreementVersions.id),
    )
    .where(and(eq(agreementVersions.pdfMediaId, mediaId), eq(agreementAcceptances.userId, userId)))
    .limit(1);

  return acceptedVersion.length > 0;
}
