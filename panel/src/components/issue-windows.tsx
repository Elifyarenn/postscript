/**
 * An issue's two windows with their state (D-261): the same lines on the
 * admin's summary, the issues page and the writer's panel.
 */
import {
  formatPeriod,
  periodBadge,
  periodState,
  submissionPeriod,
  topicPeriod,
  type IssuePeriods,
} from "@/lib/issue-periods";
import { StatusBadge } from "./ui";

export function IssueWindows({ issue, now }: { issue: IssuePeriods; now: Date }) {
  const rows = [
    { label: "Konu belirleme", period: topicPeriod(issue) },
    { label: "Yazı kabul", period: submissionPeriod(issue) },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-md border border-line bg-paper px-3 py-2">
          <dt className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
            {row.label}
            <StatusBadge status={periodBadge(periodState(row.period, now))} />
          </dt>
          <dd className="mt-1 text-xs text-muted">{formatPeriod(row.period) ?? "Tarih belirlenmedi"}</dd>
        </div>
      ))}
    </dl>
  );
}
