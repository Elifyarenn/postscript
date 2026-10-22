import AuthorPage from "@/app/magazine/authors/[slug]/page";

export { generateMetadata } from "@/app/magazine/authors/[slug]/page";

// The author page reads no session; only its layout did (D-351)
export const revalidate = 60;

// Nothing is drawn at build time, so the build never needs the database; each
// address is drawn on its first visit and then cached
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export default function AnonymousAuthorPage(props: { params: Promise<{ slug: string }> }) {
  return <AuthorPage {...props} />;
}
