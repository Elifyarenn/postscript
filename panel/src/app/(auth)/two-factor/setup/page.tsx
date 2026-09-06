import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { readCsrfToken } from "@/lib/csrf";
import { getAuthContext } from "@/lib/auth/session";
import {
  buildOtpAuthUrl,
  generateTotpSecret,
  readTotpSecret,
  stageTotpSecret,
} from "@/lib/auth/totp";
import { Alert, Card } from "@/components/ui";
import { TotpSetupForm } from "./setup-form";
import { confirmTotpAction } from "./actions";

export const metadata = { title: "İki adımlı doğrulama kurulumu" };

/** Where an account belongs once its second factor is in place. */
function homeFor(role: string): string {
  if (role === "admin") return "/admin";
  if (role === "editor") return "/editor";
  if (role === "writer") return "/writer";
  return "/account";
}

export default async function TotpSetupPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  // Only the admin role carries a second factor (D-025); for anyone else there
  // is nothing to set up and staging a secret would leave dead data behind
  if (context.user.role !== "admin") redirect(homeFor(context.user.role));

  // Staging a secret clears the confirmation, so simply opening this page would
  // otherwise switch off a factor that is already in place. An account that has
  // one must prove it first; re-enrolment is then allowed, because the session
  // has already shown possession of the current device.
  if (context.user.totpConfirmedAt && !context.twoFactorSatisfied) redirect("/two-factor");

  const csrfToken = (await readCsrfToken()) ?? "";

  // Reuse a staged secret so refreshing the page does not invalidate the QR
  // code the user is halfway through scanning
  let secret = context.user.totpConfirmedAt ? null : await readTotpSecret(context.user.id);
  if (!secret) {
    secret = generateTotpSecret();
    await stageTotpSecret(context.user.id, secret);
  }

  const otpAuthUrl = buildOtpAuthUrl(secret, context.user.email);
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, { margin: 1, width: 220 });

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">İki adımlı doğrulama kurulumu</h1>
      <p className="mb-5 text-sm text-muted">
        Yönetici hesapları için zorunludur. Kurulum tamamlanmadan panele girilemez.
      </p>

      <ol className="mb-5 space-y-3 text-sm">
        <li>
          <span className="font-medium">1.</span> Doğrulama uygulamanızda (Google Authenticator,
          Aegis, 1Password vb.) yeni bir hesap ekleyin.
        </li>
        <li>
          <span className="font-medium">2.</span> Aşağıdaki kareyi okutun ya da anahtarı elle girin.
        </li>
        <li>
          <span className="font-medium">3.</span> Uygulamadaki altı haneli kodu aşağıya yazın.
        </li>
      </ol>

      <div className="mb-5 flex flex-col items-center gap-3 rounded-md border border-line bg-paper p-4">
        {/* Rendered on the server as a data URI, so the secret never travels to a QR service */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="TOTP kurulum karekodu" width={220} height={220} />
        <code className="text-xs tracking-widest break-all text-muted">{secret}</code>
      </div>

      <TotpSetupForm
        action={confirmTotpAction}
        csrfToken={csrfToken}
        continueHref={homeFor(context.user.role)}
      />

      <div className="mt-5">
        <Alert tone="warning">
          Telefonunuzu kaybederseniz kurtarma kodlarınızla giriş yapabilirsiniz. Kodlar yalnızca
          kurulum anında bir kez gösterilir.
        </Alert>
      </div>
    </Card>
  );
}
