/**
 * Shared shape for server action results.
 *
 * Actions never throw at the browser: they translate an `AppError` into a
 * message plus field errors that the form re-renders, which keeps the error
 * handling identical everywhere.
 */
import "server-only";
import { isAppError } from "@/lib/errors";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
  /** One-time values an action needs to show once, such as recovery codes. */
  codes?: string[];
} | null;

/** Wraps an action body and turns any failure into a renderable state. */
export async function runAction(
  body: () => Promise<ActionState | void>,
): Promise<ActionState> {
  try {
    const result = await body();
    return result ?? { success: "Kaydedildi." };
  } catch (error) {
    if (isAppError(error)) {
      return { error: error.message, fieldErrors: error.details };
    }
    // A redirect from a server action is thrown, and must not be swallowed
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    console.error("Unhandled action error:", error);
    return { error: "Beklenmeyen bir hata oluştu." };
  }
}

/** Reads a required text field from a FormData. */
export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Reads an optional text field; empty strings become null. */
export function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

export function checkbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function numberField(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Splits a comma separated input into a clean list. */
export function listField(formData: FormData, key: string): string[] {
  return text(formData, key)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
