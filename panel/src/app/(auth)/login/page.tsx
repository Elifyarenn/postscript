import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card, Field, Input } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { loginAction } from "../actions";

export const metadata = { title: "Giriş" };

/**
 * The single sign-in door for every role. The signed-in user is sent home by
 * role (admin → yönetim, editör → editör paneli, yazar → yazar paneli, okuyucu
 * → okuma alanı); the reader home keeps the account at the top right.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; verified?: string }>;
}) {
  const csrfToken = (await readCsrfToken()) ?? "";
  const params = await searchParams;

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">Giriş yap</h1>
      <p className="mb-5 text-sm text-muted">
        Okuyucu, yazar veya yönetici hesabınızla giriş yapın.
      </p>

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

      <div className="mt-5 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-ink">
          Şifremi unuttum
        </Link>
      </div>

      <div className="mt-6 border-t border-line pt-4 text-sm">
        <p className="text-muted">
          Hesabınız yok mu?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Okuyucu kaydı
          </Link>{" "}
          ·{" "}
          <Link href="/yazar-basvuru" className="text-accent hover:underline">
            Yazar kaydı
          </Link>
        </p>
      </div>
    </Card>
  );
}