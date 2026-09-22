/**
 * Reading a stored phone number into a WhatsApp link (D-231). Numbers are kept
 * as the member typed them, so the shapes below all really occur.
 */
import { describe, expect, it } from "vitest";
import { chaseMessage, whatsappHref, whatsappNumber } from "@/lib/whatsapp";

describe("whatsappNumber", () => {
  it("keeps an international number, with or without the plus", () => {
    expect(whatsappNumber("+905321234567")).toBe("905321234567");
    expect(whatsappNumber("905321234567")).toBe("905321234567");
    expect(whatsappNumber("00905321234567")).toBe("905321234567");
  });

  it("turns the trunk zero of a Turkish number into the country code", () => {
    expect(whatsappNumber("05321234567")).toBe("905321234567");
    expect(whatsappNumber("0532 123 45 67")).toBe("905321234567");
  });

  it("adds the country code to a bare line", () => {
    expect(whatsappNumber("5321234567")).toBe("905321234567");
  });

  it("keeps a foreign number as it was given", () => {
    // +44 7700 900123: guessing Turkey here would dial a stranger
    expect(whatsappNumber("+447700900123")).toBe("447700900123");
  });

  it("refuses what it cannot read rather than guessing", () => {
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber("123")).toBeNull();
    expect(whatsappNumber("bilinmiyor")).toBeNull();
  });
});

describe("whatsappHref", () => {
  it("builds a wa.me link with the message escaped", () => {
    const href = whatsappHref("0532 123 45 67", "Merhaba Ada!");
    expect(href).toBe("https://wa.me/905321234567?text=Merhaba%20Ada!");
  });

  it("gives no link at all when the number cannot be read", () => {
    expect(whatsappHref("yok", "Merhaba")).toBeNull();
  });
});

describe("chaseMessage", () => {
  it("asks for both steps from someone who has not started", () => {
    // No avatar means no form either, so one message covers both
    expect(chaseMessage("avatar")).toBe("Selam, avatarı yapıp formu doldurur musun?");
  });

  it("asks only for the form from someone whose avatar is in", () => {
    expect(chaseMessage("form")).toBe("Selam, formu doldurur musun?");
  });
});
