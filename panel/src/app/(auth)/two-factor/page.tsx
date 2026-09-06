import { redirect } from "next/navigation";
import { readCsrfToken } from "@/lib/csrf";
import { getAuthContext } from "@/lib/auth/session";
import { Card, Field, Input } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { verifyTotpAction } from "../actions";

export const metadata = { title: "İki adımlı doğrulama" };

export default async function TwoFactorPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  // Nothing to do here once the factor is satisfied
  if (context.twoFactorSatisfied) redirect("/");

  const csrfToken = (await readCsrfToken()) ?? "";

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">İki adımlı doğrulama</h1>
      <p className="mb-5 text-sm text-muted">
        Doğrulama uygulamanızdaki altı haneli kodu girin. Kurtarma kodlarınızdan birini de
        kullanabilirsiniz.
      </p>

      <PanelForm action={verifyTotpAction} csrfToken={csrfToken} submitLabel="Doğrula">
          <Field label="Kod" htmlFor="code">
            <Input
              id="code"
              name="code"
              inputMode="text"
              autoComplete="one-time-code"
              required
              autoFocus
              className="tracking-[0.3em]"
            />
          </Field>
      </PanelForm>
    </Card>
  );
}
