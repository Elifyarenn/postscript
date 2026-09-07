import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { kvkkVersions } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import {
  getSiteSettings,
  PLACEHOLDER_BY_KEY,
  SETTING_LABELS,
  SITE_SETTING_KEYS,
} from "@/services/site-settings";
import { getAccessMode } from "@/services/access-mode";
import { renderAgreementForWriter } from "@/services/agreements";
import { AgreementRenderError } from "@/lib/agreement/render";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import * as templates from "@emails/templates";
import { publishKvkkVersionAction, saveSiteSettingsAction, setAccessModeAction } from "../actions";

export const metadata = { title: "Sistem" };

export default async function AdminSettingsPage() {
  await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";

  const settings = await getSiteSettings();
  const accessMode = await getAccessMode();
  const kvkk = await db.select().from(kvkkVersions).orderBy(desc(kvkkVersions.version)).limit(20);

  // §9: prove the current values actually render a contract before trusting them
  let renderCheck: { ok: true } | { ok: false; reason: string };
  try {
    await renderAgreementForWriter({
      displayName: "Örnek Yazar",
      birthDate: "1990-01-01",
      email: "ornek@postscriptmag.com",
      penName: null,
    });
    renderCheck = { ok: true };
  } catch (error) {
    renderCheck = {
      ok: false,
      reason:
        error instanceof AgreementRenderError
          ? error.message
          : "Sözleşme render edilemedi.",
    };
  }

  // Rendered with placeholder values so an admin can see what actually goes out
  const preview = [
    templates.verifyEmail({ displayName: "Ad Soyad", url: "https://…/verify-email?token=…" }),
    templates.promotedToWriter({ displayName: "Ad Soyad", url: "https://…/writer/agreement" }),
    templates.rightsGrantPending({
      displayName: "Ad Soyad",
      articleTitle: "Örnek Yazı",
      url: "https://…/writer/approvals",
    }),
  ];

  return (
    <>
      <PageHeader
        title="Sistem"
        description="Sözleşmenin ihtiyaç duyduğu yayıncı bilgileri, KVKK metni ve e-posta şablonları."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-2 font-serif text-lg">Erişim modu</h2>
          <p className="mb-4 text-sm text-muted">
            Kapalıyken kayıt alınmaz, yalnızca yöneticiler girebilir ve mevcut yönetici dışı
            oturumlar geçersiz sayılır.
          </p>

          <PanelForm
            action={setAccessModeAction}
            csrfToken={csrfToken}
            submitLabel="Uygula"
          >
            <Field label="Durum" htmlFor="accessMode">
              <Select id="accessMode" name="mode" defaultValue={accessMode}>
                <option value="open">Açık (herkes kayıt olup girebilir)</option>
                <option value="closed">Kapalı (yalnızca yöneticiler)</option>
              </Select>
            </Field>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-2 font-serif text-lg">Yayıncı bilgileri</h2>
          <p className="mb-4 text-sm text-muted">
            Bu alanlar sözleşme şablonundaki yer tutucuları doldurur. Biri boşken hiçbir yazar
            terfi ettirilemez, çünkü sözleşme render edilemez.
          </p>

          <div className="mb-4">
            {renderCheck.ok ? (
              <Alert tone="success">
                Bu değerlerle örnek sözleşme sorunsuz render ediliyor.
              </Alert>
            ) : (
              <Alert tone="danger" title="Örnek sözleşme render edilemiyor">
                {renderCheck.reason}
              </Alert>
            )}
          </div>

          <PanelForm
            action={saveSiteSettingsAction}
            csrfToken={csrfToken}
            submitLabel="Yayıncı bilgilerini kaydet"
          >
            {SITE_SETTING_KEYS.map((key) => (
              <Field
                key={key}
                label={SETTING_LABELS[key]}
                htmlFor={key}
                hint={PLACEHOLDER_BY_KEY[key]}
              >
                <Input id={key} name={key} defaultValue={settings[key] ?? ""} required />
              </Field>
            ))}
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">KVKK aydınlatma metni</h2>

          <PanelForm
            action={publishKvkkVersionAction}
            csrfToken={csrfToken}
            submitLabel="Yeni sürüm yayınla"
          >
            <Field label="Başlık" htmlFor="kvkkTitle">
              <Input id="kvkkTitle" name="title" defaultValue="KVKK Aydınlatma Metni" required />
            </Field>
            <Field label="Metin (markdown)" htmlFor="kvkkBody">
              <Textarea id="kvkkBody" name="bodyMarkdown" rows={12} required />
            </Field>
          </PanelForm>

          <div className="mt-6">
            {kvkk.length === 0 ? (
              <EmptyState>Henüz yayınlanmış aydınlatma metni yok.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Sürüm</Th>
                    <Th>Yayın</Th>
                    <Th>Durum</Th>
                    <Th>sha256</Th>
                  </tr>
                </thead>
                <tbody>
                  {kvkk.map((row) => (
                    <tr key={row.id}>
                      <Td>v{row.version}</Td>
                      <Td className="text-xs">{formatDate(row.publishedAt)}</Td>
                      <Td className="text-xs">{row.isCurrent ? "güncel" : "eski"}</Td>
                      <Td className="max-w-[12rem] truncate font-mono text-[10px]">
                        {row.bodyHash}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">E-posta şablonları</h2>
          <p className="mb-4 text-sm text-muted">
            Şablonlar kod içinde (<code>emails/templates.ts</code>) tanımlıdır. Aşağıda örnek
            değerlerle önizlemeleri var.
          </p>

          <div className="space-y-4">
            {preview.map((message) => (
              <details key={message.subject} className="rounded-md border border-line bg-paper p-3">
                <summary className="cursor-pointer text-sm font-medium">{message.subject}</summary>
                <pre className="mt-3 text-xs whitespace-pre-wrap text-muted">{message.text}</pre>
              </details>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
