import { getAuthContext } from "@/lib/auth/session";
import { listWriterAreasWithQuota } from "@/services/writer-areas";
import { CategoryCard } from "@/components/category-card";
import { SiteShell } from "@/components/site-shell";
import { SiteBanner } from "@/components/site-ui";

export const metadata = { title: "Kategoriler" };

/**
 * Every writing area on one page (D-134), drawn as the designs draw it (D-146):
 * the photo, the name, the topics it covers and an invitation to look. Public
 * like the front page; the articles behind each card still ask for a session.
 */
export default async function CategoriesPage() {
  const [context, areas] = await Promise.all([getAuthContext(), listWriterAreasWithQuota()]);

  return (
    <SiteShell user={context?.user ?? null} bleed>
      <SiteBanner title="Kategoriler" subtitle="Seni harekete geçireni bul" />

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
                  detailed
                  sizes="(min-width: 1000px) 22vw, (min-width: 560px) 45vw, 90vw"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteShell>
  );
}
