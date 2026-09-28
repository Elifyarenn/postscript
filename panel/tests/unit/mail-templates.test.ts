/**
 * The shared mail layout (D-269). Every template now draws an HTML part, and
 * the plain text part is still, character for character, what it was before
 * the layout existed: `mail-text-baseline.json` was written from the old
 * templates with the inputs in `mail-samples.ts`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as templates from "@emails/templates";
import { escapeHtml, isSafeLink, renderMail } from "@emails/layout";
import { ADDED_AFTER_LAYOUT, MAIL_SAMPLES } from "../fixtures/mail-samples";

type TemplateFn = (input: never) => templates.Template;
const TEMPLATES = templates as unknown as Record<string, TemplateFn>;

const baseline = JSON.parse(
  readFileSync(path.resolve("tests/fixtures/mail-text-baseline.json"), "utf8"),
) as Record<string, { subject: string; text: string }[]>;

const templateNames = Object.keys(TEMPLATES).filter((name) => typeof TEMPLATES[name] === "function");

function render(name: string, input: unknown) {
  return TEMPLATES[name]!(input as never);
}

describe("every template", () => {
  it("has a sample, so none escapes these checks", () => {
    expect(templateNames.length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(MAIL_SAMPLES).sort()).toEqual([...templateNames].sort());
  });

  for (const name of templateNames) {
    describe(name, () => {
      const samples = MAIL_SAMPLES[name] ?? [];

      it.skipIf(ADDED_AFTER_LAYOUT.has(name))("keeps the plain text and subject unchanged", () => {
        samples.forEach((input, index) => {
          const mail = render(name, input);
          expect(mail.subject).toBe(baseline[name]![index]!.subject);
          expect(mail.text).toBe(baseline[name]![index]!.text);
        });
      });

      it("draws an HTML part in the shared layout alongside the text", () => {
        for (const input of samples) {
          const mail = render(name, input);
          expect(mail.kind).toMatch(/^[a-z_]+$/);
          expect(mail.html.startsWith("<!DOCTYPE html>")).toBe(true);
          expect(mail.html).toContain("PostScript");
          expect(mail.html).toContain("Bu ileti otomatik olarak gönderildi.");
          expect(mail.html).toContain('lang="tr"');
          // No script, and nothing a person typed survives as markup
          expect(mail.html).not.toMatch(/<script|<img|href="javascript:/i);
          expect(mail.html).not.toContain("<b>");
        }
      });

      it("links every address the text carries", () => {
        for (const input of samples) {
          const mail = render(name, input);
          const urls = mail.text.match(/https:\/\/\S+/g) ?? [];
          for (const url of urls) {
            expect(mail.html).toContain(`href="${escapeHtml(url)}"`);
          }
        }
      });
    });
  }
});

describe("sign-in links", () => {
  it("marks the mails whose link opens an account as sensitive", () => {
    expect(render("verifyEmail", MAIL_SAMPLES.verifyEmail![0]).sensitive).toBe(true);
    expect(render("resetPassword", MAIL_SAMPLES.resetPassword![0]).sensitive).toBe(true);
    expect(render("changeEmail", MAIL_SAMPLES.changeEmail![0]).sensitive).toBe(true);
    expect(render("kvkkNewVersion", MAIL_SAMPLES.kvkkNewVersion![0]).sensitive).toBeUndefined();
  });

  it("puts the verification link in the HTML exactly as in the text", () => {
    const url = "https://www.postscriptmag.com/verify-email?token=a%2Bb%3D";
    const mail = templates.verifyEmail({ displayName: "Ada", url });
    expect(mail.text).toContain(`\n${url}\n`);
    expect(mail.html).toContain(`href="${url}"`);
  });
});

describe("submissionWindowOpened", () => {
  it("names the accepted topic, or says only accepted topics may be handed in", () => {
    const [withTopic, withoutTopic] = MAIL_SAMPLES.submissionWindowOpened!;
    const invited = render("submissionWindowOpened", withTopic);
    expect(invited.subject).toBe("postscript · Sayı 2 · Gotizm için yazı kabul dönemi başladı");
    expect(invited.text).toContain("Son teslim: 15 Ekim 18:00");
    expect(invited.text).toContain("Kabul edilen konunuz: Karanlık <mimari>");
    expect(invited.html).toContain("Karanlık &lt;mimari&gt;");
    expect(invited.html).toContain("Yazımı teslim et");

    const told = render("submissionWindowOpened", withoutTopic);
    expect(told.text).toContain("yalnızca konusu kabul edilmiş yazılar teslim edilebilir");
    expect(told.text).not.toContain("Kabul edilen konunuz");
  });
});

describe("escaping", () => {
  it("escapes names, titles and messages", () => {
    const mail = render("contactMessage", MAIL_SAMPLES.contactMessage![0]);
    expect(mail.html).toContain("Ziyaretçi &lt;img src=x&gt;");
    expect(mail.html).toContain("&lt;a href=&quot;javascript:alert(1)&quot;&gt;tık&lt;/a&gt;");
    expect(mail.html).toContain("Merhaba,<br>");

    const announcement = render("mandatoryAnnouncement", MAIL_SAMPLES.mandatoryAnnouncement![0]);
    expect(announcement.html).toContain("Toplantı &lt;önemli&gt;");
  });

  it("turns only web addresses into links", () => {
    expect(isSafeLink("https://www.postscriptmag.com/kvkk")).toBe(true);
    expect(isSafeLink("javascript:alert(1)")).toBe(false);
    expect(isSafeLink('https://x.test/"onmouseover=')).toBe(false);

    const mail = renderMail({
      kind: "custom",
      subject: "s",
      heading: "h",
      blocks: [{ type: "action", url: "javascript:alert(1)", label: "Tıkla" }],
    });
    expect(mail.html).not.toContain('href="javascript');
    expect(mail.text).toContain("javascript:alert(1)");
  });
});
