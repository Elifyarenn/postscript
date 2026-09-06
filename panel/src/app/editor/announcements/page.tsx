import { guardPanel } from "@/lib/auth/guard";
import { listAllAnnouncements, readReport } from "@/services/announcements";
import { readCsrfToken } from "@/lib/csrf";
import { ActionButton, PanelForm } from "@/components/form";
import {
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
import { formatDate, formatDateTime } from "@/lib/utils";
import { createAnnouncementAction, publishAnnouncementAction } from "../actions";

export const metadata = { title: "Duyurular" };

const AUDIENCE_LABELS: Record<string, string> = {
  writers: "Yazarlar",
  editors: "Editörler",
  all_staff: "Tüm ekip",
};

export default async function EditorAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  const { user } = await guardPanel("editor");
  const actor = { ...user };
  const csrfToken = (await readCsrfToken()) ?? "";
  const { report } = await searchParams;

  const announcements = await listAllAnnouncements(actor);
  const reportRows = report ? await readReport(actor, report) : null;

  return (
    <>
      <PageHeader title="Duyurular" description="Yazarlara ve ekibe duyuru yayınlayın." />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Yeni duyuru</h2>

          <PanelForm
            action={createAnnouncementAction}
            csrfToken={csrfToken}
            submitLabel="Taslak oluştur"
          >
              <>
                <Field label="Başlık" htmlFor="title">
                  <Input id="title" name="title" required maxLength={200} />
                </Field>

                <Field
                  label="Metin (markdown)"
                  htmlFor="bodyMarkdown"
                >
                  <Textarea id="bodyMarkdown" name="bodyMarkdown" rows={8} required />
                </Field>

                <Field label="Hedef kitle" htmlFor="audience">
                  <Select id="audience" name="audience" defaultValue="writers">
                    <option value="writers">Yazarlar</option>
                    <option value="editors">Editörler</option>
                    <option value="all_staff">Tüm ekip</option>
                  </Select>
                </Field>

                <label className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    name="requiresAcknowledgement"
                    className="size-4 rounded border-line"
                  />
                  Onay gerektirir (onaylanmadan yazar paneli açılmaz)
                </label>

                <label className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" name="pinned" className="size-4 rounded border-line" />
                  Listenin en üstüne sabitle
                </label>
              </>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Duyurular</h2>

          {announcements.length === 0 ? (
            <EmptyState>Henüz duyuru yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Başlık</Th>
                  <Th>Kitle</Th>
                  <Th>Onay</Th>
                  <Th>Yayın</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {announcements.map((row) => (
                  <tr key={row.id}>
                    <Td>{row.title}</Td>
                    <Td className="text-xs">{AUDIENCE_LABELS[row.audience] ?? row.audience}</Td>
                    <Td className="text-xs">{row.requiresAcknowledgement ? "Gerekli" : "—"}</Td>
                    <Td className="text-xs">
                      {row.publishedAt ? formatDate(row.publishedAt) : "Taslak"}
                    </Td>
                    <Td className="space-x-2 text-right whitespace-nowrap">
                      {!row.publishedAt && (
                        <ActionButton
                          action={publishAnnouncementAction}
                          csrfToken={csrfToken}
                          label="Yayınla"
                          fields={{ announcementId: row.id }}
                          confirmMessage="Duyuru yayınlanacak. Devam edilsin mi?"
                        />
                      )}
                      {row.publishedAt && (
                        <a
                          href={`/editor/announcements?report=${row.id}`}
                          className="text-xs text-accent underline"
                        >
                          Okunma raporu
                        </a>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {reportRows && (
          <Card>
            <h2 className="mb-4 font-serif text-lg">Okunma raporu</h2>

            <Table>
              <thead>
                <tr>
                  <Th>Kişi</Th>
                  <Th>Rol</Th>
                  <Th>Okundu</Th>
                  <Th>Onaylandı</Th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={row.userId}>
                    <Td>{row.displayName}</Td>
                    <Td className="text-xs">{row.role}</Td>
                    <Td className="text-xs">{row.readAt ? formatDateTime(row.readAt) : "—"}</Td>
                    <Td className="text-xs">
                      {row.acknowledgedAt ? formatDateTime(row.acknowledgedAt) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
