/**
 * The step history card (D-106, D-107), shared by the editor's and the writer's
 * article page so the two never describe the same history differently. Which
 * steps and notes arrive here is the service's decision, not this card's.
 */
import type { HistoryStep } from "@/lib/article-history";
import { formatDateTime } from "@/lib/utils";
import { Card, EmptyState, STATUS_LABELS, Table, Td, Th } from "./ui";

function statusLabel(status: string | null): string {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status;
}

export function ArticleHistoryCard({ steps }: { steps: HistoryStep[] }) {
  return (
    <Card>
      <h2 className="mb-1 font-serif text-lg">Süreç geçmişi</h2>
      <p className="mb-4 text-xs text-muted">
        Yazının geçtiği her adım: kim yaptı, ne zaman, hangi notla.
      </p>

      {steps.length === 0 ? (
        <EmptyState>Kayıtlı adım yok.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Tarih</Th>
              <Th>Kim</Th>
              <Th>Adım</Th>
              <Th>Not</Th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.id}>
                <Td className="text-xs whitespace-nowrap">{formatDateTime(step.at)}</Td>
                <Td className="text-xs">{step.actor}</Td>
                <Td className="text-xs">
                  {step.label}
                  {step.toStatus && (
                    <span className="block text-muted">
                      {statusLabel(step.fromStatus)} → {statusLabel(step.toStatus)}
                    </span>
                  )}
                </Td>
                <Td className="text-xs whitespace-pre-wrap">{step.note ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
