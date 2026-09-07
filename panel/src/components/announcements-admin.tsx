/**
 * The announcements authoring surface, shared by the editor and admin panels:
 * a create form with audience and severity, the announcement list, and the
 * read/acknowledgement report of a published announcement.
 */
import { ActionButton, PanelForm } from "@/components/form";
import {
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ServerAction } from "@/components/form";

const AUDIENCE_LABELS: Record<string, string> = {
  writers: "Yazarlar",
  editors: "Editörler",
  all_staff: "Tüm ekip",
};

export type AnnouncementRow = {
  id: string;
  title: string;
  audience: "writers" | "editors" | "all_staff";
  severity: "info" | "important" | "critical";
  requiresAcknowledgement: boolean;
  pinned: boolean;
  publishedAt: Date | null;
  createdAt: Date;
};

export type ReportRow = {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  readAt: Date | null;
  acknowledgedAt: Date | null;
};

export function AnnouncementsAdminPanel({
  csrfToken,
  actions,
  reportBasePath,
  announcements,
  reportRows,
}: {
  csrfToken: string;
  actions: { create: ServerAction; publish: ServerAction };
  reportBasePath: string;
  announcements: AnnouncementRow[];
  reportRows: ReportRow[] | null;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-4 font-serif text-lg">Yeni duyuru</h2>

        <PanelForm action={actions.create} csrfToken={csrfToken} submitLabel="Taslak oluştur">
          <Field label="Başlık" htmlFor="title">
            <Input id="title" name="title" required maxLength={200} />
          </Field>

          <Field label="Metin (markdown)" htmlFor="bodyMarkdown">
            <Textarea id="bodyMarkdown" name="bodyMarkdown" rows={8} required />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hedef kitle" htmlFor="audience">
              <Select id="audience" name="audience" defaultValue="writers">
                <option value="writers">Yazarlar</option>
                <option value="editors">Editörler</option>
                <option value="all_staff">Tüm ekip</option>
              </Select>
            </Field>

            <Field label="Önem seviyesi" htmlFor="severity">
              <Select id="severity" name="severity" defaultValue="info">
                <option value="info">Bilgilendirme</option>
                <option value="important">Önemli</option>
                <option value="critical">Kritik</option>
              </Select>
            </Field>
          </div>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="requiresAcknowledgement"
              className="size-4 rounded border-line"
            />
            Onay gerektirir (onaylanmadan yazar paneli açılmaz)
          </label>
          <p className="text-xs text-muted">
            Kritik seviyedeki duyurular her zaman onay gerektirir; kutu işaretli
            olmasa da zorunludur.
          </p>

          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" name="pinned" className="size-4 rounded border-line" />
            Listenin en üstüne sabitle
          </label>
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
                <Th>Seviye</Th>
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
                  <Td>
                    <StatusBadge status={row.severity} />
                  </Td>
                  <Td className="text-xs">{AUDIENCE_LABELS[row.audience] ?? row.audience}</Td>
                  <Td className="text-xs">
                    {row.requiresAcknowledgement ? "Gerekli" : "—"}
                  </Td>
                  <Td className="text-xs">
                    {row.publishedAt ? formatDate(row.publishedAt) : "Taslak"}
                  </Td>
                  <Td className="space-x-2 text-right whitespace-nowrap">
                    {!row.publishedAt && (
                      <ActionButton
                        action={actions.publish}
                        csrfToken={csrfToken}
                        label="Yayınla"
                        fields={{ announcementId: row.id }}
                        confirmMessage="Duyuru yayınlanacak. Devam edilsin mi?"
                      />
                    )}
                    {row.publishedAt && (
                      <a
                        href={`${reportBasePath}?report=${row.id}`}
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
  );
}