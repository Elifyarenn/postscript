import { pageMetadata } from "@/lib/seo";
import { getAuthContext } from "@/lib/auth/session";
import { AboutView, parseSection } from "@/components/public-views/about";

export const metadata = pageMetadata({
  title: "Hakkında",
  description:
    "Postscript, hayalperestler, aşırı düşünenler, maceracılar ve meraklı zihinler için oluşturulmuş dijital bir dergi topluluğu. Hikâyemiz, yazarlarımız ve editörlerimiz.",
  path: "/hakkinda",
});

/** Who we are (D-112). Visitors without a session get the cached copies under /anon (D-351). */
export default async function AboutPage({ searchParams }: { searchParams: Promise<{ bolum?: string }> }) {
  const [context, params] = await Promise.all([getAuthContext(), searchParams]);
  return <AboutView user={context?.user ?? null} section={parseSection(params.bolum)} />;
}
