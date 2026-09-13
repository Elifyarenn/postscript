import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { listCommunities } from "@/services/communities";
import { getMemberSettings } from "@/services/social";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { CommunityCard } from "@/components/communities";

export const metadata = { title: "Topluluklar" };

export default async function CommunitiesPage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const [list, settings] = await Promise.all([listCommunities({ ...user }), getMemberSettings({ ...user })]);

  return (
    <>
      <PageHeader
        title="Topluluklar"
        description="Konulara göre gruplar. Katıldığınız toplulukta gönderi paylaşabilirsiniz; üye listeleri gösterilmez."
      />

      {list.length === 0 ? (
        <EmptyState>Henüz topluluk açılmadı.</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                csrfToken={csrfToken}
                canJoin={settings.username !== null}
              />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
