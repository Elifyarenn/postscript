import { getAuthContext } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { pageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/services/site-settings";
import { SiteJsonLd } from "@/components/site-json-ld";
import { issueExtrasFor } from "@/lib/issue-extras";
import { listPublishedIssues } from "@/services/public";
import { listWriterAreasWithQuota } from "@/services/writer-areas";
import { HomePage, type HomeIssue } from "@/components/homepage";
import { SiteShell } from "@/components/site-shell";

export const metadata = pageMetadata({ path: "/" });

/** The issue the designs announce, shown until the first issue is published. */
const FIRST_ISSUE: HomeIssue = {
  number: 1,
  published: false,
  title: "Obsession",
  titleLang: "en",
  theme: "Bırakamadıklarımız",
  href: "/magazine",
};

/**
 * The magazine front page, for everyone (D-086). The header offers the
 * account, the panel and the member menu when there is a session (D-112).
 */
export default async function HomePageRoute() {
  const [context, issues, areas, settings] = await Promise.all([
    getAuthContext(),
    listPublishedIssues(),
    listWriterAreasWithQuota(),
    getSiteSettings(),
  ]);

  const latest = issues[0];
  const issue: HomeIssue = latest
    ? {
        number: latest.number,
        published: true,
        title: latest.title,
        titleLang: issueExtrasFor(latest.number)?.titleLang,
        theme: latest.theme,
        href: `/magazine/issues/${latest.number}`,
      }
    : FIRST_ISSUE;

  return (
    <SiteShell user={context?.user ?? null} bleed>
      <SiteJsonLd siteUrl={env().SITE_URL} settings={settings} />
      <HomePage
        issue={issue}
        areas={areas.map((area) => area.name)}
        extras={issueExtrasFor(issue.number)}
        // Banned accounts get no member menu either (SiteShell), so no player
        member={Boolean(context?.user && !context.user.isBanned)}
      />
    </SiteShell>
  );
}
