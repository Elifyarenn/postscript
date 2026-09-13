import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/username";
import { formatDate } from "@/lib/utils";
import { getMemberSettings, listBlockedMembers } from "@/services/social";
import { ActionButton, PanelForm } from "@/components/form";
import { Alert, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { MemberLink } from "@/components/social";
import { DM_POLICIES, DM_POLICY_LABELS } from "@/lib/direct-messages";
import { setDirectMessagePolicyAction, setUsernameAction, unblockAction } from "../actions";

export const metadata = { title: "Topluluk ayarları" };

export default async function SocialSettingsPage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";

  const [settings, blocked] = await Promise.all([
    getMemberSettings({ ...user }),
    listBlockedMembers({ ...user }),
  ]);

  return (
    <>
      <PageHeader title="Topluluk ayarları" description="Kullanıcı adınız ve engellediğiniz hesaplar." />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-3 font-serif text-lg">Kullanıcı adı</h2>

          {/* Says exactly what getProfile hands to other members (D-089) */}
          <Alert tone="info">
            Topluluk profilinizde diğer üyeler kullanıcı adınızı, varsa mahlasınızı, kısa
            biyografinizi, rolünüzü, katılım tarihinizi ve takip sayılarınızı görür. Ad soyadınız,
            e-posta adresiniz ve doğum tarihiniz profilde gösterilmez.
          </Alert>

          <div className="mt-4">
            <PanelForm action={setUsernameAction} csrfToken={csrfToken} submitLabel="Kaydet">
              <Field
                label="Kullanıcı adı"
                htmlFor="username"
                hint={`${USERNAME_MIN}-${USERNAME_MAX} karakter; küçük harf (a-z), rakam ve alt çizgi.`}
              >
                <Input
                  id="username"
                  name="username"
                  defaultValue={settings.username ?? ""}
                  required
                  minLength={USERNAME_MIN}
                  maxLength={USERNAME_MAX + 1}
                  autoComplete="off"
                />
              </Field>
            </PanelForm>
          </div>

          {settings.username && (
            <p className="mt-4 text-sm text-muted">
              <Link href={`/social/u/${settings.username}`} className="text-accent">
                Profilinize gidin
              </Link>
              {" · "}Biyografinizi{" "}
              <Link href="/account" className="text-accent">
                Hesabım
              </Link>{" "}
              sayfasından düzenleyebilirsiniz.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-serif text-lg">Özel mesajlar</h2>
          <p className="mb-4 text-sm text-muted">
            Özel mesajlaşma yalnızca 18 yaşını doldurmuş üyeler arasında açıktır. Daha önce yazdığınız
            bir üye, tercihiniz &ldquo;Kimse&rdquo; değilse size yanıt verebilir. Engellediğiniz
            hesaplar size hiçbir durumda yazamaz. Özel mesajlarınızı yöneticiler okuyamaz.
          </p>
          <PanelForm action={setDirectMessagePolicyAction} csrfToken={csrfToken} submitLabel="Kaydet">
            <Field label="Bana kimler özel mesaj gönderebilir?" htmlFor="dmPolicy">
              <Select id="dmPolicy" name="dmPolicy" defaultValue={settings.dmPolicy}>
                {DM_POLICIES.map((policy) => (
                  <option key={policy} value={policy}>
                    {DM_POLICY_LABELS[policy]}
                  </option>
                ))}
              </Select>
            </Field>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-3 font-serif text-lg">Engellenen hesaplar ({blocked.length})</h2>
          <p className="mb-4 text-sm text-muted">
            Engellediğiniz hesap sizi takip edemez ve profilinizi göremez. Aranızdaki takipler
            engelle birlikte kaldırılır.
          </p>

          {blocked.length === 0 ? (
            <EmptyState>Engellediğiniz hesap yok.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {blocked.map((member) => (
                <li key={member.username} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="text-sm">
                    <MemberLink member={member} />
                    <span className="ml-2 text-xs text-muted">{formatDate(member.blockedAt)}</span>
                  </div>
                  <ActionButton
                    action={unblockAction}
                    csrfToken={csrfToken}
                    label="Engeli kaldır"
                    fields={{ username: member.username }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
