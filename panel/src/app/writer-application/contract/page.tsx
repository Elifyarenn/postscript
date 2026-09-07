import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, writerApplications } from "@/db/schema";
import { requireSession } from "@/lib/auth/guard";
import { getCurrentAgreement, renderAgreementForWriter } from "@/services/agreements";
import { AgreementRenderError } from "@/lib/agreement/render";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { navForRole, PanelShell } from "@/components/shell";
import { Alert, Card, PageHeader } from "@/components/ui";
import { AgreementAcceptForm } from "@/app/writer/agreement/accept-form";
import { signApplicationContractAction } from "../actions";

export const metadata = { title: "Yazar sözleşmesi" };

/**
 * The contract an approved applicant signs. Only the owner of an application
 * that reached `admin_approved` can open it, and only while they are still a
 * plain user. The acceptance itself is verified server side in the action.
 */
export default async function WriterApplicationContractPage({
  searchParams,
}: {
  searchParams: Promise<{ application?: string }>;
}) {
  const context = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { application: applicationId } = await searchParams;

  const rows = await db.select().from(users).where(eq(users.id, context.user.id)).limit(1);
  const profile = rows[0]!;

  const applicationRows = applicationId
    ? await db
        .select()
        .from(writerApplications)
        .where(and(eq(writerApplications.id, applicationId)))
        .limit(1)
    : [];
  const application = applicationRows[0] ?? null;

  const nav = navForRole(context.user.role);

  let error: string | null = null;
  if (!application) {
    error = "Başvuru bulunamadı.";
  } else if (application.userId !== context.user.id) {
    error = "Bu başvuru size ait değil.";
  } else if (application.status !== "admin_approved") {
    error = "Bu başvurunun sözleşmesi henüz imzalanmaya hazır değil.";
  } else if (profile.role !== "user") {
    error = "Zaten yazar veya üzeri bir role sahipsiniz.";
  }

  let rendered: { html: string; hash: string; version: number; versionId: string } | null = null;
  if (!error) {
    const current = await getCurrentAgreement();
    if (!current) {
      error = "Yayınlanmış bir çerçeve sözleşme yok. Yöneticiye bildirin.";
    } else {
      try {
        const preview = await renderAgreementForWriter(profile);
        rendered = {
          html: await renderMarkdown(preview.markdown),
          hash: preview.hash,
          version: current.version,
          versionId: current.id,
        };
      } catch (caught) {
        error =
          caught instanceof AgreementRenderError
            ? caught.message
            : "Sözleşme şu anda gösterilemiyor.";
      }
    }
  }

  return (
    <PanelShell user={context.user} area={nav.area} groups={nav.groups}>
      <PageHeader
        title="Yazar sözleşmesi"
        description="Başvurunuz onaylandı; yazar olmanın son adımı bu sözleşmeyi imzalamak."
      />

      <div className="space-y-6">
        {error ? (
          <Alert tone="danger" title="Sözleşme imzalanamıyor">
            {error}
          </Alert>
        ) : rendered ? (
          <Card>
            <h2 className="mb-1 font-serif text-lg">Sürüm {rendered.version}</h2>
            <p className="mb-4 text-xs text-muted">
              Size gösterilen metnin özeti (sha256):{" "}
              <code className="break-all">{rendered.hash}</code>
            </p>

            <AgreementAcceptForm
              action={signApplicationContractAction}
              csrfToken={csrfToken}
              agreementVersionId={rendered.versionId}
              renderedHash={rendered.hash}
              html={rendered.html}
              extraHidden={{ applicationId: application?.id ?? "" }}
            />
          </Card>
        ) : null}
      </div>
    </PanelShell>
  );
}