import { notFound } from "next/navigation";
import { guardWriterInnerPages } from "@/lib/auth/guard";
import { getArticleVersion } from "@/services/articles";
import { ArticleVersionView } from "@/components/article-version";

export const metadata = { title: "Sürüm" };

/** An earlier version of the writer's own article (D-108). */
export default async function WriterArticleVersionPage({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { user } = await guardWriterInnerPages();
  const { id, version: rawVersion } = await params;

  const { article, version, previous } = await getArticleVersion({ ...user }, id, rawVersion);
  // The writer area only ever shows the writer's own articles, as the article page does;
  // a hybrid editor reads other people's versions from the editor area instead
  if (article.authorId !== user.id) notFound();

  return (
    <ArticleVersionView
      articleTitle={article.title}
      version={version}
      previous={previous}
      backHref={`/writer/articles/${article.id}`}
    />
  );
}
