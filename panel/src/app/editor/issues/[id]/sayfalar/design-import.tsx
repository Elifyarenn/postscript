"use client";

/**
 * The designers' pages kept in code (D-274): one button imports or updates
 * them, the other undoes the last import. Offered only on the admin-only
 * issue; the service refuses any other issue on its own.
 */
import { useActionState } from "react";
import { SubmitRow } from "@/components/form";
import type { ActionState } from "@/lib/action";
import { importIssueDesignAction, restoreIssueDesignAction } from "./actions";

export function DesignImport({
  issueId,
  csrfToken,
  pageCount,
  pending,
}: {
  issueId: string;
  csrfToken: string;
  pageCount: number;
  /** The earlier pages the last import set aside, when they can be put back. */
  pending: { count: number; at: string } | null;
}) {
  const [state, importAction] = useActionState<ActionState, FormData>(importIssueDesignAction, null);
  const [undoState, undoAction] = useActionState<ActionState, FormData>(restoreIssueDesignAction, null);

  return (
    <div className="space-y-4">
      <form action={importAction} className="space-y-3">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="issueId" value={issueId} />
        <p className="text-sm text-muted">
          Kodda tanımlı {pageCount} tasarım sayfasını (<code>src/lib/issue-design/</code>) bu sayıya aktarır.
          Sıra, içindekiler ve etkileşim alanları oradan gelir. Tekrar çalıştırmak yalnızca değişeni günceller;
          aynı görsel ikinci kez yüklenmez. İlk aktarımda sayının önceki sayfaları yedeklenip çıkarılır.
        </p>
        <SubmitRow state={state} label="Tasarım sayfalarını içe aktar / güncelle" />
      </form>

      {pending && (
        <form action={undoAction} className="space-y-3 border-t border-line pt-4">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="issueId" value={issueId} />
          <p className="text-sm text-muted">
            {new Date(pending.at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} aktarımında{" "}
            {pending.count} önceki sayfa yedeklenip çıkarıldı. Geri almak onları görselleri ve alanlarıyla
            geri koyar, tasarım sayfalarını çıkarır.
          </p>
          <SubmitRow state={undoState} label="Önceki sayfalara geri dön" variant="secondary" />
        </form>
      )}
    </div>
  );
}
