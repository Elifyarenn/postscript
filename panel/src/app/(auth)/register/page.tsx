import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { Card, Field, Input } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { registerAction } from "../actions";

export const metadata = { title: "Kayıt" };

export default async function RegisterPage() {
  const csrfToken = (await readCsrfToken()) ?? "";

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">Hesap oluştur</h1>
      <p className="mb-5 text-sm text-muted">
        Herkes normal kullanıcı olarak kayıt olur. Yazar yetkisini yalnızca yönetici verir.
      </p>

      <PanelForm action={registerAction} csrfToken={csrfToken} submitLabel="Kayıt ol">
          <>
            <Field
              label="Ad Soyad"
              htmlFor="displayName"
            >
              <Input id="displayName" name="displayName" required autoFocus maxLength={80} />
            </Field>

            <Field label="E-posta" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </Field>

            <Field
              label="Şifre"
              htmlFor="password"
              hint={`En az ${MIN_PASSWORD_LENGTH} karakter. Yaygın kullanılan şifreler kabul edilmez.`}
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </Field>

            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                name="kvkkConsent"
                required
                className="mt-0.5 size-4 rounded border-line"
              />
              <span>
                <Link href="/kvkk" className="text-accent hover:underline">
                  KVKK aydınlatma metnini
                </Link>{" "}
                okudum ve kişisel verilerimin işlenmesini kabul ediyorum.
              </span>
            </label>
          </>
      </PanelForm>

      <p className="mt-5 text-sm">
        <Link href="/login" className="text-accent hover:underline">
          Zaten hesabım var
        </Link>
      </p>
    </Card>
  );
}
