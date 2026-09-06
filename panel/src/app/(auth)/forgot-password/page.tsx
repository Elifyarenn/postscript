import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { Card, Field, Input } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { requestPasswordResetAction } from "../actions";

export const metadata = { title: "Şifremi unuttum" };

export default async function ForgotPasswordPage() {
  const csrfToken = (await readCsrfToken()) ?? "";

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">Şifremi unuttum</h1>
      <p className="mb-5 text-sm text-muted">
        Adresinize 30 dakika geçerli, tek kullanımlık bir bağlantı gönderilir.
      </p>

      <PanelForm
        action={requestPasswordResetAction}
        csrfToken={csrfToken}
        submitLabel="Bağlantı gönder"
      >
          <Field label="E-posta" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
      </PanelForm>

      <p className="mt-5 text-sm">
        <Link href="/login" className="text-accent hover:underline">
          Girişe dön
        </Link>
      </p>
    </Card>
  );
}
