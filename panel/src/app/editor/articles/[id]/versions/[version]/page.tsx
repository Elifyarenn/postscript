import { guardPanel } from "@/lib/auth/guard";
import { getArticleVersion } from "@/services/articles";
import { ArticleVersionView } from "@/components/article-version";

export const metadata = { title: "Sürüm" };

/** An earlier version of an article, for the editors who may read it (D-108). */
export default async function EditorArticleVersionPage({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { user } = await guardPanel("editor");
  const { id, version: rawVersion } = await params;

  // The service applies the article's read gate, including a category editor's areas
  const { article, version, previous } = await getArticleVersion({ ...user }, id, rawVersion);

  return (
    <ArticleVersionView
      articleTitle={article.title}
      version={version}
      previous={previous}
      backHref={`/editor/articles/${article.id}`}
    />
  );
}
