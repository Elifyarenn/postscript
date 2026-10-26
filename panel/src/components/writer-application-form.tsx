"use client";

/**
 * The writer application questions (D-375).
 *
 * Client side only so the form can follow the answers: the sample becomes
 * required for long-term writing, and the experience box opens once
 * "Var" is picked. The service checks every rule again; this is only the
 * courtesy that keeps the applicant from submitting a form that will bounce.
 */
import { useState } from "react";
import { submitWriterApplicationAction } from "@/app/account/actions";
import { areaNameLang } from "@/lib/writer-areas";
import { PanelForm } from "./form";
import { Field, Input, Textarea } from "./ui";

const CHOICE_CLASSES = "flex cursor-pointer items-start gap-2 text-sm";

export function WriterApplicationForm({
  csrfToken,
  areas,
  phone,
}: {
  csrfToken: string;
  /** The active writer area names, in hand order. */
  areas: string[];
  /** The account's saved number, offered as the default. */
  phone: string | null;
}) {
  const [engagement, setEngagement] = useState<"long_term" | "one_time" | null>(null);
  const [hasExperience, setHasExperience] = useState<boolean | null>(null);
  const sampleRequired = engagement === "long_term";

  return (
    <PanelForm
      action={submitWriterApplicationAction}
      csrfToken={csrfToken}
      submitLabel="Yazar Olma İsteği Gönder"
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Nasıl yazmak istiyorsunuz?</legend>
        <label className={CHOICE_CLASSES}>
          <input
            type="radio"
            name="engagement"
            value="long_term"
            required
            onChange={() => setEngagement("long_term")}
            className="mt-0.5 size-4"
          />
          Uzun süreli — dergiye düzenli yazmak istiyorum
        </label>
        <label className={CHOICE_CLASSES}>
          <input
            type="radio"
            name="engagement"
            value="one_time"
            required
            onChange={() => setEngagement("one_time")}
            className="mt-0.5 size-4"
          />
          Tek seferlik — bir yazıyla katkı vermek istiyorum
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">İlgilendiğiniz kategoriler</legend>
        <p className="text-xs text-muted">Birden fazla seçebilirsiniz; en az biri gerekli.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {areas.map((area) => (
            <label key={area} className={CHOICE_CLASSES}>
              <input
                type="checkbox"
                name="interestAreas"
                value={area}
                className="mt-0.5 size-4 rounded border-line"
              />
              <span lang={areaNameLang(area)}>{area}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="İletişim numarası"
        htmlFor="applicationPhone"
        hint="Hesabınıza kaydedilir; yalnızca yönetim görür."
      >
        <Input
          id="applicationPhone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          maxLength={20}
          defaultValue={phone ?? ""}
          placeholder="05xx xxx xx xx"
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Yazı deneyiminiz var mı?</legend>
        <div className="flex gap-6">
          <label className={CHOICE_CLASSES}>
            <input
              type="radio"
              name="hasExperience"
              value="yes"
              required
              onChange={() => setHasExperience(true)}
              className="mt-0.5 size-4"
            />
            Var
          </label>
          <label className={CHOICE_CLASSES}>
            <input
              type="radio"
              name="hasExperience"
              value="no"
              required
              onChange={() => setHasExperience(false)}
              className="mt-0.5 size-4"
            />
            Yok
          </label>
        </div>
      </fieldset>

      {hasExperience && (
        <Field label="Deneyiminiz" htmlFor="experience">
          <Textarea
            id="experience"
            name="experience"
            required
            maxLength={2000}
            placeholder="Nerede, ne tür yazılar yazdınız?"
          />
        </Field>
      )}

      <Field
        label={sampleRequired ? "Örnek yazı dosyası" : "Örnek yazı dosyası (isteğe bağlı)"}
        htmlFor="sampleFile"
        hint={
          sampleRequired
            ? "Uzun süreli yazarlıkta zorunlu. PDF veya DOCX, en fazla 20 MB."
            : "PDF veya DOCX, en fazla 20 MB."
        }
      >
        <Input
          id="sampleFile"
          name="sampleFile"
          type="file"
          required={sampleRequired}
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
      </Field>

      <Field label="Not (isteğe bağlı)" htmlFor="note">
        <Textarea
          id="note"
          name="note"
          maxLength={2000}
          placeholder="Örnek eseriniz hakkında birkaç cümle…"
        />
      </Field>
    </PanelForm>
  );
}
