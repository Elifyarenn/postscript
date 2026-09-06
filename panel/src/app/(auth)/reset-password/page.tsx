import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card, Field, Input } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
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

      <PanelForm action={resetPasswordAction} csrfToken={csrfToken} submitLabel="Şifreyi güncelle">
          <>
            <input type="hidden" name="token" value={token} />
            <Field
              label="Yeni şifre"
              htmlFor="password"
              hint={`En az ${MIN_PASSWORD_LENGTH} karakter.`}
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                autoFocus
                minLength={MIN_PASSWORD_LENGTH}
              />
            </Field>
          </>
      </PanelForm>
    </Card>
  );
}
