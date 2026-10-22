import { IssueView } from "@/components/public-views/issue";

export { generateMetadata } from "@/components/public-views/issue";

// Visitors without a session, from the CDN. Only published issues render here:
// `readIssuePages` answers 404 to a reader without a session (D-351)
export const revalidate = 60;

// Nothing is drawn at build time, so the build never needs the database; each
// address is drawn on its first visit and then cached
export function generateStaticParams(): { number: string }[] {
  return [];
}

export default function AnonymousIssuePage({ params }: { params: Promise<{ number: string }> }) {
  return <IssueView params={params} user={null} />;
}
