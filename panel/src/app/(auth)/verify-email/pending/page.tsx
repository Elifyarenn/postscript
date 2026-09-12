import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card, Field, Input } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { resendVerificationAction } from "../../actions";

export const metadata = { title: "E-posta doğrulaması bekleniyor" };

/**
 * The "check your inbox" page after registration (D-067).
 *
 * No account exists yet and there is no session: the address is shown only
 * when the registration form passed it along in the URL. The only thing on
 * offer is asking for another link, so a lost e-mail cannot dead-end the
 * registration.
 */
export default async function VerifyEmailPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const csrfToken = (await readCsrfToken()) ?? "";
  const { email } = await searchParams;
  const shownEmail = email ? decodeURIComponent(email) : "";

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">E-posta adresinizi doğrulayın</h1>
      <p className="mb-5 text-sm text-muted">
        Kayıt isteğinizi aldık.{" "}
        {shownEmail ? (
          <strong className="text-ink">{shownEmail}</strong>
        ) : (
          <strong className="text-ink">E-posta adresinize</strong>
        )}{" "}
        bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladığınızda hesabınız
        oluşturulur.
      </p>

      <Alert tone="info">
        Bağlantı 24 saat geçerlidir. E-posta gelmediyse gereksiz klasörünüze bakın, sonra
        aşağıdan yenisini isteyin.
      </Alert>

      <div className="mt-5">
        <PanelForm
          action={resendVerificationAction}
          csrfToken={csrfToken}
          submitLabel="Bağlantıyı tekrar gönder"
        >
          <Field label="E-posta" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={shownEmail}
              required
            />
          </Field>
        </PanelForm>
      </div>

      <p className="mt-5 text-sm">
        <Link href="/login" className="text-accent hover:underline">
          Girişe dön
        </Link>
      </p>
    </Card>
  );
}