import { AboutView, parseSection } from "@/components/public-views/about";

export { metadata } from "@/app/hakkinda/page";

// `/hakkinda?bolum=…` for visitors without a session; the rewrite moves the
// query into the path so each section is its own cached page (D-351)
export const revalidate = 60;

// Nothing is drawn at build time, so the build never needs the database; each
// address is drawn on its first visit and then cached
export function generateStaticParams(): { bolum: string }[] {
  return [];
}

export default async function AnonymousAboutSectionPage({ params }: { params: Promise<{ bolum: string }> }) {
  return <AboutView user={null} section={parseSection((await params).bolum)} />;
}
