import { Suspense } from "react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { listExplorePosts, suggestMembers } from "@/services/posts";
import { Card, PageHeader } from "@/components/ui";
import { PostList } from "@/components/social";
import { MemberSuggestions, MemberSuggestionsFallback } from "../member-suggestions";

export const metadata = { title: "Keşfet" };

/** Rule-based, no ML (CLAUDE.md): last thirty days, most liked first. */
export default async function ExplorePage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";

  const suggestions = suggestMembers({ ...user });
  const popular = await listExplorePosts({ ...user });

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

        <Suspense fallback={<MemberSuggestionsFallback />}>
          <MemberSuggestions
            suggestions={suggestions}
            csrfToken={csrfToken}
            description="Takip ettiklerinizin takip ettikleri, en çok takip edilenler ve kullanıcı adı seçmiş yeni üyeler."
          />
        </Suspense>
      </div>
    </>
  );
}
