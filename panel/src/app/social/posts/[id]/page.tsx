import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { getPostThread } from "@/services/posts";
import { getMemberSettings } from "@/services/social";
import { Card, PageHeader } from "@/components/ui";
import { PostCard, PostComposer, PostList } from "@/components/social";

export const metadata = { title: "Gönderi" };

export default async function PostThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { id } = await params;

  const [thread, settings] = await Promise.all([
    getPostThread({ ...user }, id).catch((error: unknown) => {
      if (isAppError(error) && error.status === 404) notFound();
      throw error;
    }),
    getMemberSettings({ ...user }),
  ]);

  return (
    <>
      <PageHeader title="Gönderi" />

      <div className="space-y-6">
        <Card>
          {thread.parent && (
            <div className="border-l-2 border-line pl-3 opacity-80">
              <PostCard post={thread.parent} csrfToken={csrfToken} />
            </div>
          )}
          <PostCard post={thread.post} csrfToken={csrfToken} />
        </Card>

        <Card>
          {settings.username ? (
            <PostComposer csrfToken={csrfToken} replyToId={thread.post.id} />
          ) : (
            <p className="text-sm text-muted">
              Yanıt yazmak için{" "}
              <Link href="/social/settings" className="text-accent">
                bir kullanıcı adı seçin
              </Link>
              .
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-serif text-lg">Yanıtlar ({thread.replies.length})</h2>
          <PostList posts={thread.replies} csrfToken={csrfToken} empty="Henüz yanıt yok." />
        </Card>
      </div>
    </>
  );
}
