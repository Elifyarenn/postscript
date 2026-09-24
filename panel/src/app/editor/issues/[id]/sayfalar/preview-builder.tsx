"use client";

/**
 * The one button that builds or refreshes the temporary preview (D-247).
 *
 * Offered only on the admin-only issue; the service refuses any other issue
 * on its own. Running it again updates the same seven pages.
 */
import { useActionState } from "react";
import { SubmitRow } from "@/components/form";
import type { ActionState } from "@/lib/action";
import { buildIssuePreviewAction } from "./actions";

export function PreviewBuilder({ issueId, csrfToken }: { issueId: string; csrfToken: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(buildIssuePreviewAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="issueId" value={issueId} />
      <p className="text-sm text-muted">
        Tasarımcıların sayfaları gelene kadar okuyucuyu denemek için yedi geçici sayfa kurar: tipografik
        kapak, içindekiler, görselli yazı açılışı, devam sayfası, ikinci yazı, kolaj, seçki ve deneme testi.
        Metinler üç farklı kategoriden taslak yazıların kayıtlarından okunur; yazılar değişmez, yayımlanmaz.
        Tekrar çalıştırmak aynı sayfaları günceller. Her sayfa, aşağıdaki listeden gerçek PNG/WebP
        tasarımla değiştirilebilir.
      </p>
      <SubmitRow state={state} label="Geçici önizlemeyi kur / güncelle" variant="secondary" />
    </form>
  );
}
