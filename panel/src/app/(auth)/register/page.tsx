import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { Card, Field, Input } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { PanelForm } from "@/components/form";
import { registerReaderAction } from "../actions";

export const metadata = { title: "Okuyucu kaydı" };

/**
 * The standard reader/user registration. Every new account gets the plain
 * `user` role; writer and editor roles are granted from the admin panel only
 * (D-064). The address has to be verified by e-mail before the account can do
 * anything (D-034).
 */
export default async function RegisterPage() {
  const csrfToken = (await readCsrfToken()) ?? "";

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">Okuyucu hesabı oluştur</h1>
      <p className="mb-5 text-sm text-muted">
        Kaydınızı tamamladıktan sonra e-posta adresinize gelen bağlantıyı
        doğrulayın; hesabınız okuyucu olarak açılır.
      </p>

      <PanelForm
        action={registerReaderAction}
        csrfToken={csrfToken}
        submitLabel="Hesabı oluştur"
        requireValid
      >
        <>
          <Field label="Ad Soyad" htmlFor="displayName">
            <Input id="displayName" name="displayName" required autoFocus maxLength={80} />
          </Field>

          <Field label="E-posta" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>

          <Field label="Doğum tarihi" htmlFor="birthDate">
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>

          <PasswordField />

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="kvkkConsent"
              required
              className="mt-0.5 size-4 rounded border-line"
            />
            <span>
              <Link href="/kvkk" target="_blank" className="text-accent underline">
                Kişisel Verilerin Korunması Kanunu
              </Link>{" "}
              kapsamındaki aydınlatma metnini okudum ve onaylıyorum.
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