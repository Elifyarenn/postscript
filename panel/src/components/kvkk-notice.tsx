import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { currentKvkk, needsKvkkNotice } from "@/services/kvkk";
import { acknowledgeKvkkNoticeAction } from "@/app/account/actions";
import { PanelForm } from "./form";

/**
 * The "the privacy notice changed" band (D-104). The notice's §10 promises
 * members are told about a new version, so both frames — the panels and the
 * magazine (D-112) — show it until the member acknowledges it.
 */
export async function KvkkNotice({ user, csrfToken }: { user: SessionUser; csrfToken: string }) {
  const kvkk = await currentKvkk();
  if (!kvkk || !needsKvkkNotice(user.kvkkConsentVersion, kvkk)) return null;

  return (
    <div role="status" className="border-b border-line bg-surface px-6 py-3 text-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p>
          KVKK aydınlatma metni güncellendi (sürüm {kvkk.version}).{" "}
          <Link href="/kvkk" target="_blank" className="text-accent underline">
            Yeni metni okuyun
          </Link>
        </p>
        <PanelForm
          action={acknowledgeKvkkNoticeAction}
          csrfToken={csrfToken}
          submitLabel="Okudum"
          submitVariant="secondary"
        >
          <input type="hidden" name="version" value={kvkk.version} />
        </PanelForm>
      </div>
    </div>
  );
}
