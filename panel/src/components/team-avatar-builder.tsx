"use client";

/**
 * The team avatar builder (D-194, redesigned in D-195).
 *
 * Picrew-like: pick a part, the avatar changes at once, move to another
 * category. Categories on the left, the live avatar in the middle, the active
 * category's options on the right; on a phone the three stack, with the
 * avatar kept on screen.
 *
 * - The preview is the avatar's layers stacked as separate SVGs, drawn by the
 *   same renderer as the server's PNG. The cream behind them is the page's,
 *   never part of the file.
 * - Every option tile is the member's own avatar with that one part changed
 *   (hair styles on a plain face), so a choice is seen before it is made.
 * - One configuration object holds every choice; each change, "Rastgele" and
 *   "Sıfırla" go through a history, so any of them can be undone.
 *
 * Its look is its own (a CSS module): a studio page in the magazine's colours,
 * not part of the magazine frame or the panels.
 */
import { useActionState, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { deleteOwnTeamAvatarAction, saveTeamAvatarAction } from "@/app/team/avatar/actions";
import {
  CATEGORIES,
  DEFAULT_AVATAR_CONFIG,
  FIELDS,
  PRESETS,
  TEAM_ROLE_SUGGESTIONS,
  randomAvatarConfig,
  type AvatarConfig,
  type CategoryId,
  type Field,
  type FieldKey,
  type SetKey,
} from "@/lib/avatar/registry";
import { avatarDataUri, renderAvatarLayers, thumbOmit } from "@/lib/avatar/render";
import { historyReducer } from "@/lib/avatar/history";
import { mix, shade } from "@/lib/avatar/geometry";
import { SKIN_TONES } from "@/lib/avatar/assets/face";
import { isImageHair } from "@/lib/avatar/assets/hair-images";
import { isHeadscarf } from "@/lib/avatar/assets/headscarf";
import { HEADWEAR } from "@/lib/avatar/assets/accessories";
import { bodyFont, noteFont } from "@/lib/fonts";
import type { ActionState } from "./form";
import styles from "./team-avatar-builder.module.css";

type Saved = { displayName: string; teamRole: string; config: AvatarConfig; updatedAt: string };

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const CATEGORY_ICONS: Record<CategoryId | "send", ReactNode> = {
  hair: <path d="M5 15c-1-6 2-11 7-11s8 5 7 11M5 15c1-3 3-5 5-6M19 15c-1-3-3-5-6-7M8 20c-2-2-3-3-3-5M16 20c2-2 3-3 3-5" />,
  face: <path d="M12 3c-4 0-7 3-7 8 0 5 3 10 7 10s7-5 7-10c0-5-3-8-7-8z" />,
  skin: <><circle cx="12" cy="12" r="8" /><path d="M8 10h.01M12 8h.01M16 10h.01M9 15c2 1.5 4 1.5 6 0" /></>,
  eyes: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  brows: <path d="M4 14c3-4 13-4 16 0" />,
  nose: <path d="M12 4c0 5-4 8-4 12a4 3 0 0 0 8 0c0-4-4-7-4-12z" />,
  mouth: <path d="M3 12c3-3 6-4 9-2 3-2 6-1 9 2-3 3-6 5-9 5s-6-2-9-5zM3 12h18" />,
  details: <><path d="M12 3c-4 0-7 3-7 8 0 5 3 10 7 10s7-5 7-10c0-5-3-8-7-8z" /><path d="M9 13h.01M11 15h.01M15 12h.01" /></>,
  glasses: <><circle cx="7" cy="13" r="4" /><circle cx="17" cy="13" r="4" /><path d="M11 13h2" /></>,
  piercing: <><circle cx="12" cy="7" r="3" /><circle cx="12" cy="16" r="5" /></>,
  accessory: <><path d="M5 4c1 7 3 10 7 10s6-3 7-10" /><path d="M12 14l-2 3 2 3 2-3z" /></>,
  clothing: <path d="M8 4l-5 3 2 4 3-1v10h8V10l3 1 2-4-5-3c-1 2-2 3-4 3s-3-1-4-3z" />,
  extra: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z" />,
  send: <path d="M4 12l16-8-6 16-3-7-7-1z" />,
};

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.primaryButton} disabled={pending}>
      {pending ? "Avatarınız hazırlanıyor…" : "Avatarımı Gönder"}
    </button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.dangerLink} disabled={pending}>
      {pending ? "Siliniyor…" : "Kayıtlı avatarımı sil"}
    </button>
  );
}

/** The live avatar, one stacked SVG per layer; an unchanged layer keeps its DOM. */
function StackedAvatar({ config }: { config: AvatarConfig }) {
  const layers = useMemo(() => renderAvatarLayers(config, 1024), [config]);
  return (
    <div className={styles.stack} role="img" aria-label="Avatarınızın canlı önizlemesi">
      {layers.map((part) => (
        <div key={part.layer} className={styles.stackLayer} data-layer={part.layer} dangerouslySetInnerHTML={{ __html: part.svg }} />
      ))}
    </div>
  );
}

function colorHex(field: Field, id: string, config: AvatarConfig): string {
  const option = (field.options as readonly { id: string; hex?: string }[]).find((entry) => entry.id === id);
  if (option?.hex) return option.hex;
  // The natural lip colour follows the skin
  const skin = SKIN_TONES.find((tone) => tone.id === config.skinTone)!.hex;
  return mix(shade(skin, 0.14), "#d0606f", 0.34);
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

const SEND = "send" as const;
type View = CategoryId | typeof SEND;
const VIEWS: View[] = [...CATEGORIES.map((category) => category.id), SEND];

export function TeamAvatarBuilder({
  csrfToken,
  account,
  saved,
}: {
  csrfToken: string;
  account: { name: string; email: string };
  saved: Saved | null;
}) {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: saved?.config ?? DEFAULT_AVATAR_CONFIG,
    future: [],
  });
  const config = history.present;
  const [view, setView] = useState<View>("hair");
  const [tab, setTab] = useState<FieldKey | null>(null);
  // Controlled, because React resets uncontrolled fields after a form action
  const [displayName, setDisplayName] = useState(saved?.displayName ?? account.name);
  const [teamRole, setTeamRole] = useState(saved?.teamRole ?? "");
  const [saveState, saveAction] = useActionState<ActionState, FormData>(saveTeamAvatarAction, null);
  const [deleteState, deleteAction] = useActionState<ActionState, FormData>(deleteOwnTeamAvatarAction, null);
  const zoomRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const set = (next: AvatarConfig) => dispatch({ type: "set", config: next });

  // Ctrl+Z / Ctrl+Y (and ⌘ on a Mac), but never while typing in a field
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea")) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: "undo" });
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A result the member cannot see would feel like nothing happened
  useEffect(() => {
    if (saveState || deleteState) feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [saveState, deleteState]);

  const category = CATEGORIES.find((entry) => entry.id === view);
  // Under a headscarf there is no hair to give a texture or a colour, and the
  // fabric colour means nothing without one (D-219); nor a hat colour without
  // a hat (D-224)
  const scarfOn = isHeadscarf(config.hairStyle);
  const hatOn = config.extras.some((id) => HEADWEAR.has(id));
  const relevant = (key: FieldKey) => {
    if (key === "scarfColor") return scarfOn;
    if (key === "headwearColor") return hatOn;
    return !(scarfOn && (key === "hairTexture" || key === "hairColor"));
  };
  const choiceFields = (category?.fields ?? []).filter((key) => FIELDS[key].kind !== "color" && relevant(key)) as FieldKey[];
  const colorFields = (category?.fields ?? []).filter((key) => FIELDS[key].kind === "color" && relevant(key)) as FieldKey[];
  const activeTab = tab && choiceFields.includes(tab) ? tab : (choiceFields[0] ?? null);
  const viewIndex = VIEWS.indexOf(view);

  const goTo = (next: View) => {
    setView(next);
    setTab(null);
    if (window.matchMedia("(max-width: 899px)").matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const toggle = (key: SetKey, id: string) => {
    const list = config[key] as readonly string[];
    const next = list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
    set({ ...config, [key]: FIELDS[key].options.map((option) => option.id).filter((entry) => next.includes(entry)) } as AvatarConfig);
  };

  return (
    <main className={`${styles.page} ${bodyFont.variable} ${noteFont.variable}`}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo}>postscript</span>
          <span className={styles.subtitle}>Ekip avatarı oluşturucu</span>
        </Link>
        <p className={styles.headerNote} aria-hidden="true">
          aynı hikâyede, farklı yüzler. <span className={styles.doodle}>✳</span>
        </p>
      </header>

      <div className={styles.studio}>
        {/* ---------------- Categories ---------------- */}
        <nav className={styles.nav} aria-label="Kategoriler">
          <p className={`${styles.note} ${styles.navNote}`} aria-hidden="true">
            Adım adım kategorilerle kolay kullanım.
          </p>
          <ul className={styles.navList}>
            {VIEWS.map((entry) => {
              const label = entry === SEND ? "Gönder" : CATEGORIES.find((item) => item.id === entry)!.label;
              return (
                <li key={entry}>
                  <button
                    type="button"
                    className={`${styles.navItem} ${entry === SEND ? styles.navSend : ""}`}
                    aria-current={entry === view ? "page" : undefined}
                    onClick={() => goTo(entry)}
                  >
                    <Icon>{CATEGORY_ICONS[entry]}</Icon>
                    <span>{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ---------------- Preview ---------------- */}
        <section className={styles.stage} aria-label="Canlı önizleme">
          <div className={styles.previewCard}>
            <div className={styles.previewTools}>
              <button type="button" className={styles.iconButton} onClick={() => dispatch({ type: "undo" })} disabled={history.past.length === 0} aria-label="Geri al" title="Geri al (Ctrl+Z)">
                <Icon size={20}><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></Icon>
              </button>
              <button type="button" className={styles.iconButton} onClick={() => dispatch({ type: "redo" })} disabled={history.future.length === 0} aria-label="İleri al" title="İleri al (Ctrl+Y)">
                <Icon size={20}><path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" /></Icon>
              </button>
              <span className={styles.spacer} />
              <button type="button" className={styles.iconButton} onClick={() => zoomRef.current?.showModal()} aria-label="Büyük göster" title="Büyük göster">
                <Icon size={20}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Icon>
              </button>
            </div>
            <StackedAvatar config={config} />
          </div>

          <div className={styles.stageActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => set(randomAvatarConfig())}>
              <Icon size={20}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01" /></Icon>
              Rastgele
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => set(DEFAULT_AVATAR_CONFIG)}>
              <Icon size={20}><path d="M4 12a8 8 0 1 0 3-6.3M4 4v5h5" /></Icon>
              Sıfırla
            </button>
            {saved && (
              <button type="button" className={styles.secondaryButton} onClick={() => set(saved.config)}>
                Kayıtlıya dön
              </button>
            )}
          </div>

          <div className={styles.stageNotes} aria-hidden="true">
            <p className={styles.sticky}>gerçek sen, kendi tarzın. ♡</p>
            <p className={styles.note}>
              Canlı önizleme alanı.
              <br />
              Arka plan sade, PNG çıktısı transparan.
            </p>
          </div>
        </section>

        {/* ---------------- Options ---------------- */}
        <section className={styles.panel} ref={panelRef} aria-label="Seçenekler">
          <div className={styles.panelCard}>
            {view === SEND ? (
              <div className={styles.sendStep}>
                <h1 className={styles.panelTitle}>Son adım</h1>
                <p className={styles.lead}>Avatarınız hazırsa bilgilerinizi girin ve gönderin.</p>

                <div ref={feedbackRef} aria-live="polite">
                  {saveState?.error && <p className={styles.errorBox}>{saveState.error}</p>}
                  {saveState?.success && <p className={styles.successBox}>{saveState.success}</p>}
                  {deleteState?.error && <p className={styles.errorBox}>{deleteState.error}</p>}
                  {deleteState?.success && <p className={styles.successBox}>{deleteState.success}</p>}
                </div>

                <form action={saveAction} className={styles.form}>
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  <input type="hidden" name="config" value={JSON.stringify(config)} />

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Ad / Görünen İsim</span>
                    <input
                      name="displayName"
                      className={styles.input}
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={60}
                      autoComplete="name"
                    />
                    <span className={styles.hint}>Ekip tanıtımında ve dosya adında bu isim kullanılır.</span>
                    {saveState?.fieldErrors?.displayName?.map((message) => (
                      <span key={message} className={styles.fieldError}>{message}</span>
                    ))}
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Ekip Rolü</span>
                    <input
                      name="teamRole"
                      className={styles.input}
                      value={teamRole}
                      onChange={(event) => setTeamRole(event.target.value)}
                      list="team-role-suggestions"
                      placeholder="Örn. Editör, Çizer, Yazar"
                      required
                      minLength={2}
                      maxLength={60}
                    />
                    <datalist id="team-role-suggestions">
                      {TEAM_ROLE_SUGGESTIONS.map((role) => (
                        <option key={role} value={role} />
                      ))}
                    </datalist>
                    {saveState?.fieldErrors?.teamRole?.map((message) => (
                      <span key={message} className={styles.fieldError}>{message}</span>
                    ))}
                  </label>

                  <p className={styles.account}>
                    Avatar, giriş yaptığınız hesapla ilişkilendirilir: <strong>{account.name}</strong>{" "}
                    <span className={styles.muted}>({account.email})</span>
                  </p>

                  <p className={styles.privacy}>
                    Seçimlerinizin gerçek görünüşünüzü yansıtması gerekmez. Avatarınız, adınız ve ekip rolünüzle
                    birlikte dergi yönetimine iletilir; sitede veya sosyal medyada yalnızca onayınızla kullanılır.
                    Dilediğiniz zaman buradan silebilirsiniz. Ayrıntılar{" "}
                    <Link href="/kvkk" target="_blank">KVKK aydınlatma metninde</Link>.
                  </p>

                  <SubmitButton />
                </form>

                {saved && (
                  <form
                    action={deleteAction}
                    className={styles.deleteForm}
                    onSubmit={(event) => {
                      if (!window.confirm("Kayıtlı avatarınız kalıcı olarak silinsin mi?")) event.preventDefault();
                    }}
                  >
                    <input type="hidden" name="csrfToken" value={csrfToken} />
                    <DeleteButton />
                  </form>
                )}
              </div>
            ) : (
              <>
                {saved && view === "hair" && (
                  <p className={styles.notice}>
                    Kayıtlı avatarınız yüklendi. Değiştirip yeniden gönderdiğinizde yenisi eskisinin yerini alır.
                  </p>
                )}
                <h1 className={styles.panelTitle}>{category!.label}</h1>

                {choiceFields.length > 1 && (
                  <div className={styles.tabs} role="tablist" aria-label={`${category!.label} seçenekleri`}>
                    {choiceFields.map((key) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={key === activeTab}
                        className={styles.tab}
                        onClick={() => setTab(key)}
                      >
                        {FIELDS[key].label}
                      </button>
                    ))}
                  </div>
                )}

                {activeTab && <OptionGrid fieldKey={activeTab} config={config} onPick={set} onToggle={toggle} />}

                {colorFields.map((key) => {
                  const field: Field = FIELDS[key];
                  // A frame colour means nothing without a frame
                  if (key === "glassesColor" && config.glasses === "none") return null;
                  // A ready-made hair picture carries its own colour (D-200)
                  const fixedByPicture = key === "hairColor" && isImageHair(config.hairStyle);
                  return (
                    <fieldset key={key} className={styles.colors}>
                      <legend className={styles.colorsLabel}>{field.label}</legend>
                      {fixedByPicture && (
                        <p className={styles.hint}>
                          Bu saç modeli hazır bir görsel; rengi görselden gelir, seçtiğiniz renk uygulanmaz.
                        </p>
                      )}
                      <div className={styles.swatches}>
                        {field.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={styles.swatch}
                            style={{ background: colorHex(field, option.id, config) }}
                            aria-pressed={config[key] === option.id}
                            aria-label={option.label}
                            title={option.label}
                            onClick={() => set({ ...config, [key]: option.id } as AvatarConfig)}
                          />
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </>
            )}
          </div>

          <p className={`${styles.note} ${styles.panelNote}`} aria-hidden="true">
            Her kategori için farklı seçenekler.
          </p>

          <div className={styles.pager}>
            <button type="button" className={styles.outlineButton} onClick={() => goTo(VIEWS[viewIndex - 1]!)} disabled={viewIndex === 0}>
              ← Geri
            </button>
            {view !== SEND && (
              <button type="button" className={styles.primaryButton} onClick={() => goTo(VIEWS[viewIndex + 1]!)}>
                {viewIndex === VIEWS.length - 2 ? "Bitir →" : "İleri →"}
              </button>
            )}
          </div>
        </section>
      </div>

      {/* ---------------- Examples ---------------- */}
      <section className={styles.examples} aria-label="Örnek avatarlar">
        <h2 className={styles.examplesTitle}>
          Farklı tarzlardan örnek avatarlar <span className={styles.doodle}>✳</span>
        </h2>
        <p className={styles.hint}>Birine dokunun, oradan başlayın; seçiminizi Geri Al ile geri alabilirsiniz.</p>
        <ul className={styles.exampleList}>
          {PRESETS.map((preset) => (
            <li key={preset.label}>
              <button type="button" className={styles.example} onClick={() => set(preset.config)} title={`${preset.label}: buradan başla`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- an SVG drawn from the preset */}
                <img src={avatarDataUri(preset.config, { view: "full", size: 220 })} alt={preset.label} width={220} height={220} loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <footer className={styles.footer}>
        <div>
          <span className={styles.logo}>postscript</span>
          <span className={styles.subtitle}>Dijital dergi</span>
        </div>
        <p className={styles.tagline}>Avatar oluştur. Ekibe katıl. Hikâyenin bir parçası ol.</p>
        <p className={styles.note} aria-hidden="true">aynı ekip, farklı hikâyeler. ♡</p>
        <a href="https://www.elifyarencekic.com/" target="_blank" rel="noopener noreferrer" className={styles.credit}>
          Designed by Elif Yaren Çekiç
        </a>
      </footer>

      <dialog ref={zoomRef} className={styles.zoom} onClick={(event) => event.target === zoomRef.current && zoomRef.current?.close()}>
        <div className={styles.zoomInner}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the same avatar, larger */}
          <img src={avatarDataUri(config, { size: 900 })} alt="Avatarınızın büyük önizlemesi" width={900} height={900} />
          <button type="button" className={styles.outlineButton} onClick={() => zoomRef.current?.close()}>
            Kapat
          </button>
        </div>
      </dialog>
    </main>
  );
}

/** The thumbnails of one choice (or set of choices). */
function OptionGrid({
  fieldKey,
  config,
  onPick,
  onToggle,
}: {
  fieldKey: FieldKey;
  config: AvatarConfig;
  onPick: (config: AvatarConfig) => void;
  onToggle: (key: SetKey, id: string) => void;
}) {
  const field: Field = FIELDS[fieldKey];
  if (field.kind === "color") return null;
  const omit = thumbOmit(fieldKey);
  const isSet = field.kind === "set";
  const current = config[fieldKey] as string | readonly string[];

  return (
    <>
      {isSet && field.hint && <p className={styles.hint}>{field.hint}</p>}
      <div className={styles.grid}>
        {field.options.map((option) => {
          const selected = Array.isArray(current) ? current.includes(option.id) : current === option.id;
          // A set's tile shows the part added (or, when on, as it is)
          const shown = isSet
            ? ({ ...config, [fieldKey]: selected ? current : [...(current as string[]), option.id] } as AvatarConfig)
            : ({ ...config, [fieldKey]: option.id } as AvatarConfig);
          return (
            <button
              key={option.id}
              type="button"
              className={styles.tile}
              aria-pressed={selected}
              onClick={() => (isSet ? onToggle(fieldKey as SetKey, option.id) : onPick(shown))}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- an SVG thumbnail */}
              <img src={avatarDataUri(shown, { view: field.thumb, size: 180, omit })} alt="" width={180} height={180} loading="lazy" />
              <span className={styles.tileLabel}>{option.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
