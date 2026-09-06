import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { listPublishedIssues } from "@/services/public";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sayılar" };

/** Every published issue, newest first. */
export default async function IssuesPage() {
  await requireSession();
  const issues = await listPublishedIssues();

  return (
    <>
      <PageHeader title="Sayılar" description="Yayınlanmış bütün sayılar." />

      {issues.length === 0 ? (
        <EmptyState>Yayınlanmış sayı yok.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {issues.map((issue) => (
            <Card key={issue.number}>
              <span className="text-xs tracking-widest text-muted uppercase">
                Sayı {issue.number}
              </span>
              <h2 className="mt-1 font-serif text-lg">
                <Link href={`/magazine/issues/${issue.number}`} className="hover:text-accent">
                  {issue.title}
                </Link>
              </h2>
              {issue.theme && <p className="mt-1 text-sm text-muted">{issue.theme}</p>}
              {issue.publishedAt && (
                <p className="mt-2 text-xs text-muted">{formatDate(issue.publishedAt)}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
