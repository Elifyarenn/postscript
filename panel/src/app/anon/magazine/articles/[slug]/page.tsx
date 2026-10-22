import { ArticleView } from "@/components/public-views/article";

export { generateMetadata } from "@/components/public-views/article";

// Visitors without a session, from the CDN: no comments, no bookmark, no form
// token. A withdrawal rebuilds it at once (D-351)
export const revalidate = 60;

// Nothing is drawn at build time, so the build never needs the database; each
// address is drawn on its first visit and then cached
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export default function AnonymousArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  return <ArticleView params={params} user={null} csrfToken="" />;
}
