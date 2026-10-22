import { ReaderView } from "@/components/public-views/reader";

export const metadata = { title: "Dergi", robots: { index: false, follow: false } };

// Visitors without a session opening an issue plainly, from the CDN (D-354).
// Only a published issue renders: `readIssuePages` answers 404 without a session
export const revalidate = 60;

// Nothing is drawn at build time, so the build never needs the database
export function generateStaticParams(): { number: string }[] {
  return [];
}

export default async function AnonymousReaderPage({ params }: { params: Promise<{ number: string }> }) {
  return <ReaderView number={(await params).number} user={null} startPageId={null} />;
}
