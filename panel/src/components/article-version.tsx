/**
 * One earlier version of an article (D-108): who saved it and why, what changed
 * since the version before, and its full text. Shared by the editor's and the
 * writer's version page, so both read the same record the same way.
 */
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import { countChanges, diffLines, foldUnchanged, type DiffItem } from "@/lib/text-diff";
import { cn, formatDateTime } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "./ui";

export type VersionRecord = {
  version: number;
  bodyMarkdown: string;
  changeNote: string | null;
  changeKind: "correction" | "content_change";
  isPublishedSnapshot: boolean;
  createdAt: Date;
  changedByName: string | null;
};

const CHANGE_KIND_LABELS: Record<VersionRecord["changeKind"], string> = {
  correction: "Düzeltme",
  content_change: "İçerik değişikliği",
};

function DiffBlock({ items }: { items: DiffItem[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line font-mono text-xs">
      {items.map((item, index) =>
        item.kind === "skipped" ? (
          <p key={index} className="bg-paper px-3 py-1 text-muted">
            … {item.count} satır aynı
          </p>
        ) : (
          <p
            key={index}
            className={cn(
              "px-3 py-0.5 whitespace-pre-wrap",
              item.kind === "added" && "bg-accent-soft",
              item.kind === "removed" && "bg-danger-soft text-danger",
            )}
          >
            {/* The sign carries the meaning too, so it does not rest on colour alone */}
            <span aria-hidden="true" className="mr-2 text-muted select-none">
              {item.kind === "added" ? "+" : item.kind === "removed" ? "−" : " "}
            </span>
            <span className="sr-only">
              {item.kind === "added" ? "Eklendi: " : item.kind === "removed" ? "Silindi: " : ""}
            </span>
            {item.text || " "}
          </p>
        ),
      )}
    </div>
  );
}

export async function ArticleVersionView({
  articleTitle,
  version,
  previous,
  backHref,
}: {
  articleTitle: string;
  version: VersionRecord;
  previous: VersionRecord | null;
  backHref: string;
}) {
  const html = await renderMarkdown(version.bodyMarkdown);
  const diff = previous ? diffLines(previous.bodyMarkdown, version.bodyMarkdown) : null;
  const changes = diff ? countChanges(diff) : null;
  const savedBy = version.changedByName ?? "Sistem";

  let comparison;
  if (!previous) {
    comparison = <EmptyState>Bu ilk sürüm; karşılaştırılacak önceki sürüm yok.</EmptyState>;
  } else if (!diff || !changes) {
    comparison = <EmptyState>Metin karşılaştırılamayacak kadar uzun.</EmptyState>;
  } else if (changes.added + changes.removed === 0) {
    comparison = <EmptyState>Metin v{previous.version} ile aynı.</EmptyState>;
  } else {
    comparison = (
      <>
        <p className="mb-3 text-xs text-muted">
          v{previous.version} → v{version.version}: {changes.added} satır eklendi,{" "}
          {changes.removed} satır silindi.
        </p>
        <DiffBlock items={foldUnchanged(diff)} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${articleTitle} · v${version.version}`}
        description={`${formatDateTime(version.createdAt)} · ${savedBy}`}
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-3 font-serif text-lg">Bu sürüm</h2>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Kaydeden</dt>
              <dd>{savedBy}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tarih</dt>
              <dd>{formatDateTime(version.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Değişikliğin türü</dt>
              <dd>
                {CHANGE_KIND_LABELS[version.changeKind]}
                {version.isPublishedSnapshot && " · yayına alınan sürüm"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Not</dt>
              <dd className="whitespace-pre-wrap">{version.changeNote ?? "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 font-serif text-lg">Önceki sürüme göre değişiklikler</h2>
          {comparison}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Metin</h2>
          {/* renderMarkdown drops raw HTML and sanitises the output (D-012) */}
          <div className="prose-panel text-sm" dangerouslySetInnerHTML={{ __html: html }} />
        </Card>

        <p className="text-sm">
          <Link href={backHref} className="text-muted underline hover:text-ink">
            Yazıya dön
          </Link>
        </p>
      </div>
    </>
  );
}
