import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { listPublishedIssues, listRecentArticles } from "@/services/public";
import { ArticleCard } from "@/components/magazine";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Dergi" };

/**
 * Where a reader lands after signing in: the newest writing, then the issues.
 *
 * `?verified=1` is how the e-mail verification screen says welcome, since that
 * is where a reader is sent once the address is confirmed (D-034).
 */
export default async function MagazinePage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  await requireSession();
  const params = await searchParams;

  const [recent, issues] = await Promise.all([listRecentArticles(10), listPublishedIssues()]);

  return (
    <>
      <PageHeader title="postscript" description="Ayda iki sayı, yalnızca burada." />

      <div className="space-y-6">
        {params.verified && (
          <Alert tone="success" title="Hoş geldiniz">
            E-posta adresiniz doğrulandı, hesabınız kullanıma hazır.
          </Alert>
        )}

        <Card>
          <h2 className="font-serif text-lg">Son yazılar</h2>
          <div className="mt-2">
            {recent.length === 0 ? (
              <EmptyState>Henüz yayınlanmış bir yazı yok. İlk sayı yolda.</EmptyState>
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
      </div>
    </>
  );
}
