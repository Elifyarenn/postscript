import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { readCsrfToken } from "@/lib/csrf";
import { TWO_FACTOR_COOKIE } from "@/services/two-factor";
import { Alert, Card, Field, Input } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { loginTwoFactorAction } from "../../actions";

export const metadata = { title: "İki adımlı doğrulama" };

/**
 * The second half of the login: the six digit code from the authenticator
 * app. Only reachable when the browser holds the challenge ticket the
 * password half issued.
 */
export default async function TwoFactorLoginPage() {
  const csrfToken = (await readCsrfToken()) ?? "";
  const cookieStore = await cookies();
  const hasTicket = Boolean(cookieStore.get(TWO_FACTOR_COOKIE)?.value);

  if (!hasTicket) redirect("/login");

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">İki adımlı doğrulama</h1>
      <p className="mb-5 text-sm text-muted">
        Kimlik doğrulayıcı uygulamanızdaki altı haneli kodu girin.
      </p>

      <PanelForm action={loginTwoFactorAction} csrfToken={csrfToken} submitLabel="Doğrula">
        <Field
          label="Doğrulama kodu"
          htmlFor="code"
          hint="Uygulamanızdaki kod 30 saniyede bir yenilenir."
        >
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
          />
        </Field>
      </PanelForm>

      <div className="mt-5 text-sm">
        <Link href="/login" className="text-muted hover:text-ink">
          Geri dön ve yeniden giriş yap
        </Link>
      </div>
    </Card>
  );
}