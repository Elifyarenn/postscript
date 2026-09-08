import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { WRITER_AREAS } from "@/lib/writer-areas";
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

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">
              Alanınız <span className="text-muted">(yalnızca bir alan)</span>
            </legend>
            <div className="grid gap-2">
              {WRITER_AREAS.map((area) => (
                <label
                  key={area}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2 text-sm hover:bg-paper"
                >
                  <input
                    type="radio"
                    name="area"
                    value={area}
                    required
                    className="size-4 rounded-full border-line"
                  />
                  {area}
                </label>
              ))}
            </div>
          </fieldset>

          <PasswordField />
        </>
      </PanelForm>

      <div className="mt-5">
        <Alert tone="info">
          Yazar hesabınız onaylandıktan sonra yazar sayfalarınız doğrudan açılır.
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
