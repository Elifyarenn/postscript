import Link from "next/link";
import { guardWriterInnerPages } from "@/lib/auth/guard";
import { canProposeTopics, canWriteInAnyArea } from "@/lib/auth/rbac";
import { selectableWriterCategories } from "@/services/editor-categories";
import { temporaryAreasByIssue } from "@/services/issue-area-grants";
import { listIssuesWithoutWindows, listWriterIssues } from "@/services/topics";
import { getActiveIssue } from "@/services/active-issue";
import { categoryBudgetForForm } from "@/services/category-budget";
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
 * Either way only the active issue is offered (D-330): the server refuses
 * the rest, so the form does not show them.
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
  // An admin holds no area: every area and their own working issue are open (D-304)
  const anyArea = canWriteInAnyArea(actor);

  const [categories, allEntries, allOpenIssues, temporary, activeIssue] = await Promise.all([
    selectableWriterCategories(actor),
    canProposeTopics(actor) ? listWriterIssues(actor) : Promise.resolve([]),
    listIssuesWithoutWindows(user.id, anyArea),
    temporaryAreasByIssue(user.id),
    getActiveIssue(),
  ]);
  // The category totals of the issue the article will go into (D-331)
  const budgetData = activeIssue ? await categoryBudgetForForm(activeIssue.id) : null;
  const entries = allEntries.filter(({ issue }) => issue.id === activeIssue?.id);
  const openIssues = allOpenIssues.filter((issue) => issue.id === activeIssue?.id);

  // Areas given for one issue only (D-306): offered with that issue's number;
  // the server checks the area against the issue the article goes into
  const issueNumbers = new Map(
    [...entries.map(({ issue }) => issue), ...openIssues].map((issue) => [issue.id, issue.number]),
  );
  const temporaryOptions = [...temporary].flatMap(([issueId, names]) =>
    names
      .filter((name) => !categories.includes(name))
      .map((name) => ({ name, issueNumber: issueNumbers.get(issueId) ?? null })),
  );

  // Accepted topics that have no article yet
  const topics = entries.flatMap(({ issue, proposals }) =>
    proposals
      .filter(({ proposal }) => proposal.status === "accepted" && !proposal.articleId)
      .map(({ proposal }) => ({ issue, proposal })),
  );
  const chosen = topics.find((row) => row.proposal.id === konu) ?? null;

  if (topics.length === 0 && openIssues.length === 0) {
    return (
      <>
        <PageHeader title="Yeni yazı" />
        <EmptyState>
          {activeIssue ? `Yeni yazılar aktif sayıya (Sayı ${activeIssue.number}) açılır. ` : "Şu an yazı kabul eden açık bir sayı yok. "}
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
            hint={`Yazı aktif sayıya (Sayı ${activeIssue?.number ?? "—"}) bağlanır; sonradan başka sayıya taşınmaz.`}
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
            hint={
              anyArea
                ? "Admin olarak istediğiniz alanı seçebilirsiniz; yazı o alanın editörüne düşer."
                : "Yalnızca size tanımlı alanları seçebilirsiniz; yazı o alanın editörüne düşer."
            }
          >
            <Select id="category" name="category" required defaultValue={chosen?.proposal.category ?? ""}>
              <option value="">Seçin…</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {temporaryOptions.map(({ name, issueNumber }) => (
                <option key={`${issueNumber}-${name}`} value={name}>
                  {name} (yalnızca {issueNumber ? `Sayı ${issueNumber}` : "verildiği sayı"} için)
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Gövde (markdown)" htmlFor="bodyMarkdown">
            <ArticleBodyTextarea
              id="bodyMarkdown"
              name="bodyMarkdown"
              rows={18}
              budget={budgetData ? { ...budgetData, categoryFieldId: "category" } : undefined}
            />
          </Field>
        </>
      </PanelForm>
    </>
  );
}
