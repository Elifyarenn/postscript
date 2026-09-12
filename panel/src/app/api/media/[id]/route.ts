/**
 * GET /api/media/:id — serves a stored file to someone entitled to it.
 *
 * Two classes of file, two rules:
 *
 *  - contract and approval PDFs (`license_type = contract_pdf`) belong to the
 *    writer named on them and to an admin. **An editor cannot read them** (§8),
 *    even though an editor can read everything else in the library.
 *  - ordinary library media is editor material.
 *
 * Where the storage adapter can sign a URL, contract PDFs are handed over as a
 * five minute signed link; otherwise they are streamed through this route,
 * which is at least as restrictive because nothing leaves the server that works
 * without a session.
 */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { agreementAcceptances, media, rightsGrants, writerApplications } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { canAccessEditorPanel, canViewContractDocuments } from "@/lib/auth/rbac";
import { getStorage } from "@/lib/storage";
import { errorJson } from "@/lib/api";
import { forbidden, notFound } from "@/lib/errors";

const SIGNED_URL_SECONDS = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // `requireAuth`, not `getAuthContext`: a banned or unverified account must
    // not pull files out of the library either (D-072)
    const context = await requireAuth();

    const { id } = await params;
    const rows = await db.select().from(media).where(eq(media.id, id)).limit(1);
    const row = rows[0];
    if (!row || row.deletedAt) throw notFound("Dosya bulunamadı.");

    const isContract = row.licenseType === "contract_pdf";

    if (isContract) {
      const allowed =
        canViewContractDocuments(context.user) || (await ownsContract(context.user.id, row.id));
      if (!allowed) throw forbidden();

      // A real signed URL where the adapter can make one; otherwise stream below
      const signed = await getStorage().signedUrl({
        bucket: "media",
        key: row.storageKey,
        expiresInSeconds: SIGNED_URL_SECONDS,
      });
      if (signed.startsWith("http")) {
        return NextResponse.redirect(signed, {
          status: 302,
          headers: { "cache-control": "no-store" },
        });
      }
    } else if (
      !canAccessEditorPanel(context.user) &&
      !(await ownsApplicationSample(context.user.id, row.id))
    ) {
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

/** True when this PDF is the user's own contract acceptance or work approval. */
async function ownsContract(userId: string, mediaId: string): Promise<boolean> {
  const acceptance = await db
    .select({ id: agreementAcceptances.id })
    .from(agreementAcceptances)
    .where(
      and(eq(agreementAcceptances.pdfMediaId, mediaId), eq(agreementAcceptances.userId, userId)),
    )
    .limit(1);
  if (acceptance.length > 0) return true;

  const approval = await db
    .select({ id: rightsGrants.id })
    .from(rightsGrants)
    .where(and(eq(rightsGrants.formPdfMediaId, mediaId), eq(rightsGrants.grantorId, userId)))
    .limit(1);

  return approval.length > 0;
}

/**
 * True when this file is the applicant's own sample work. The applicant may
 * read their own file back; the file itself is never public.
 */
async function ownsApplicationSample(userId: string, mediaId: string): Promise<boolean> {
  const rows = await db
    .select({ id: writerApplications.id })
    .from(writerApplications)
    .where(
      and(
        eq(writerApplications.sampleMediaId, mediaId),
        eq(writerApplications.userId, userId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
