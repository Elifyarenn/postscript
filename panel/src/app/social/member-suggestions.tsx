import type { MemberListItem } from "@/services/social";
import { Card } from "@/components/ui";
import { MemberList } from "@/components/social";

/**
 * The "you may know" column. It sits in its own Suspense boundary on the feed
 * and on Explore, so the posts are shown without waiting for it (D-172). The
 * page starts the query before its own and hands over the promise, so the two
 * still run side by side.
 */
export async function MemberSuggestions({
  suggestions: pending,
  csrfToken,
  description,
}: {
  suggestions: Promise<MemberListItem[]>;
  csrfToken: string;
  description: string;
}) {
  const suggestions = await pending;

  return (
    <Card className="h-fit">
      <h2 className="mb-1 font-serif text-base">Tanıyor olabilirsiniz</h2>
      <p className="mb-2 text-xs text-muted">{description}</p>
      {suggestions.length === 0 ? (
        <p className="py-4 text-sm text-muted">Şimdilik öneri yok.</p>
      ) : (
        <MemberList members={suggestions} followToken={csrfToken} />
      )}
    </Card>
  );
}

/** Holds the column's place while the suggestions load. */
export function MemberSuggestionsFallback() {
  return (
    <Card className="h-fit" aria-busy="true">
      <h2 className="mb-1 font-serif text-base">Tanıyor olabilirsiniz</h2>
      <p className="py-4 text-sm text-muted">Yükleniyor…</p>
    </Card>
  );
}
