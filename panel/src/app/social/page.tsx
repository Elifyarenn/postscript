import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { getMemberSettings } from "@/services/social";
import { listHomeFeed } from "@/services/posts";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PostComposer, PostList } from "@/components/social";

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

  const feed = await listHomeFeed({ ...user });

  return (
    <>
      <PageHeader
        title="Akış"
        description="Sizin ve takip ettiğiniz üyelerin gönderileri."
        actions={exploreLink}
      />

      <div className="space-y-6">
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
    </>
  );
}
