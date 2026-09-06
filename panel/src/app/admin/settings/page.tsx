import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { kvkkVersions } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import { getRightsTemplate } from "@/services/settings";
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
import { publishKvkkVersionAction, setRightsTemplateAction } from "../actions";

export const metadata = { title: "Sistem" };

const CHANNELS = [
  ["web", "İnternet sitesi"],
  ["pdf_issue", "PDF sayı"],
  ["social", "Sosyal medya"],
  ["newsletter", "Bülten"],
  ["future_channels", "İleride kullanılacak mecralar"],
] as const;

export default async function AdminSettingsPage() {
  await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";

  const template = await getRightsTemplate();
  const kvkk = await db
    .select()
    .from(kvkkVersions)
    .orderBy(desc(kvkkVersions.version))
    .limit(20);

  // Rendered with placeholder values so an admin can see what actually goes out
  const preview = [
    templates.verifyEmail({ displayName: "Ad Soyad", url: "https://…/verify-email?token=…" }),
    templates.promotedToWriter({ displayName: "Ad Soyad", url: "https://…/writer/agreement" }),
    templates.rightsGrantPending({
      displayName: "Ad Soyad",
      articleTitle: "Örnek Yazı",
      url: "https://…/writer/rights/…",
    }),
  ];

  return (
    <>
      <PageHeader
        title="Sistem"
        description="Devir formu şablonu, KVKK aydınlatma metni ve e-posta şablonları."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Devir formu şablonu</h2>
          <p className="mb-4 text-sm text-muted">
            Yeni açılan her form bu değerlerle başlar. Editör makale bazında değiştirebilir;
            değişiklik denetim kaydına düşer.
          </p>

          <PanelForm
            action={setRightsTemplateAction}
            csrfToken={csrfToken}
            submitLabel="Şablonu kaydet"
          >
              <>
                <Field label="Sözleşme türü" htmlFor="grantType">
                  <Select id="grantType" name="grantType" defaultValue={template.grantType}>
                    <option value="assignment">Devir (mali hakların devri)</option>
                    <option value="exclusive_license">Tam ruhsat (inhisari lisans)</option>
                    <option value="non_exclusive_license">Basit ruhsat</option>
                  </Select>
                </Field>

                <fieldset className="space-y-2">
                  <legend className="mb-1 text-sm font-medium">Devredilen haklar</legend>
                  {(
                    [
                      ["rightAdaptation", "İşleme (m.21)", template.rightAdaptation],
                      ["rightReproduction", "Çoğaltma (m.22)", template.rightReproduction],
                      ["rightDistribution", "Yayma (m.23)", template.rightDistribution],
                      [
                        "rightCommunicationToPublic",
                        "Umuma iletim (m.25)",
                        template.rightCommunicationToPublic,
                      ],
                    ] as const
                  ).map(([name, label, checked]) => (
                    <label key={name} className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        name={name}
                        defaultChecked={checked}
                        className="size-4 rounded border-line"
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="mb-1 text-sm font-medium">Mecralar</legend>
                  {CHANNELS.map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        name="channels"
                        value={value}
                        defaultChecked={template.channels.includes(value)}
                        className="size-4 rounded border-line"
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="İnhisar süresi (ay)"
                    htmlFor="exclusivityMonths"
                    hint="Boş bırakılırsa süresiz."
                  >
                    <Input
                      id="exclusivityMonths"
                      name="exclusivityMonths"
                      type="number"
                      min={0}
                      max={600}
                      defaultValue={template.exclusivityMonths ?? ""}
                    />
                  </Field>

                  <Field label="Ülke / bölge" htmlFor="territory">
                    <Input id="territory" name="territory" defaultValue={template.territory} />
                  </Field>
                </div>

                <label className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    name="commercialUseIncluded"
                    defaultChecked={template.commercialUseIncluded}
                    className="size-4 rounded border-line"
                  />
                  Ticari kullanım dahil
                </label>

                <Alert tone="info">Bedel bu aşamada her zaman &ldquo;Yok&rdquo; olarak kaydedilir.</Alert>
              </>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">KVKK aydınlatma metni</h2>

          <PanelForm
            action={publishKvkkVersionAction}
            csrfToken={csrfToken}
            submitLabel="Yeni sürüm yayınla"
          >
              <>
                <Field label="Başlık" htmlFor="kvkkTitle">
                  <Input
                    id="kvkkTitle"
                    name="title"
                    defaultValue="KVKK Aydınlatma Metni"
                    required
                  />
                </Field>
                <Field
                  label="Metin (markdown)"
                  htmlFor="kvkkBody"
                >
                  <Textarea id="kvkkBody" name="bodyMarkdown" rows={12} required />
                </Field>
              </>
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
