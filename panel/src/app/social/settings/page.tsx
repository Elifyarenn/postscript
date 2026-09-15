import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/username";
import { formatDate } from "@/lib/utils";
import { getMemberSettings, listBlockedMembers } from "@/services/social";
import { ActionButton, PanelForm } from "@/components/form";
import { SiteTitle } from "@/components/site-ui";
import { EmptyState, Field, Input, Select, Textarea } from "@/components/ui";
import { MemberLink } from "@/components/social";
import { DM_POLICIES, DM_POLICY_LABELS } from "@/lib/direct-messages";
import { countAnonMutes } from "@/services/anon-box";
import {
  clearAnonMutesAction,
  clearProfileImageAction,
  setAnonBoxAction,
  setBioAction,
  setProfileImageAction,
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

/** The member's two pictures, uploaded one form each (D-141). */
const IMAGE_FIELDS = [
  { kind: "avatar", label: "Profil fotoğrafı", field: "avatarImage" },
  { kind: "header", label: "Kapak fotoğrafı", field: "headerImage" },
] as const;

function parseSection(value: string | undefined): SectionId {
  return SECTIONS.find((section) => section.id === value)?.id ?? "profil";
}

function sectionHref(id: SectionId): string {
  return id === "profil" ? "/social/settings" : `/social/settings?bolum=${id}`;
}

/**
 * The design's settings page (D-113, D-136): the tab column beside one card.
 * The column chooses which section the card shows, so the page holds one
 * section at a time instead of all five stacked; each form saves on its own.
 */
export default async function SocialSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ bolum?: string }>;
}) {
  const [{ user }, params] = await Promise.all([requireSession(), searchParams]);
  const section = parseSection(params.bolum);
  const label = SECTIONS.find((item) => item.id === section)?.label ?? "Profil";
  const csrfToken = (await readCsrfToken()) ?? "";

  const [settings, blocked, mutes] = await Promise.all([
    getMemberSettings({ ...user }),
    listBlockedMembers({ ...user }),
    countAnonMutes({ ...user }),
  ]);

  const saveContent = (
    <>
      Kaydet <ArrowRight aria-hidden className="size-4" />
    </>
  );

  return (
    <>
      <SiteTitle>Ayarlar</SiteTitle>

      <section className="settings-block" aria-labelledby="settings-title">
        <nav className="settings-tabs" aria-label="Ayar bölümleri">
          {SECTIONS.map((item) => (
            <Link
              key={item.id}
              href={sectionHref(item.id)}
              aria-current={item.id === section ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="settings-content">
          <h2 id="settings-title" className="site-subheading">
            {label}
          </h2>

          {section === "profil" && (
            <div className="settings-profile-grid">
              <span className="settings-avatar" aria-hidden>
                {settings.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served by our own media route, not optimised
                  <img src={settings.avatarUrl} alt="" className="settings-avatar-image" />
                ) : (
                  (settings.username ?? "?").charAt(0)
                )}
              </span>

              <div className="settings-profile-forms min-w-0">
                <div className="settings-inline">
                  <PanelForm
                    action={setUsernameAction}
                    csrfToken={csrfToken}
                    submitLabel="Kaydet"
                    submitClassName="settings-save"
                    submitContent={saveContent}
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

                <div className="settings-images">
                  {IMAGE_FIELDS.map((image) => (
                    <div key={image.kind} className="settings-image">
                      <PanelForm
                        action={setProfileImageAction}
                        csrfToken={csrfToken}
                        submitLabel="Yükle"
                        submitClassName="settings-save"
                        submitContent={
                          <>
                            Yükle <ArrowRight aria-hidden className="size-4" />
                          </>
                        }
                      >
                        <>
                          <input type="hidden" name="kind" value={image.kind} />
                          <Field
                            label={image.label}
                            htmlFor={image.field}
                            hint="JPEG, PNG, GIF veya WEBP; en fazla 5 MB. Topluluktaki üyeler görür."
                          >
                            <Input
                              id={image.field}
                              name={image.field}
                              type="file"
                              required
                              accept="image/jpeg,image/png,image/gif,image/webp"
                            />
                          </Field>
                        </>
                      </PanelForm>

                      {(image.kind === "avatar" ? settings.avatarUrl : settings.headerUrl) && (
                        <ActionButton
                          action={clearProfileImageAction}
                          csrfToken={csrfToken}
                          label={`${image.label}nı kaldır`}
                          fields={{ kind: image.kind }}
                          confirmMessage={`${image.label}nız kaldırılsın mı?`}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {settings.headerUrl && (
                  <div className="settings-header-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served by our own media route, not optimised */}
                    <img src={settings.headerUrl} alt="" />
                  </div>
                )}

                <div className="settings-bio">
                  <PanelForm
                    action={setBioAction}
                    csrfToken={csrfToken}
                    submitLabel="Kaydet"
                    submitClassName="settings-save"
                    submitContent={saveContent}
                  >
                    <Field
                      label="Biyografi"
                      htmlFor="bio"
                      hint="Topluluk profilinizde görünür; en fazla 2000 karakter. Boş bırakırsanız silinir."
                    >
                      <Textarea id="bio" name="bio" defaultValue={settings.bio ?? ""} maxLength={2000} rows={4} />
                    </Field>
                  </PanelForm>
                </div>

                <div className="settings-line">
                  <span className="settings-line-label">Ad soyad ve mahlas</span>
                  <span className="settings-line-value">Hesabım sayfasında düzenlenir.</span>
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
                  biyografinizi, rolünüzü, katılım tarihinizi ve takip sayılarınızı görür. Ad
                  soyadınız, e-posta adresiniz ve doğum tarihiniz profilde gösterilmez.
                </p>
              </div>
            </div>
          )}

          {section === "gizlilik" && (
            <>
              <h3 className="settings-subtitle">Anonim kutu</h3>
              <p className="mb-4 text-sm text-muted">
                Kutunuzu açarsanız profilinizde &ldquo;Anonim mesaj&rdquo; bağlantısı görünür ve
                e-postası doğrulanmış, 18 yaşını doldurmuş üyeler size adlarını göstermeden mesaj
                bırakabilir. Gönderenleri siz göremezsiniz; ancak gönderen dergi karşısında anonim
                değildir ve bildirdiğiniz bir mesajın göndereni yöneticilere görünür. Kutunuz
                kapalıyken yeni mesaj gelmez.
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
                <p className="text-sm text-muted">
                  Anonim kutu için önce{" "}
                  <Link href={sectionHref("profil")} className="underline">
                    bir kullanıcı adı seçin
                  </Link>
                  .
                </p>
              )}

              <h3 className="settings-subtitle mt-8">Engellenen hesaplar ({blocked.length})</h3>
              <p className="mb-4 text-sm text-muted">
                Engellediğiniz hesap sizi takip edemez ve profilinizi göremez. Aranızdaki takipler
                engelle birlikte kaldırılır.
              </p>
              {blocked.length === 0 ? (
                <EmptyState>Engellediğiniz hesap yok.</EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {blocked.map((member) => (
                    <li
                      key={member.username}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
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
            </>
          )}

          {section === "bildirimler" && (
            // No notification preferences are stored yet; the section waits for them (D-116)
            <p className="settings-empty">
              Bildirim tercihleri çok yakında burada. Şimdilik bütün bildirimleriniz{" "}
              <Link href="/social/notifications" className="underline">
                Bildirimler
              </Link>{" "}
              sayfasında toplanır.
            </p>
          )}

          {section === "mesajlar" && (
            <>
              <p className="mb-4 text-sm text-muted">
                Özel mesajlaşma yalnızca 18 yaşını doldurmuş üyeler arasında açıktır. Daha önce
                yazdığınız bir üye, tercihiniz &ldquo;Kimse&rdquo; değilse size yanıt verebilir.
                Engellediğiniz hesaplar size hiçbir durumda yazamaz. Özel mesajlarınızı yöneticiler
                okuyamaz.
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
            </>
          )}

          {section === "hesap" && (
            <>
              <p className="mb-5 text-sm">
                Ad soyadınız, e-posta adresiniz, şifreniz ve hesabınızın güvenliğiyle ilgili her şey
                Hesabım sayfasındadır.
              </p>
              <Link href="/account" className="site-button">
                Hesabım <ArrowRight aria-hidden />
              </Link>
            </>
          )}
        </div>
      </section>
    </>
  );
}
