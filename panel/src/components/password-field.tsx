"use client";

/**
 * A password input that ticks its rules off as they are met.
 *
 * The checklist is a courtesy, not the guarantee: `checkPasswordPolicy` runs
 * the same functions on the server before anything is accepted, and also
 * refuses passwords from the common-password list, which no live checklist
 * could show without leaking the list.
 *
 * The input carries a `pattern` as well, so a browser with JavaScript switched
 * off still refuses to submit an insufficient password.
 */
import { useState } from "react";
import { Field, Input } from "./ui";
import { MIN_PASSWORD_LENGTH, passwordRules } from "@/lib/password-rules";
import { cn } from "@/lib/utils";

/** Anchored by the browser: at least one lower, one upper, one digit, 8+ long. */
const PATTERN = `(?=.*\\p{Ll})(?=.*\\p{Lu})(?=.*\\d).{${MIN_PASSWORD_LENGTH},}`;

function Tick({ met }: { met: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none",
        met ? "border-accent bg-accent text-white" : "border-line text-transparent",
      )}
    >
      ✓
    </span>
  );
}

export function PasswordField({
  id = "password",
  name = "password",
  label = "Şifre",
  autoComplete = "new-password",
  autoFocus,
}: {
  id?: string;
  name?: string;
  label?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const rules = passwordRules(value);

  return (
    <div className="space-y-2">
      <Field label={label} htmlFor={id}>
        <Input
          id={id}
          name={name}
          type="password"
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          pattern={PATTERN}
          // The browser's own bubble would repeat the checklist badly
          title="Şifre kurallarını sağlayın"
          aria-describedby={`${id}-rules`}
        />
      </Field>

      <ul id={`${id}-rules`} className="space-y-1" aria-live="polite">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              rule.met ? "text-accent" : "text-muted",
            )}
          >
            <Tick met={rule.met} />
            <span>{rule.label}</span>
            {/* Announced to a screen reader without cluttering the visual list */}
            <span className="sr-only">{rule.met ? "sağlandı" : "sağlanmadı"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
