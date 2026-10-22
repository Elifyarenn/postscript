import { readerSession } from "@/lib/auth/guard";
import { IssueView } from "@/components/public-views/issue";

export { generateMetadata } from "@/components/public-views/issue";

/**
 * One issue's own page (D-234). With a session it is drawn per request, so the
 * editorial team sees an unpublished issue; a visitor without one gets the
 * cached copy under /anon (D-351).
 */
export default async function IssuePage({ params }: { params: Promise<{ number: string }> }) {
  const context = await readerSession();
  return <IssueView params={params} user={context?.user ?? null} />;
}
