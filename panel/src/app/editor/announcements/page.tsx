import { guardAdminWithinEditor } from "@/lib/auth/guard";
import { listAllAnnouncements, readReport } from "@/services/announcements";
import { readCsrfToken } from "@/lib/csrf";
import { PageHeader } from "@/components/ui";
import { AnnouncementsAdminPanel } from "@/components/announcements-admin";
import { createAnnouncementAction, publishAnnouncementAction } from "../actions";

export const metadata = { title: "Duyurular" };

export default async function EditorAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  const { user } = await guardAdminWithinEditor();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { report } = await searchParams;

  const announcements = await listAllAnnouncements({ ...user });
  const reportRows = report ? await readReport({ ...user }, report) : null;

  return (
    <>
      <PageHeader title="Duyurular" description="Yazarlara ve ekibe duyuru yayınlayın." />

      <AnnouncementsAdminPanel
        csrfToken={csrfToken}
        actions={{
          create: createAnnouncementAction,
          publish: publishAnnouncementAction,
        }}
        reportBasePath="/editor/announcements"
        announcements={announcements}
        reportRows={reportRows}
      />
    </>
  );
}