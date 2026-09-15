import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/username";
import { formatDate } from "@/lib/utils";
import { getMemberSettings, listBlockedMembers } from "@/services/social";
import { ActionButton, PanelForm } from "@/components/form";
import { SiteTitle } from "@/components/site-ui";
import { EmptyState, Field, Input, Select } from "@/components/ui";
import { MemberLink } from "@/components/social";
import { DM_POLICIES, DM_POLICY_LABELS } from "@/lib/direct-messages";
import { countAnonMutes } from "@/services/anon-box";
import {
  clearAnonMutesAction,
  setAnonBoxAction,
  setDirectMessagePolicyAction,
  setUsernameAction,
  unblockAction,
} from "../actions";

export const metadata = { title: "Topluluk ayarları" };

/** The design's five tabs, in its order. */
const SECTIONS = [
  { id: "profil", label: "Profil" },
  { id: "gizlilik", label: "Gizlilik" },
  { id: "bildirimler", label: "Bildirimler" },
  { id: "mesajlar", label: "Mesajlar" },
  { id: "hesap", label: "Hesap" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * One settings section as the design draws it: the tab column beside the
 * content, the section's own tab lit. The design repeats the column for every
 * section; only the first copy is a landmark and takes keyboard focus, so a
 * screen reader does not meet the same menu five times (D-116).
 */
function SettingsBlock({ id, first = false, children }: { id: SectionId; first?: boolean; children: ReactNode }) {
  const label = SECTIONS.find((section) => section.id === id)?.label ?? id;
  return (
    <section id={id} className="settings-block" aria-labelledby={`${id}-title`}>
      <nav
        className="settings-tabs"
        aria-label={first ? "Ayar bölümleri" : undefined}
        aria-hidden={first ? undefined : true}
      >
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={section.id === id ? "true" : undefined}
            tabIndex={first ? undefined : -1}
          >
            {section.label}
          </a>
        ))}
      </nav>
      <div className="settings-content">
        <h2 id={`${id}-title`} className="site-subheading">
          {label}
        </h2>
        {children}
      </div>
    </section>
  );
}

/**
 * The design's settings page. Every section stays on one page and each tab
 * jumps to its section: a member changing several things saves each form
 * without losing the others (D-113, D-116).
 */
export default async function SocialSettingsPage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";

  const [settings, blocked, mutes] = await Promise.all([
    getMemberSettings({ ...user }),
    listBlockedMembers({ ...user }),
    countAnonMutes({ ...user }),
  ]);

  return (
    <>
      <SiteTitle>Ayarlar</SiteTitle>

      <div className="settings-stack">
        <SettingsBlock id="profil" first>
          <div className="settings-profile-grid">
            <span className="settings-avatar" aria-hidden>
              {(settings.username ?? "?").charAt(0)}
            </span>

            <div className="min-w-0">
              <div className="settings-inline">
                <PanelForm
                  action={setUsernameAction}
                  csrfToken={csrfToken}
                  submitLabel="Kaydet"
                  submitClassName="settings-save"
                  submitContent={
                    <>
                      Kaydet <ArrowRight aria-hidden className="size-4" />
                    </>
                  }
                >
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

              <div className="settings-line">
                <span className="settings-line-label">Biyografi</span>
                <span className="settings-line-value">{settings.bio ?? "Henüz yazılmadı."}</span>
                <Link href="/account" className="settings-edit">
                  Düzenle <ArrowRight aria-hidden className="size-4" />
                </Link>
              </div>

              <div className="settings-line">
                <span className="settings-line-label">İlgi alanları</span>
                <span className="settings-chips">
                  <span className="settings-chip-empty">Henüz eklenmedi</span>
                </span>
                {/* Interests are not stored yet; adding them is a new personal data field (D-116) */}
                <span className="settings-edit" aria-disabled="true" title="İlgi alanları yakında">
                  Düzenle <ArrowRight aria-hidden className="size-4" />
                </span>
              </div>

              {settings.username && (
                <div className="settings-line">
                  <span className="settings-line-label">Profil</span>
                  <span className="settings-line-value">@{settings.username}</span>
                  <Link href={`/social/u/${settings.username}`} className="settings-edit">
                    Profilinize gidin <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </div>
              )}

              {/* Says exactly what getProfile hands to other members (D-089) */}
              <p className="settings-note">
                Topluluk profilinizde diğer üyeler kullanıcı adınızı, varsa mahlasınızı, kısa
                biyografinizi, rolünüzü, katılım tarihinizi ve takip sayılarınızı görür. Ad soyadınız,
                e-posta adresiniz ve doğum tarihiniz profilde gösterilmez.
              </p>
            </div>
          </div>
        </SettingsBlock>

        <SettingsBlock id="gizlilik">
          <h3 className="settings-subtitle">Anonim kutu</h3>
          <p className="mb-4 text-sm text-muted">
            Kutunuzu açarsanız profilinizde &ldquo;Anonim mesaj&rdquo; bağlantısı görünür ve e-postası
            doğrulanmış, 18 yaşını doldurmuş üyeler size adlarını göstermeden mesaj bırakabilir.
            Gönderenleri siz göremezsiniz; ancak gönderen dergi karşısında anonim değildir ve
            bildirdiğiniz bir mesajın göndereni yöneticilere görünür. Kutunuz kapalıyken yeni mesaj
            gelmez.
          </p>
          {settings.username ? (
            <>
              <PanelForm action={setAnonBoxAction} csrfToken={csrfToken} submitLabel="Kaydet">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="anonBoxEnabled"
                    defaultChecked={settings.anonBoxEnabled}
                    className="size-4 accent-accent"
                  />
                  Anonim kutum açık olsun
                </label>
              </PanelForm>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted">Susturulan gönderen: {mutes}</span>
                {mutes > 0 && (
                  <ActionButton
                    action={clearAnonMutesAction}
                    csrfToken={csrfToken}
                    label="Tüm susturmaları kaldır"
                    confirmMessage="Susturduğunuz gönderenler size yeniden anonim mesaj gönderebilecek. Devam edilsin mi?"
                  />
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Anonim kutu için önce bir kullanıcı adı seçin.</p>
          )}

          <h3 className="settings-subtitle mt-8">Engellenen hesaplar ({blocked.length})</h3>
          <p className="mb-4 text-sm text-muted">
            Engellediğiniz hesap sizi takip edemez ve profilinizi göremez. Aranızdaki takipler engelle
            birlikte kaldırılır.
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
        </SettingsBlock>

        <SettingsBlock id="bildirimler">
          {/* No notification preferences are stored yet; the section waits for them (D-116) */}
          <p className="settings-empty">
            Bildirim tercihleri çok yakında burada. Şimdilik bütün bildirimleriniz{" "}
            <Link href="/social/notifications" className="underline">
              Bildirimler
            </Link>{" "}
            sayfasında toplanır.
          </p>
        </SettingsBlock>

        <SettingsBlock id="mesajlar">
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
        </SettingsBlock>

        <SettingsBlock id="hesap">
          <p className="mb-5 text-sm">
            Ad soyadınız, e-posta adresiniz, şifreniz ve hesabınızın güvenliğiyle ilgili her şey
            Hesabım sayfasındadır.
          </p>
          <Link href="/account" className="site-button">
            Hesabım <ArrowRight aria-hidden />
          </Link>
        </SettingsBlock>
      </div>
    </>
  );
}
