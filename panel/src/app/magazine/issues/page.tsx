import { readerSession } from "@/lib/auth/guard";
import { pageMetadata } from "@/lib/seo";
import { IssuesView } from "@/components/public-views/issues";

export const metadata = pageMetadata({
  title: "Sayılar",
  description: "PostScript Dergi'nin yayımlanan bütün sayıları, en yeniden eskiye.",
  path: "/magazine/issues",
});

/** Every published issue (D-114). Visitors without a session get the cached copy under /anon (D-351). */
export default async function IssuesPage() {
  const context = await readerSession();
  return <IssuesView user={context?.user ?? null} />;
}
