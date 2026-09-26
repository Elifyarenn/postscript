/**
 * The admin's view of one running issue (D-261): both windows with their
 * state, and the topic and delivery counts, all read from the tables.
 */
import Link from "next/link";
import type { issueProcessSummaries } from "@/services/topics";
import { IssueWindows } from "./issue-windows";
import { Card } from "./ui";

type Summary = Awaited<ReturnType<typeof issueProcessSummaries>>[number];

export function IssueProcessSummary({ summary, now }: { summary: Summary; now: Date }) {
  const { issue } = summary;
  const tiles = [
    { label: "Etkin yazar", value: summary.writerCount },
    { label: "Konu gönderildi", value: summary.proposalCount },
    { label: "Değerlendirme bekliyor", value: summary.waiting, href: `/editor/topics?sayi=${issue.number}&durum=submitted` },
    { label: "Değişiklik istendi", value: summary.revisionRequested, href: `/editor/topics?sayi=${issue.number}&durum=revision_requested` },
    { label: "Konu kabul edildi", value: summary.accepted, href: `/editor/topics?sayi=${issue.number}&durum=accepted` },
    { label: "Reddedildi", value: summary.rejected },
    { label: "Yazı teslim edildi", value: summary.delivered, href: `/editor/articles?issueId=${issue.id}` },
  ];

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg">
          Sayı {issue.number} · {issue.title}
        </h2>
        <Link href={`/editor/topics?sayi=${issue.number}`} className="text-sm text-accent underline">
          Konu önerileri
        </Link>
      </div>

      <IssueWindows issue={issue} now={now} />

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label} className="rounded-md border border-line px-3 py-2">
            {tile.href ? (
              <Link href={tile.href} className="block hover:text-accent">
                <span className="block font-serif text-2xl">{tile.value}</span>
                <span className="text-xs text-muted">{tile.label}</span>
              </Link>
            ) : (
              <>
                <span className="block font-serif text-2xl">{tile.value}</span>
                <span className="text-xs text-muted">{tile.label}</span>
              </>
            )}
          </li>
        ))}
      </ul>

      {summary.writersWithoutTopic.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer">
            Konu göndermeyen yazarlar ({summary.writersWithoutTopic.length})
          </summary>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {summary.writersWithoutTopic.map((writer) => (
              <li key={writer.id}>
                <Link href={`/admin/users/${writer.id}`} className="text-accent hover:underline">
                  {writer.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
