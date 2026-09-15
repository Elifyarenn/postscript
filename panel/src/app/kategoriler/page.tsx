import { getAuthContext } from "@/lib/auth/session";
import { listCategoryCounts } from "@/services/public";
import { listWriterAreasWithQuota } from "@/services/writer-areas";
import { CategoryCard } from "@/components/category-card";
import { SiteShell } from "@/components/site-shell";
import { SiteBanner } from "@/components/site-ui";

export const metadata = { title: "Kategoriler" };

/**
 * Every writing area on one page (D-134), in the admin's order, with its photo
 * and how many articles it has. Public like the front page; the articles
 * behind each card still ask for a session.
 */
export default async function CategoriesPage() {
  const [context, areas, counts] = await Promise.all([
    getAuthContext(),
    listWriterAreasWithQuota(),
    listCategoryCounts(),
  ]);
  const countFor = new Map(counts.map((row) => [row.category, row.count]));

  return (
    <SiteShell user={context?.user ?? null} bleed>
      <SiteBanner title="Kategoriler" subtitle="Dergideki tüm yazı alanları" />

      <section className="categories-page" aria-label="Tüm kategoriler">
        {areas.length === 0 ? (
          <p className="home-empty">Yazı alanları çok yakında burada.</p>
        ) : (
          <ul className="category-grid">
            {areas.map((area, index) => (
              <li key={area.id}>
                <CategoryCard
                  name={area.name}
                  index={index}
                  count={countFor.get(area.name) ?? 0}
                  sizes="(min-width: 1100px) 18rem, (min-width: 640px) 45vw, 90vw"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteShell>
  );
}
