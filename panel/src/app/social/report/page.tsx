import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABELS, REPORT_TARGET_LABELS } from "@/lib/reports";
import { MAX_REPORT_REASON, REPORTABLE_TARGETS } from "@/services/reports";
import { PanelForm } from "@/components/form";
import { Alert, Card, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { reportAction } from "../actions";

export const metadata = { title: "Bildir" };

/**
 * The in-site report form (D-090). The target comes from the link that led
 * here; the service checks it again, so a tampered link only earns a 404.
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { type, id } = await searchParams;

  const targetType = REPORTABLE_TARGETS.find((candidate) => candidate === type);
  if (!targetType || !z.uuid().safeParse(id).success) notFound();

  return (
    <>
      <PageHeader title="Bildir" description={`${REPORT_TARGET_LABELS[targetType]} bildirimi`} />

      <Card>
        <Alert tone="info">
          Bildiriminiz yöneticilere iletilir ve en geç 24 saat içinde incelenir. İçeriğin sahibi
          kimin bildirdiğini görmez. Kişilik haklarınızı ihlal eden bir içerik için 5651 sayılı Kanun
          kapsamındaki başvuru yolu{" "}
          <Link href="/iletisim" className="underline">
            künye sayfasındadır
          </Link>
          .
        </Alert>

        <div className="mt-4">
          <PanelForm action={reportAction} csrfToken={csrfToken} submitLabel="Bildirimi gönder">
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={id} />

            <Field label="Bildirim türü" htmlFor="category">
              <Select id="category" name="category" required defaultValue="">
                <option value="" disabled>
                  Seçin
                </option>
                {REPORT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {REPORT_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Açıklama (isteğe bağlı)" htmlFor="reason">
              <Textarea
                id="reason"
                name="reason"
                maxLength={MAX_REPORT_REASON}
                rows={4}
                className="font-sans"
              />
            </Field>
          </PanelForm>
        </div>
      </Card>
    </>
  );
}
