"use client";

/**
 * The team avatar builder (D-194).
 *
 * The same renderer that draws the server's PNG draws the preview and every
 * option tile here, so a tile shows the member's own face with that one part
 * changed, and the preview is exactly the file the admin will download.
 *
 * Its look is its own (a CSS module, nothing global): the builder is a
 * standalone studio page, not part of the magazine or the panels.
 */
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { deleteOwnTeamAvatarAction, saveTeamAvatarAction } from "@/app/team/avatar/actions";
import {
  AVATAR_CATEGORIES,
  DEFAULT_AVATAR_CONFIG,
  EXTRAS,
  SKIN_TONES,
  TEAM_ROLE_SUGGESTIONS,
  randomAvatarConfig,
  type AvatarConfig,
  type AvatarExtra,
  type SingleChoiceKey,
} from "@/lib/avatar/options";
import { avatarDataUri } from "@/lib/avatar/render";
import { mix, shade } from "@/lib/avatar/geometry";
import type { ActionState } from "./form";
import styles from "./team-avatar-builder.module.css";

type Saved = { displayName: string; teamRole: string; config: AvatarConfig; updatedAt: string };

type Step = { id: string; label: string; keys: SingleChoiceKey[] };

const STEPS: Step[] = [
  { id: "face", label: "Yüz", keys: ["skinTone", "faceShape", "freckles", "mole"] },
  { id: "eyes", label: "Gözler", keys: ["eyeShape", "eyeColor", "eyebrows", "glasses", "glassesColor"] },
  { id: "mouth", label: "Burun & ağız", keys: ["nose", "mouth", "lipColor", "facialHair"] },
  { id: "hair", label: "Saç", keys: ["hairStyle", "hairTexture", "hairColor"] },
  { id: "jewelry", label: "Takılar", keys: ["earrings", "piercing", "necklace", "jewelryColor"] },
  { id: "outfit", label: "Kıyafet", keys: ["top", "topColor"] },
  { id: "extras", label: "Detaylar", keys: [] },
  { id: "send", label: "Gönder", keys: [] },
];

/** Colour choices show as swatches; everything else as a drawn thumbnail. */
const COLOR_KEYS = new Set<SingleChoiceKey>(["skinTone", "eyeColor", "lipColor", "hairColor", "glassesColor", "jewelryColor", "topColor"]);

/** The part of the canvas each thumbnail zooms into (square, in canvas units). */
const THUMB_VIEW: Partial<Record<SingleChoiceKey, string>> = {
  faceShape: "232 180 560 560",
  freckles: "362 430 300 300",
  mole: "362 430 300 300",
  eyeShape: "352 350 320 320",
  eyebrows: "352 330 320 320",
  nose: "402 440 220 220",
  mouth: "402 540 220 220",
  facialHair: "292 430 440 440",
  hairStyle: "92 50 840 840",
  hairTexture: "162 110 700 700",
  glasses: "292 300 440 440",
  earrings: "262 350 500 500",
  piercing: "262 330 500 500",
  // Clothing crops end at the canvas edge, where the drawing is cut off anyway
  necklace: "292 564 460 460",
  top: "262 524 500 500",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.primaryButton} disabled={pending}>
      {pending ? "Avatarınız hazırlanıyor…" : "Avatarımı Kaydet ve Gönder"}
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

export function TeamAvatarBuilder({
  csrfToken,
  account,
  saved,
}: {
  csrfToken: string;
  account: { name: string; email: string };
  saved: Saved | null;
}) {
  const [config, setConfig] = useState<AvatarConfig>(saved?.config ?? DEFAULT_AVATAR_CONFIG);
  const [stepIndex, setStepIndex] = useState(0);
  // Controlled, because React resets uncontrolled fields after a form action
  const [displayName, setDisplayName] = useState(saved?.displayName ?? account.name);
  const [teamRole, setTeamRole] = useState(saved?.teamRole ?? "");
  const [saveState, saveAction] = useActionState<ActionState, FormData>(saveTeamAvatarAction, null);
  const [deleteState, deleteAction] = useActionState<ActionState, FormData>(deleteOwnTeamAvatarAction, null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex]!;
  const preview = useMemo(() => avatarDataUri(config, { size: 480 }), [config]);

  // A result the member cannot see would feel like nothing happened
  useEffect(() => {
    if (saveState || deleteState) feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [saveState, deleteState]);

  const goTo = (index: number) => {
    setStepIndex(index);
    optionsRef.current?.scrollTo({ top: 0 });
    if (window.matchMedia("(max-width: 899px)").matches) {
      optionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const choose = (key: SingleChoiceKey, id: string) => setConfig((current) => ({ ...current, [key]: id }));

  const toggleExtra = (id: AvatarExtra) =>
    setConfig((current) => ({
      ...current,
      extras: current.extras.includes(id)
        ? current.extras.filter((extra) => extra !== id)
        : EXTRAS.map((extra) => extra.id).filter((extra) => extra === id || current.extras.includes(extra)),
    }));

  const skinHex = SKIN_TONES.find((tone) => tone.id === config.skinTone)!.hex;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          postscript
        </Link>
        <span className={styles.headerTitle}>Ekip Avatarı Stüdyosu</span>
      </header>

      <div className={styles.layout}>
        <section className={styles.stage} aria-label="Önizleme">
          <div className={styles.previewFrame}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URI SVG, nothing for next/image to optimise */}
            <img src={preview} alt="Avatarınızın önizlemesi" className={styles.preview} width={480} height={480} />
          </div>
          <div className={styles.stageActions}>
            <button type="button" className={styles.chipButton} onClick={() => setConfig(randomAvatarConfig())}>
              Rastgele
            </button>
            <button type="button" className={styles.chipButton} onClick={() => setConfig(DEFAULT_AVATAR_CONFIG)}>
              Sıfırla
            </button>
            {saved && (
              <button type="button" className={styles.chipButton} onClick={() => setConfig(saved.config)}>
                Kayıtlıya dön
              </button>
            )}
          </div>
          <nav className={styles.steps} aria-label="Adımlar">
            {STEPS.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                className={styles.stepTab}
                aria-current={index === stepIndex ? "step" : undefined}
                onClick={() => goTo(index)}
              >
                <span className={styles.stepNumber}>{index + 1}</span>
                {entry.label}
              </button>
            ))}
          </nav>
        </section>

        <div className={styles.panel} ref={optionsRef}>
          {saved && stepIndex === 0 && (
            <p className={styles.notice}>
              Kayıtlı avatarınız yüklendi. Değişiklik yapıp yeniden gönderebilirsiniz; yeni hâli
              eskisinin yerini alır.
            </p>
          )}

          <h1 className={styles.stepTitle}>
            <span className={styles.eyebrow}>
              Adım {stepIndex + 1} / {STEPS.length}
            </span>
            {step.label}
          </h1>

          {step.keys.map((key) => {
            if (key === "glassesColor" && config.glasses === "none") return null;
            const category = AVATAR_CATEGORIES.find((entry) => entry.key === key)!;
            const isColor = COLOR_KEYS.has(key);
            return (
              <fieldset key={key} className={styles.category}>
                <legend className={styles.categoryLabel}>{category.label}</legend>
                <div className={isColor ? styles.swatches : styles.tiles}>
                  {category.options.map((option) => {
                    const selected = config[key] === option.id;
                    if (isColor) {
                      const hex =
                        "hex" in option && option.hex !== ""
                          ? option.hex
                          : mix(shade(skinHex, 0.12), "#c2566a", 0.3);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={styles.swatch}
                          aria-pressed={selected}
                          aria-label={option.label}
                          title={option.label}
                          onClick={() => choose(key, option.id)}
                        >
                          <span className={styles.swatchColor} style={{ background: hex }} />
                          <span className={styles.swatchLabel}>{option.label}</span>
                        </button>
                      );
                    }
                    return (
                      <OptionTile
                        key={option.id}
                        label={option.label}
                        selected={selected}
                        onClick={() => choose(key, option.id)}
                        src={avatarDataUri({ ...config, [key]: option.id }, { viewBox: THUMB_VIEW[key], size: 132 })}
                      />
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          {step.id === "extras" && (
            <fieldset className={styles.category}>
              <legend className={styles.categoryLabel}>Küçük kişisel detaylar</legend>
              <p className={styles.hint}>İstediğiniz kadarını seçebilirsiniz; hiçbiri zorunlu değil.</p>
              <div className={styles.tiles}>
                {EXTRAS.map((extra) => {
                  const selected = config.extras.includes(extra.id);
                  const extras = selected ? config.extras : [...config.extras, extra.id];
                  return (
                    <OptionTile
                      key={extra.id}
                      label={extra.label}
                      selected={selected}
                      onClick={() => toggleExtra(extra.id)}
                      src={avatarDataUri({ ...config, extras }, { viewBox: "92 50 840 840", size: 132 })}
                    />
                  );
                })}
              </div>
            </fieldset>
          )}

          {step.id === "send" && (
            <div className={styles.sendStep}>
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
                  <span className={styles.fieldLabel}>Ad / görünen isim</span>
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
                  <span className={styles.hint}>Ekip sayfasında ve dosya adında bu isim kullanılır.</span>
                  {saveState?.fieldErrors?.displayName?.map((message) => (
                    <span key={message} className={styles.fieldError}>
                      {message}
                    </span>
                  ))}
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Ekipteki rolünüz</span>
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
                    <span key={message} className={styles.fieldError}>
                      {message}
                    </span>
                  ))}
                </label>

                <p className={styles.account}>
                  Avatar, giriş yaptığınız hesapla ilişkilendirilir: <strong>{account.name}</strong>{" "}
                  <span className={styles.muted}>({account.email})</span>
                </p>

                <p className={styles.privacy}>
                  Seçimlerinizin gerçek görünüşünüzü yansıtması gerekmez. Avatarınız, adınız ve ekip
                  rolünüzle birlikte dergi yönetimine iletilir; sitede veya sosyal medyada yalnızca
                  onayınızla kullanılır. Dilediğiniz zaman buradan silebilirsiniz. Ayrıntılar{" "}
                  <Link href="/kvkk" target="_blank">
                    KVKK aydınlatma metninde
                  </Link>
                  .
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
          )}

          <div className={styles.pager}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => goTo(stepIndex - 1)}
              disabled={stepIndex === 0}
            >
              ← Geri
            </button>
            {stepIndex < STEPS.length - 1 && (
              <button type="button" className={styles.primaryButton} onClick={() => goTo(stepIndex + 1)}>
                {stepIndex === STEPS.length - 2 ? "Bilgilere geç →" : "İleri →"}
              </button>
            )}
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <a href="https://www.elifyarencekic.com/" target="_blank" rel="noopener noreferrer">
          Designed by Elif Yaren Çekiç
        </a>
      </footer>
    </main>
  );
}

function OptionTile({
  label,
  selected,
  onClick,
  src,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  src: string;
}) {
  return (
    <button type="button" className={styles.tile} aria-pressed={selected} onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URI SVG thumbnail */}
      <img src={src} alt="" className={styles.tileImage} width={132} height={132} loading="lazy" />
      <span className={styles.tileLabel}>{label}</span>
    </button>
  );
}
