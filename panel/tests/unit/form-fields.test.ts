import { describe, expect, it } from "vitest";
import { isFailedResult, isSecretField } from "@/lib/form-fields";

describe("isFailedResult", () => {
  it("treats an error message or field errors as a failure", () => {
    expect(isFailedResult({ error: "E-posta veya şifre hatalı." })).toBe(true);
    expect(isFailedResult({ fieldErrors: { email: ["Geçersiz"] } })).toBe(true);
    // The promotion check reports its missing prerequisites as field errors
    expect(isFailedResult({ fieldErrors: { requirements: ["E-posta doğrulanmamış"] } })).toBe(true);
  });

  it("treats null, a success message or returned codes as a success", () => {
    expect(isFailedResult(null)).toBe(false);
    expect(isFailedResult(undefined)).toBe(false);
    expect(isFailedResult({ success: "Kaydedildi." })).toBe(false);
    expect(isFailedResult({})).toBe(false);
  });

  it("ignores an empty error string", () => {
    expect(isFailedResult({ error: "" })).toBe(false);
  });
});

describe("isSecretField", () => {
  const field = (type: string, autocomplete = "", clearOnError?: string) => ({
    type,
    autocomplete,
    dataset: clearOnError === undefined ? {} : { clearOnError },
  });

  it("clears passwords, whatever their autocomplete hint", () => {
    expect(isSecretField(field("password", "current-password"))).toBe(true);
    expect(isSecretField(field("password", "new-password"))).toBe(true);
    expect(isSecretField(field("PASSWORD"))).toBe(true);
  });

  it("clears one-time codes typed into a text box", () => {
    expect(isSecretField(field("text", "one-time-code"))).toBe(true);
    // An autofill token may carry a section prefix
    expect(isSecretField(field("text", "section-login one-time-code"))).toBe(true);
  });

  it("clears a field that opts in, such as the recovery code", () => {
    expect(isSecretField(field("text", "off", ""))).toBe(true);
  });

  it("keeps everything else", () => {
    expect(isSecretField(field("email", "email"))).toBe(false);
    expect(isSecretField(field("text", "name"))).toBe(false);
    expect(isSecretField(field("date", "bday"))).toBe(false);
    expect(isSecretField(field("hidden"))).toBe(false);
    expect(isSecretField({ type: "text", autocomplete: "off" })).toBe(false);
  });
});
