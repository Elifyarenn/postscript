/**
 * Ordering rules for the community lists (D-090).
 *
 * CLAUDE.md rules out ML recommendations, so every order here is a plain rule
 * that can be read, tested and explained to a member.
 */

/** One line of a timeline: a post, surfacing at the moment of the activity. */
export type TimelineEntry = { postId: string; at: Date };

/**
 * Newest activity first, each post once. A post reposted after it was posted
 * surfaces at the repost, which is the later of the two.
 */
export function mergeTimeline<T extends TimelineEntry>(entries: readonly T[], limit: number): T[] {
  const sorted = [...entries].sort((a, b) => b.at.getTime() - a.at.getTime());
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const entry of sorted) {
    if (seen.has(entry.postId)) continue;
    seen.add(entry.postId);
    merged.push(entry);
    if (merged.length === limit) break;
  }
  return merged;
}

export type RankablePost = { likeCount: number; repostCount: number; createdAt: Date };

/** Explore: most liked, then most reposted, then newest. */
export function rankExplorePosts<T extends RankablePost>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      b.likeCount - a.likeCount ||
      b.repostCount - a.repostCount ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/**
 * Member suggestions: the people followed by the people you follow, ranked by
 * how many of those follow them. Ties keep the order they were first seen in.
 */
export function rankSuggestions(
  secondDegree: readonly string[],
  exclude: ReadonlySet<string>,
): string[] {
  const counts = new Map<string, number>();
  for (const id of secondDegree) {
    if (exclude.has(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
