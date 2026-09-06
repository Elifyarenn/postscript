import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { logoutAction } from "../../actions";
import { resendVerificationAction } from "@/app/account/actions";
import { PanelForm } from "@/components/form";
import { Alert, Card } from "@/components/ui";

export const metadata = { title: "E-posta doğrulaması bekleniyor" };

/**
 * Where every signed-in but unverified account lands (D-034).
 *
 * The account exists and the session is real, but nothing else opens until the
 * link in the e-mail is followed. The only two things offered here are asking
 * for another link and signing out.
 */
export default async function VerifyEmailPendingPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  // Nothing to wait for once the address is confirmed
  if (context.user.emailVerifiedAt !== null) redirect("/");

  const csrfToken = (await readCsrfToken()) ?? "";

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">E-posta adresinizi doğrulayın</h1>
      <p className="mb-5 text-sm text-muted">
        <strong className="text-ink">{context.user.email}</strong> adresine bir doğrulama
        bağlantısı gönderdik. Bağlantıya tıklayana kadar hesabınızı kullanamazsınız.
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
        />
      </div>

      <form action={logoutAction} className="mt-6 border-t border-line pt-4">
        <button type="submit" className="text-sm text-muted hover:text-ink">
          Başka bir hesapla giriş yap
        </button>
      </form>
    </Card>
  );
}
