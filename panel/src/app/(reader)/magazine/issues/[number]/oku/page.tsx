import { readerSession } from "@/lib/auth/guard";
import { ReaderView } from "@/components/public-views/reader";

export const metadata = { title: "Dergi", robots: { index: false, follow: false } };

/**
 * The magazine reader (D-234, D-240). With a session, or opened at a page by
 * `?s=`, it is drawn per request; a visitor without a session opening the
 * issue plainly gets the cached copy under /anon/oku (D-354).
 */
export default async function IssueReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const [context, { number }, query] = await Promise.all([readerSession(), params, searchParams]);
  return <ReaderView number={number} user={context?.user ?? null} startPageId={query.s ?? null} />;
}
