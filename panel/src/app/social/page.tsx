import { Suspense } from "react";
import Link from "next/link";
import communityBanner from "@/assets/design/banner-community.webp";
import { requireSession } from "@/lib/auth/guard";
import { canModerateCommunity } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { COMMUNITY_TABS, communityTabHref, parseCommunityTab } from "@/lib/site";
import { USERNAME_MAX } from "@/lib/username";
import { listCommunities } from "@/services/communities";
import { listExplorePosts, listHomeFeed, suggestMembers } from "@/services/posts";
import { getMemberSettings, searchMembers } from "@/services/social";
import { Alert, Card, EmptyState, Input } from "@/components/ui";
import { CommunityCard } from "@/components/communities";
import { MemberList, PostComposer, PostList } from "@/components/social";
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
  searchParams: Promise<{ sekme?: string; ara?: string }>;
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
      {tab === "kesfet" && (
        <ExploreTab user={user} csrfToken={csrfToken} query={(params.ara ?? "").slice(0, 40)} />
      )}
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
            canModerate={canModerateCommunity(user)}
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

async function ExploreTab({ user, csrfToken, query }: TabProps & { query: string }) {
  const suggestions = suggestMembers({ ...user });
  const [popular, found] = await Promise.all([
    listExplorePosts({ ...user }),
    query ? searchMembers({ ...user }, query) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      {/* A plain GET form: searching changes nothing (D-186) */}
      <form action="/social" method="get" role="search" className="flex flex-wrap gap-2">
        <input type="hidden" name="sekme" value="kesfet" />
        <label htmlFor="member-search" className="sr-only">
          Kullanıcı adıyla üye ara
        </label>
        <Input
          id="member-search"
          name="ara"
          type="search"
          defaultValue={query}
          maxLength={USERNAME_MAX + 1}
          placeholder="Kullanıcı adıyla üye ara…"
          autoComplete="off"
          className="min-w-0 flex-1"
        />
        <button type="submit" className="site-button">
          Ara
        </button>
      </form>

      {found && (
        <Card>
          <h2 className="mb-2 font-serif text-base">&ldquo;{query}&rdquo; için üyeler</h2>
          {found.length === 0 ? (
            <p className="py-4 text-sm text-muted">
              Bu adla bir üye bulunamadı. En az iki harf yazın; yalnızca kullanıcı adlarında aranır.
            </p>
          ) : (
            <MemberList members={found} />
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <Card>
          <PostList
            posts={popular}
            csrfToken={csrfToken}
            empty="Son 30 günde paylaşılmış gönderi yok."
            canModerate={canModerateCommunity(user)}
          />
        </Card>

        <Suspense fallback={<MemberSuggestionsFallback />}>
          <MemberSuggestions
            suggestions={suggestions}
            csrfToken={csrfToken}
            description="Takip ettiklerinizin takip ettikleri, en çok takip edilenler ve kullanıcı adı seçmiş yeni üyeler."
          />
        </Suspense>
      </div>
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
