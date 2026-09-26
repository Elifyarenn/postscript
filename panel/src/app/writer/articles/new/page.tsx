import Link from "next/link";
import { guardWriterInnerPages } from "@/lib/auth/guard";
import { canProposeTopics } from "@/lib/auth/rbac";
import { selectableWriterCategories } from "@/services/editor-categories";
import { listIssuesWithoutWindows, listWriterIssues } from "@/services/topics";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import { ArticleBodyTextarea } from "@/components/article-body-textarea";
import { EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { createArticleAsWriterAction } from "../../actions";

export const metadata = { title: "Yeni yazı" };

/**
 * A new article starts from an accepted topic (D-261), which also decides its
 * issue. An issue without windows (issue 1) may still be written into
 * directly, as before. `?konu=` preselects the topic the writer came from.
 */
export default async function WriterNewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ konu?: string }>;
}) {
  const { user } = await guardWriterInnerPages();
  const actor = { ...user };
  const csrfToken = (await readCsrfToken()) ?? "";
  const { konu } = await searchParams;

  const [categories, entries, openIssues] = await Promise.all([
    selectableWriterCategories(actor),
    canProposeTopics(actor) ? listWriterIssues(actor) : Promise.resolve([]),
    listIssuesWithoutWindows(),
  ]);

  // Accepted topics that have no article yet
  const topics = entries.flatMap(({ issue, proposal }) =>
    proposal && proposal.status === "accepted" && !proposal.articleId ? [{ issue, proposal }] : [],
  );
  const chosen = topics.find((row) => row.proposal.id === konu) ?? null;

  if (topics.length === 0 && openIssues.length === 0) {
    return (
      <>
        <PageHeader title="Yeni yazı" />
        <EmptyState>
          Yazı, kabul edilmiş bir konudan başlar.{" "}
          <Link href="/writer/topics" className="text-accent underline">
            Sayılar ve konular
          </Link>{" "}
          sayfasından konunuzu belirleyin.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Yeni yazı"
        description="Taslağınızı kaydedin; yazı kabul dönemi açıkken “İncelemeye gönder” ile teslim edersiniz."
      />

      <PanelForm action={createArticleAsWriterAction} csrfToken={csrfToken} submitLabel="Taslak olarak kaydet">
        <>
          <Field
            label="Konu"
            htmlFor="target"
            hint="Yazı, seçtiğiniz konunun sayısına bağlanır; sonradan başka sayıya taşınmaz."
          >
            <Select id="target" name="target" required defaultValue={chosen ? `topic:${chosen.proposal.id}` : ""}>
              <option value="" disabled>
                Seçin…
              </option>
              {topics.map(({ issue, proposal }) => (
                <option key={proposal.id} value={`topic:${proposal.id}`}>
                  Sayı {issue.number} · {proposal.title}
                </option>
              ))}
              {openIssues.map((issue) => (
                <option key={issue.id} value={`issue:${issue.id}`}>
                  Sayı {issue.number} · {issue.title} (konusuz)
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Başlık" htmlFor="title">
            <Input id="title" name="title" required maxLength={200} defaultValue={chosen?.proposal.title ?? ""} />
          </Field>

          <Field
            label="Slug"
            htmlFor="slug"
            hint="Boş bırakılırsa başlıktan üretilir. Küçük harf, rakam ve tire kullanın."
          >
            <Input id="slug" name="slug" maxLength={120} placeholder="yazinin-adi" />
          </Field>

          <Field label="Özet" htmlFor="summary">
            <Input id="summary" name="summary" maxLength={600} />
          </Field>

          <Field
            label="Kategori"
            htmlFor="category"
            hint="Yalnızca size tanımlı alanları seçebilirsiniz; yazı o alanın editörüne düşer."
          >
            <Select id="category" name="category" required defaultValue={chosen?.proposal.category ?? ""}>
              <option value="">Seçin…</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Gövde (markdown)" htmlFor="bodyMarkdown">
            <ArticleBodyTextarea id="bodyMarkdown" name="bodyMarkdown" rows={18} />
          </Field>
        </>
      </PanelForm>
    </>
  );
}
