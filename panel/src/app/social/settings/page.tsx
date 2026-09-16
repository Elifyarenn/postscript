import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { INTERESTS, MAX_INTERESTS } from "@/lib/interests";
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
  setInterestsAction,
  setPenNameAction,
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
        <nav className="settings-tabs fit-line" aria-label="Ayar bölümleri">
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
            <>
              {/* What the other members see, drawn from the same values as the profile page (D-142) */}
              <section className="settings-preview" aria-labelledby="settings-preview-title">
                <h3 id="settings-preview-title" className="settings-subtitle">
                  Profil önizlemesi
                </h3>

                <div className="settings-preview-card">
                  <div className="settings-preview-cover">
                    {settings.headerUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- served by our own media route, not optimised
                      <img src={settings.headerUrl} alt="" />
                    )}
                  </div>

                  <div className="settings-preview-main">
                    <span className="settings-preview-avatar" aria-hidden>
                      {settings.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- served by our own media route, not optimised
                        <img src={settings.avatarUrl} alt="" />
                      ) : (
                        (settings.username ?? "?").charAt(0)
                      )}
                    </span>

                    <div className="min-w-0">
                      <p className="settings-preview-name">
                        {settings.penName ?? settings.username ?? "Kullanıcı adı seçilmedi"}
                      </p>
                      <p className="settings-preview-handle">
                        {settings.username ? `@${settings.username}` : "Kullanıcı adı seçilmedi"}
                      </p>
                      <p className="settings-preview-bio">{settings.bio ?? "Biyografi eklenmemiş."}</p>
                    </div>
                  </div>
                </div>

                <p className="settings-note">Topluluktaki üyeler profilinizi böyle görür.</p>
              </section>

              <div className="settings-profile-grid">
                <div className="settings-photo">
                  <span className="settings-avatar" aria-hidden>
                    {settings.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- served by our own media route, not optimised
                      <img src={settings.avatarUrl} alt="" className="settings-avatar-image" />
                    ) : (
                      (settings.username ?? "?").charAt(0)
                    )}
                  </span>

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
                      <input type="hidden" name="kind" value="avatar" />
                      <Field
                        label="Profil fotoğrafı"
                        htmlFor="avatarImage"
                        hint="JPEG, PNG, GIF veya WEBP; en fazla 5 MB."
                      >
                        <Input
                          id="avatarImage"
                          name="avatarImage"
                          type="file"
                          required
                          accept="image/jpeg,image/png,image/gif,image/webp"
                        />
                      </Field>
                    </>
                  </PanelForm>

                  {settings.avatarUrl && (
                    <ActionButton
                      action={clearProfileImageAction}
                      csrfToken={csrfToken}
                      label="Profil fotoğrafını kaldır"
                      fields={{ kind: "avatar" }}
                      confirmMessage="Profil fotoğrafınız kaldırılsın mı?"
                    />
                  )}
                </div>

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

                <div className="settings-cover">
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
                      <input type="hidden" name="kind" value="header" />
                      <Field
                        label="Kapak fotoğrafı"
                        htmlFor="headerImage"
                        hint="Profilinizin üstünde geniş bir şerit olarak görünür. JPEG, PNG, GIF veya WEBP; en fazla 5 MB."
                      >
                        <Input
                          id="headerImage"
                          name="headerImage"
                          type="file"
                          required
                          accept="image/jpeg,image/png,image/gif,image/webp"
                        />
                      </Field>
                    </>
                  </PanelForm>

                  {settings.headerUrl && (
                    <ActionButton
                      action={clearProfileImageAction}
                      csrfToken={csrfToken}
                      label="Kapak fotoğrafını kaldır"
                      fields={{ kind: "header" }}
                      confirmMessage="Kapak fotoğrafınız kaldırılsın mı?"
                    />
                  )}
                </div>

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

                <div className="settings-inline">
                  <PanelForm
                    action={setPenNameAction}
                    csrfToken={csrfToken}
                    submitLabel="Kaydet"
                    submitClassName="settings-save"
                    submitContent={saveContent}
                  >
                    <Field
                      label="Mahlas"
                      htmlFor="penName"
                      hint="Profilinizde ve yazılarınızda görünen ad. Boş bırakırsanız kullanıcı adınız görünür."
                    >
                      <Input
                        id="penName"
                        name="penName"
                        defaultValue={settings.penName ?? ""}
                        maxLength={80}
                        autoComplete="off"
                      />
                    </Field>
                  </PanelForm>
                </div>

                <div className="settings-line">
                  <span className="settings-line-label">Ad soyad, e-posta, şifre</span>
                  <span className="settings-line-value">
                    Hesabınızla ilgili bilgiler Hesabım sayfasında.
                  </span>
                  <Link href="/account" className="settings-edit">
                    Hesabım <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </div>

                <div className="settings-interests">
                  <PanelForm
                    action={setInterestsAction}
                    csrfToken={csrfToken}
                    submitLabel="Kaydet"
                    submitClassName="settings-save"
                    submitContent={saveContent}
                  >
                    <fieldset>
                      <legend className="settings-line-label">İlgi alanları</legend>
                      <span className="settings-chips">
                        {INTERESTS.map((interest) => (
                          <label key={interest.id} className="settings-chip">
                            <input
                              type="checkbox"
                              name="interests"
                              value={interest.id}
                              defaultChecked={settings.interests.includes(interest.id)}
                            />
                            {interest.label}
                          </label>
                        ))}
                      </span>
                      <p className="settings-hint">
                        En fazla {MAX_INTERESTS} tane seçebilirsiniz. Yalnızca siz görürsünüz;
                        profilinizde gösterilmez.
                      </p>
                    </fieldset>
                  </PanelForm>
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
            </>
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
