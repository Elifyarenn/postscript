import { Suspense } from "react";
import Link from "next/link";
import communityBanner from "@/assets/design/banner-community.webp";
import { requireSession } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { COMMUNITY_TABS, communityTabHref, parseCommunityTab } from "@/lib/site";
import { listCommunities } from "@/services/communities";
import { listExplorePosts, listHomeFeed, suggestMembers } from "@/services/posts";
import { getMemberSettings } from "@/services/social";
import { Alert, Card, EmptyState } from "@/components/ui";
import { CommunityCard } from "@/components/communities";
import { PostComposer, PostList } from "@/components/social";
import { SiteBanner } from "@/components/site-ui";
import { MemberSuggestions, MemberSuggestionsFallback } from "./member-suggestions";

export const metadata = { title: "Topluluk" };

const INTRO = {
  akis: "Sizin ve takip ettiğiniz üyelerin gönderileri.",
  kesfet: "Son 30 günün gönderileri: en çok beğenilen, sonra en çok paylaşılan, sonra en yeni.",
  topluluklar:
    "Konulara göre gruplar. Katıldığınız toplulukta gönderi paylaşabilirsiniz; üye listeleri gösterilmez.",
} as const;

/**
 * The community in one place (D-178): the feed, Keşfet and the topic groups
 * used to be three pages reached from small links under the member menu. The
 * designs' menu has no such links, so they are tabs of the header's "Topluluk".
 */
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>;
}) {
  const [{ user }, csrf, params] = await Promise.all([requireSession(), readCsrfToken(), searchParams]);
  const csrfToken = csrf ?? "";
  const tab = parseCommunityTab(params.sekme);
  const { username } = await getMemberSettings({ ...user });

  return (
    <>
      <SiteBanner title="Topluluk" subtitle="Paylaş, keşfet, katıl" image={communityBanner} />

      <div className="community-bar fit-line">
        <nav className="site-tabs" aria-label="Topluluk bölümleri">
          {COMMUNITY_TABS.map((item) => (
            <Link
              key={item.key}
              href={communityTabHref(item.key)}
              aria-current={item.key === tab ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <p className="community-intro">{INTRO[tab]}</p>

      {tab === "akis" &&
        (username ? (
          <FeedTab user={user} csrfToken={csrfToken} />
        ) : (
          <Alert tone="info" title="Önce bir kullanıcı adı seçin">
            Toplulukta ad soyadınız yerine kullanıcı adınız görünür. Paylaşmak, takip etmek ve
            takip edilmek için bir kullanıcı adı gerekir.{" "}
            <Link href="/social/settings" className="underline">
              Kullanıcı adı seçin
            </Link>
            .
          </Alert>
        ))}
      {tab === "kesfet" && <ExploreTab user={user} csrfToken={csrfToken} />}
      {tab === "topluluklar" && (
        <CommunitiesTab user={user} csrfToken={csrfToken} canJoin={username !== null} />
      )}
    </>
  );
}

type TabProps = { user: SessionUser; csrfToken: string };

async function FeedTab({ user, csrfToken }: TabProps) {
  // Started first so it runs beside the feed rather than after it (D-172)
  const suggestions = suggestMembers({ ...user });
  const feed = await listHomeFeed({ ...user });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div className="min-w-0 space-y-6">
        <Card>
          <PostComposer csrfToken={csrfToken} />
        </Card>

        <Card>
          <PostList
            posts={feed}
            csrfToken={csrfToken}
            empty="Akışınız boş. Keşfet sekmesinden takip edecek üyeler bulabilirsiniz."
          />
        </Card>
      </div>

      {/* Someone new has nobody to follow yet; the suggestions give them a start (D-139) */}
      <Suspense fallback={<MemberSuggestionsFallback />}>
        <MemberSuggestions
          suggestions={suggestions}
          csrfToken={csrfToken}
          description="Toplulukta kullanıcı adı seçmiş üyeler."
        />
      </Suspense>
    </div>
  );
}

async function ExploreTab({ user, csrfToken }: TabProps) {
  const suggestions = suggestMembers({ ...user });
  const popular = await listExplorePosts({ ...user });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <Card>
        <PostList posts={popular} csrfToken={csrfToken} empty="Son 30 günde paylaşılmış gönderi yok." />
      </Card>

      <Suspense fallback={<MemberSuggestionsFallback />}>
        <MemberSuggestions
          suggestions={suggestions}
          csrfToken={csrfToken}
          description="Takip ettiklerinizin takip ettikleri, en çok takip edilenler ve kullanıcı adı seçmiş yeni üyeler."
        />
      </Suspense>
    </div>
  );
}

async function CommunitiesTab({ user, csrfToken, canJoin }: TabProps & { canJoin: boolean }) {
  const list = await listCommunities({ ...user });

  if (list.length === 0) return <EmptyState>Henüz topluluk açılmadı.</EmptyState>;
  return (
    <Card>
      <ul className="divide-y divide-line">
        {list.map((community) => (
          <CommunityCard key={community.id} community={community} csrfToken={csrfToken} canJoin={canJoin} />
        ))}
      </ul>
    </Card>
  );
}
