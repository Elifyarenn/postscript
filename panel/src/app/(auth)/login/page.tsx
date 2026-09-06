import Link from "next/link";
import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card, Field, Input } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { loginAction } from "../actions";

export const metadata = { title: "Giriş" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; verified?: string }>;
}) {
  const csrfToken = (await readCsrfToken()) ?? "";
  const params = await searchParams;

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">Giriş</h1>
      <p className="mb-5 text-sm text-muted">Panel hesabınızla giriş yapın.</p>

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
        <Link href="/register" className="text-accent hover:underline">
          Hesap oluştur
        </Link>
        <Link href="/forgot-password" className="text-muted hover:text-ink">
          Şifremi unuttum
        </Link>
      </div>
    </Card>
  );
}
