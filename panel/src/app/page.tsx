import { getAuthContext } from "@/lib/auth/session";
import { StaleSessionCleaner } from "@/components/stale-session";
import { pageMetadata } from "@/lib/seo";
import { HomeView } from "@/components/public-views/home";

export const metadata = pageMetadata({ path: "/" });

/**
 * The magazine front page, for everyone (D-086). The header offers the
 * account, the panel and the member menu when there is a session (D-112).
 * A visitor without one is served the cached copy under /anon (D-351).
 */
export default async function HomePageRoute() {
  const context = await getAuthContext();
  return (
    <>
      <StaleSessionCleaner />
      <HomeView user={context?.user ?? null} />
    </>
  );
}
