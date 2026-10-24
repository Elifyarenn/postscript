import { pageMetadata } from "@/lib/seo";
import { getAuthContext } from "@/lib/auth/session";
import { StaleSessionCleaner } from "@/components/stale-session";
import { CategoriesView } from "@/components/public-views/categories";

export const metadata = pageMetadata({
  title: "Kategoriler",
  description:
    "PostScript Dergi'nin yazı alanları ve kategorileri.",
  path: "/kategoriler",
});

/** Writing areas (D-134). A visitor without a session gets the cached copy under /anon (D-351). */
export default async function CategoriesPage() {
  const context = await getAuthContext();
  return (
    <>
      <StaleSessionCleaner />
      <CategoriesView user={context?.user ?? null} />
    </>
  );
}
