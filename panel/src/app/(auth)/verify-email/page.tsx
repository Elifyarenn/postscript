import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { verifyEmailAction } from "../actions";

export const metadata = { title: "E-posta doğrulama" };

/**
 * Verification is a button rather than an automatic GET: a link preview or a
 * mail scanner must not be able to spend the token on the user's behalf.
 */
export default async function VerifyEmailPage({
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
          Doğrulama bağlantısı geçersiz görünüyor.
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">E-posta doğrulama</h1>
      <p className="mb-5 text-sm text-muted">
        Adresinizi doğrulamak için aşağıdaki düğmeye basın.
      </p>

      <PanelForm action={verifyEmailAction} csrfToken={csrfToken} submitLabel="Doğrula">
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
