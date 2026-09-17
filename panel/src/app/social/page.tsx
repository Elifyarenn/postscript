import Link from "next/link";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { getMemberSettings } from "@/services/social";
import { listHomeFeed, suggestMembers } from "@/services/posts";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PostComposer, PostList } from "@/components/social";
import { MemberSuggestions, MemberSuggestionsFallback } from "./member-suggestions";

export const metadata = { title: "Topluluk" };

/** The feed: the member's own posts and those of the people they follow. */
export default async function SocialHomePage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { username } = await getMemberSettings({ ...user });

  const exploreLink = (
    <Link href="/social/explore" className="text-sm text-accent">
      Keşfet
    </Link>
  );

  if (!username) {
    return (
      <>
        <PageHeader title="Topluluk" actions={exploreLink} />
        <Alert tone="info" title="Önce bir kullanıcı adı seçin">
          Toplulukta ad soyadınız yerine kullanıcı adınız görünür. Paylaşmak, takip etmek ve
          takip edilmek için bir kullanıcı adı gerekir.{" "}
          <Link href="/social/settings" className="underline">
            Kullanıcı adı seçin
          </Link>
          .
        </Alert>
      </>
    );
  }

  const suggestions = suggestMembers({ ...user });
  const feed = await listHomeFeed({ ...user });

  return (
    <>
      <PageHeader
        title="Akış"
        description="Sizin ve takip ettiğiniz üyelerin gönderileri."
        actions={exploreLink}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <PostComposer csrfToken={csrfToken} />
          </Card>

          <Card>
            <PostList
              posts={feed}
              csrfToken={csrfToken}
              empty="Akışınız boş. Keşfet sayfasından takip edecek üyeler bulabilirsiniz."
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
    </>
  );
}
