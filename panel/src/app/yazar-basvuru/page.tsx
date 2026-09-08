import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card, Field, Input } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { PanelForm } from "@/components/form";
import { registerWriterAction } from "@/app/(auth)/actions";

export const metadata = { title: "Yazar hesabı oluştur" };

/**
 * The public writer registration. Anyone can open an account; the address is
 * verified by e-mail and the account is then auto-approved to writer — the
 * editorial review the old lead pipeline needed is replaced by the address
 * proof (D-049).
 */
export default async function WriterRegisterPage() {
  const csrfToken = (await readCsrfToken()) ?? "";

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">Yazar hesabı oluştur</h1>
      <p className="mb-5 text-sm text-muted">
        Kaydınızı tamamladıktan sonra e-posta adresinize gelen bağlantıyı doğrulayın.
        Doğrulama sonrası hesabınız yazar olarak onaylanır.
      </p>

      <PanelForm
        action={registerWriterAction}
        csrfToken={csrfToken}
        submitLabel="Yazar hesabı oluştur"
        requireValid
      >
        <>
          <Field label="Ad Soyad" htmlFor="displayName">
            <Input id="displayName" name="displayName" required autoFocus maxLength={80} />
          </Field>

          <Field label="Doğum Tarihi" htmlFor="birthDate" hint="Yazar olmak için 18 yaşını doldurmuş olmanız gerekir.">
            <Input id="birthDate" name="birthDate" type="date" required />
          </Field>

          <Field label="E-posta" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>

          <PasswordField />

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

      <div className="mt-5">
        <Alert tone="info">
          Yazar hesabınız onaylandıktan sonra çerçeve sözleşmeyi onaylayarak tüm yazar
          sayfalarınızı açarsınız.
        </Alert>
      </div>

      <p className="mt-5 text-sm">
        <Link href="/login" className="text-accent hover:underline">
          Zaten hesabım var
        </Link>
      </p>
    </Card>
  );
}
