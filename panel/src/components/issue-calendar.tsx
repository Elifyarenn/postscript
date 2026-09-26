/**
 * The running issues' calendar at the top of the writer's and the editor's
 * panel (D-264): topic window, delivery window and planned publication, each
 * with its state. `extra` lets a page add a line under an issue, such as the
 * writer's own stage.
 */
import type { ReactNode } from "react";
import type { Issue } from "@/db/schema";
import { IssueWindows } from "./issue-windows";
import { Card } from "./ui";

export function IssueCalendar({
  issues,
  now,
  extra,
}: {
  issues: Issue[];
  now: Date;
  extra?: (issue: Issue) => ReactNode;
}) {
  return (
    <Card className="border-accent/40">
      <h2 className="mb-1 font-serif text-lg">Sayı takvimi</h2>
      <p className="mb-4 text-xs text-muted">Saatler Türkiye saatidir.</p>
      {issues.length === 0 ? (
        <p className="text-sm text-muted">Şu anda takvimi belirlenmiş bir sayı yok.</p>
      ) : (
        <div className="space-y-5">
          {issues.map((issue) => (
            <section key={issue.id} aria-labelledby={`calendar-${issue.id}`}>
              <h3 id={`calendar-${issue.id}`} className="mb-2 text-sm font-medium">
                Sayı {issue.number} · {issue.title}
              </h3>
              <IssueWindows issue={issue} now={now} />
              {extra?.(issue)}
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
