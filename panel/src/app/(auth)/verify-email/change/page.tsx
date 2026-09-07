import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { confirmEmailChangeAction } from "../../actions";

export const metadata = { title: "E-posta değişikliği" };

/**
 * The e-mail change link lands here. Confirming is a button, not an automatic
 * GET, so a mail scanner or link preview cannot spend the token on the user's
 * behalf — the same choice made for address verification.
 */
export default async function VerifyEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const csrfToken = (await readCsrfToken()) ?? "";
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card>
        <Alert tone="danger" title="Bağlantı eksik">
          E-posta değişikliği bağlantısı geçersiz görünüyor.
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">E-posta değişikliği</h1>
      <p className="mb-5 text-sm text-muted">
        Yeni adresinizi doğrulamak için aşağıdaki düğmeye basın. Hesabınızın adresi
        değiştirilecek ve diğer tüm oturumlarınız kapatılacak.
      </p>

      <PanelForm action={confirmEmailChangeAction} csrfToken={csrfToken} submitLabel="Adresi değiştir">
        <input type="hidden" name="token" value={token} />
      </PanelForm>

      <p className="mt-5 text-sm">
        <Link href="/login" className="text-accent hover:underline">
          Girişe dön
        </Link>
      </p>
    </Card>
  );
}
