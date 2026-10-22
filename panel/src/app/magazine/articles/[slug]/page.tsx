import { readerSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { ArticleView } from "@/components/public-views/article";

export { generateMetadata } from "@/components/public-views/article";

/**
 * One published article (D-257). Comments and bookmarks are the members' part
 * and need the session and the form token, so the page is drawn per request
 * for a member; a visitor without a session gets the cached copy under /anon
 * (D-351), which carries neither.
 */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const [context, csrfToken] = await Promise.all([readerSession(), readCsrfToken().then((token) => token ?? "")]);
  return <ArticleView params={params} user={context?.user ?? null} csrfToken={csrfToken} />;
}
