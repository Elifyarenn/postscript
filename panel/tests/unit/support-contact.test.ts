import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SUPPORT_WHATSAPP_HANDLE, SUPPORT_WHATSAPP_HREF } from "@/lib/support-contact";

// The floating WhatsApp button (D-385) is a new way personal data reaches the
// magazine; the KVKK notice must describe it as long as the button exists.
describe("WhatsApp support line", () => {
  it("links to WhatsApp's own domain over https, by username", () => {
    const url = new URL(SUPPORT_WHATSAPP_HREF);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe(`/${SUPPORT_WHATSAPP_HANDLE}`);
    expect(SUPPORT_WHATSAPP_HANDLE).toMatch(/^[a-z0-9._]+$/);
  });

  it("is described in the KVKK notice: data, purpose, collection, transfer and retention", () => {
    const notice = readFileSync(path.resolve(__dirname, "../../data/kvkk-aydinlatma-metni.md"), "utf8");
    expect(notice).toContain("| WhatsApp iletişimi |");
    expect(notice).toContain("WhatsApp'tan yazdığınız sözleşme işleri");
    expect(notice).toContain("**WhatsApp'tan yazdığınızda:**");
    expect(notice).toContain("arızi bir aktarımdır");
    expect(notice).toContain("| WhatsApp yazışmaları |");
  });
});
