import { guardPanel } from "@/lib/auth/guard";
import { listAllAnnouncements, readReport } from "@/services/announcements";
import { readCsrfToken } from "@/lib/csrf";
import { PageHeader } from "@/components/ui";
import { AnnouncementsAdminPanel } from "@/components/announcements-admin";
import { createAnnouncementAction, publishAnnouncementAction } from "../actions";

export const metadata = { title: "Duyurular" };

/**
 * The admin's announcement module: targeted announcements (writers, editors,
 * the whole team) with a severity, and the read/acknowledgement report of
 * every published one — critical announcements require an acknowledgement.
 */
export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const { report } = await searchParams;

  const announcements = await listAllAnnouncements({ ...user });
  const reportRows = report ? await readReport({ ...user }, report) : null;

  return (
    <>
      <PageHeader
        title="Duyurular"
        description="Ekibe hedefli duyuru yayınlayın ve okundu onaylarını denetleyin."
      />

      <AnnouncementsAdminPanel
        csrfToken={csrfToken}
        actions={{
          create: createAnnouncementAction,
          publish: publishAnnouncementAction,
        }}
        reportBasePath="/admin/announcements"
        announcements={announcements}
        reportRows={reportRows}
      />
    </>
  );
}