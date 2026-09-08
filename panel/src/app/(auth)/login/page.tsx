import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { getAccessMode } from "@/services/access-mode";
import { Alert, Card, Field, Input } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { loginAction } from "../actions";

export const metadata = { title: "Giriş" };

/**
 * The single sign-in door. New accounts are only taken through the writer
 * registration (/yazar-basvuru) for now, so the page leads with that path and
 * keeps the login form for writer and admin accounts (D-049).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; verified?: string }>;
}) {
  const csrfToken = (await readCsrfToken()) ?? "";
  const params = await searchParams;
  const closed = (await getAccessMode()) === "closed";

  return (
    <div className="space-y-5">
      <Card>
        <h1 className="mb-1 font-serif text-xl">Yazar hesabı</h1>
        <p className="mb-4 text-sm text-muted">
          Yazar hesabınızı oluşturun; e-posta adresinizi doğruladıktan sonra hesabınız
          yazar olarak onaylanır.
        </p>

        {closed && (
          <div className="mb-4">
            <Alert tone="info">
              Yazar hesabı kaydı her zaman açıktır. Okuyucu hesapları şu anda alınmıyor.
            </Alert>
          </div>
        )}

        <Link
          href="/yazar-basvuru"
          className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Yazar hesabı oluştur
        </Link>
      </Card>

      <Card>
        <h2 className="mb-1 font-serif text-xl">Giriş</h2>
        <p className="mb-5 text-sm text-muted">Yönetici veya yazar hesabınızla giriş yapın.</p>

        {closed && (
          <div className="mb-4">
            <Alert tone="warning">
              Site henüz yayında değil; giriş yalnızca yönetici ve yazar hesaplarına açıktır.
            </Alert>
          </div>
        )}

        {params.reset && (
          <div className="mb-4">
            <Alert tone="success">Şifreniz güncellendi, yeni şifrenizle giriş yapabilirsiniz.</Alert>
          </div>
        )}
        {params.verified && (
          <div className="mb-4">
            <Alert tone="success">E-posta adresiniz doğrulandı.</Alert>
          </div>
        )}

        <PanelForm action={loginAction} csrfToken={csrfToken} submitLabel="Giriş yap">
          <>
            <Field label="E-posta" htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
              />
            </Field>

            <Field label="Şifre" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
          </>
        </PanelForm>

        <div className="mt-5 flex justify-between text-sm">
          <Link href="/forgot-password" className="text-muted hover:text-ink">
            Şifremi unuttum
          </Link>
        </div>
      </Card>
    </div>
  );
}
