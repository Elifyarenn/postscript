import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { listPublishedIssues, listRecentArticles } from "@/services/public";
import { ArticleCard } from "@/components/magazine";
import { SiteTitle } from "@/components/site-ui";
import { Alert, Card, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Dergi" };

/**
 * Where a reader lands after signing in: the newest writing, then the issues.
 *
 * `?verified=1` is how the e-mail verification screen says welcome, since that
 * is where a reader is sent once the address is confirmed (D-034). `?q=` comes
 * from the header's search box and `?kategori=` from the front page's writing
 * areas (D-112).
 */
export default async function MagazinePage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; q?: string; kategori?: string }>;
}) {
  await requireSession();
  const params = await searchParams;

  const query = params.q?.trim().slice(0, 100) || undefined;
  const category = params.kategori?.trim().slice(0, 100) || undefined;
  const filtering = Boolean(query || category);

  const [recent, issues] = await Promise.all([
    listRecentArticles(filtering ? 50 : 10, { query, category }),
    listPublishedIssues(),
  ]);

  const listTitle = query ? `“${query}” için sonuçlar` : (category ?? "Son yazılar");

  return (
    <>
      <SiteTitle description="Ayda iki sayı, yalnızca burada.">Dergi</SiteTitle>

      <div className="space-y-6">
        {params.verified && (
          <Alert tone="success" title="Hoş geldiniz">
            E-posta adresiniz doğrulandı, hesabınız kullanıma hazır.
          </Alert>
        )}

        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-lg">{listTitle}</h2>
            {filtering && (
              <Link href="/magazine" className="text-sm text-accent hover:underline">
                Tüm yazılar
              </Link>
            )}
          </div>
          {query && category && <p className="text-sm text-muted">Kategori: {category}</p>}
          <div className="mt-2">
            {recent.length === 0 ? (
              <EmptyState>
                {filtering
                  ? "Bu aramaya uyan yayımlanmış bir yazı yok."
                  : "Henüz yayınlanmış bir yazı yok. İlk sayı yolda."}
              </EmptyState>
            ) : (
              recent.map((article) => (
                <ArticleCard
                  key={article.slug}
                  title={article.title}
                  slug={article.slug}
                  summary={article.summary}
                  author={article.authorName}
                  authorSlug={article.authorSlug}
                  issueNumber={article.issueNumber}
                  publishedAt={article.publishedAt}
                />
              ))
            )}
          </div>
        </Card>

        {!filtering && (
          <Card>
            <h2 className="font-serif text-lg">Sayılar</h2>
            <div className="mt-3">
              {issues.length === 0 ? (
                <EmptyState>Yayınlanmış sayı yok.</EmptyState>
              ) : (
                <ul className="space-y-3">
                  {issues.map((issue) => (
                    <li key={issue.number}>
                      <Link
                        href={`/magazine/issues/${issue.number}`}
                        className="block rounded-md border border-line px-4 py-3 hover:bg-paper"
                      >
                        <span className="text-xs tracking-widest text-muted uppercase">
                          Sayı {issue.number}
                        </span>
                        <span className="mt-0.5 block font-serif text-base">{issue.title}</span>
                        {issue.theme && (
                          <span className="block text-sm text-muted">{issue.theme}</span>
                        )}
                        {issue.publishedAt && (
                          <span className="mt-1 block text-xs text-muted">
                            {formatDate(issue.publishedAt)}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
