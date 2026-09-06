import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card, Field, Input } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { PanelForm } from "@/components/form";
import { resetPasswordAction } from "../actions";

export const metadata = { title: "Şifre sıfırlama" };

export default async function ResetPasswordPage({
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
          Sıfırlama bağlantısı geçersiz görünüyor. E-postadaki bağlantıyı tekrar açın.
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">Yeni şifre belirleyin</h1>
      <p className="mb-5 text-sm text-muted">
        Şifreniz değişince açık olan tüm oturumlarınız kapatılır.
      </p>

      <PanelForm
        action={resetPasswordAction}
        csrfToken={csrfToken}
        submitLabel="Şifreyi güncelle"
        requireValid
      >
          <>
            <input type="hidden" name="token" value={token} />
            <PasswordField label="Yeni şifre" autoFocus />
          </>
      </PanelForm>
    </Card>
  );
}
