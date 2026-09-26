"use client";

/**
 * One issue window as two Turkey-time fields (D-261). The browser refuses an
 * end before its start, or one end without the other, before the form is
 * sent; the server and the database check the same rule again.
 */
import { useRef } from "react";
import { Field, Input } from "./ui";

export function PeriodFields({
  label,
  idPrefix,
  opensName,
  closesName,
  opensDefault,
  closesDefault,
}: {
  label: string;
  idPrefix: string;
  opensName: string;
  closesName: string;
  /** `YYYY-MM-DDTHH:mm` in Turkey's time, or "". */
  opensDefault: string;
  closesDefault: string;
}) {
  const opensRef = useRef<HTMLInputElement>(null);
  const closesRef = useRef<HTMLInputElement>(null);

  // datetime-local values of the same length compare correctly as strings
  const check = () => {
    const opens = opensRef.current;
    const closes = closesRef.current;
    if (!opens || !closes) return;
    opens.setCustomValidity(!opens.value && closes.value ? "Başlangıcı da girin." : "");
    closes.setCustomValidity(
      opens.value && !closes.value
        ? "Bitişi de girin."
        : opens.value && closes.value && opens.value >= closes.value
          ? "Bitiş, başlangıçtan sonra olmalı."
          : "",
    );
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Başlangıç" htmlFor={`${idPrefix}-opens`}>
          <Input
            ref={opensRef}
            id={`${idPrefix}-opens`}
            name={opensName}
            type="datetime-local"
            defaultValue={opensDefault}
            onChange={check}
          />
        </Field>
        <Field label="Bitiş" htmlFor={`${idPrefix}-closes`}>
          <Input
            ref={closesRef}
            id={`${idPrefix}-closes`}
            name={closesName}
            type="datetime-local"
            defaultValue={closesDefault}
            onChange={check}
          />
        </Field>
      </div>
    </fieldset>
  );
}
