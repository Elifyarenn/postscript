import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { listCommunities } from "@/services/communities";
import { getMemberSettings } from "@/services/social";
import communityBanner from "@/assets/design/banner-community.webp";
import { Card, EmptyState } from "@/components/ui";
import { SiteBanner } from "@/components/site-ui";
import { CommunityCard } from "@/components/communities";

export const metadata = { title: "Topluluklar" };

export default async function CommunitiesPage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const [list, settings] = await Promise.all([listCommunities({ ...user }), getMemberSettings({ ...user })]);

  return (
    <>
      {/* The community collage belongs to this page: the feed and the member screens keep the designs' own headings (D-175) */}
      <SiteBanner title="Topluluklar" subtitle="Konulara göre gruplar" image={communityBanner} />
      <p className="community-intro">
        Katıldığınız toplulukta gönderi paylaşabilirsiniz; üye listeleri gösterilmez.
      </p>

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
