import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { listExplorePosts, suggestMembers } from "@/services/posts";
import { Card, PageHeader } from "@/components/ui";
import { MemberList, PostList } from "@/components/social";

export const metadata = { title: "Keşfet" };

/** Rule-based, no ML (CLAUDE.md): last thirty days, most liked first. */
export default async function ExplorePage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";

  const [popular, suggestions] = await Promise.all([
    listExplorePosts({ ...user }),
    suggestMembers({ ...user }),
  ]);

  return (
    <>
      <PageHeader
        title="Keşfet"
        description="Son 30 günün gönderileri: en çok beğenilen, sonra en çok paylaşılan, sonra en yeni."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <Card>
          <PostList posts={popular} csrfToken={csrfToken} empty="Son 30 günde paylaşılmış gönderi yok." />
        </Card>

        <Card className="h-fit">
          <h2 className="mb-1 font-serif text-base">Tanıyor olabilirsiniz</h2>
          <p className="mb-2 text-xs text-muted">
            Takip ettiklerinizin takip ettikleri; yoksa en çok takip edilenler.
          </p>
          {suggestions.length === 0 ? (
            <p className="py-4 text-sm text-muted">Şimdilik öneri yok.</p>
          ) : (
            <MemberList members={suggestions} />
          )}
        </Card>
      </div>
    </>
  );
}
