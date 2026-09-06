/**
 * Contract rendering and hash normalisation (§10, unit).
 *
 * These are the rules that keep a signed contract meaningful: nothing is left
 * blank, user input cannot smuggle markdown in, and the same inputs always
 * produce the same bytes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  AgreementRenderError,
  buildPlaceholders,
  escapeForTemplate,
  extractPlaceholders,
  formatContractDate,
  renderAgreement,
  unknownPlaceholders,
  type AgreementContext,
} from "@/lib/agreement/render";
import { hashDocument, normaliseForHash } from "@/lib/agreement/normalise";

const TEMPLATE = readFileSync(
  path.join(process.cwd(), "contracts", "yazar-sozlesmesi-ve-ruhsat-taahhudu.md"),
  "utf8",
);

function context(overrides: Partial<AgreementContext> = {}): AgreementContext {
  return {
    agreement: {
      version: 1,
      publishedAt: new Date("2026-03-14T09:00:00.000Z"),
      bodyHash: "a".repeat(64),
    },
    publisher: {
      partner1: "Elif Yaren Çekiç",
      partner2: "Tuanna Demir",
      address: "Konak, İzmir",
      email: "iletisim@postscriptmag.com",
      domain: "postscriptmag.com",
      jurisdictionCity: "İzmir",
    },
    writer: {
      displayName: "Ada Yazar",
      birthDate: "1995-05-05",
      email: "yazar@postscriptmag.com",
      penName: "Ada Y.",
    },
    kvkkVersion: 1,
    acceptance: null,
    ...overrides,
  };
}

describe("hash normalisation", () => {
  it("treats CRLF and LF as the same document", () => {
    expect(hashDocument("bir\r\niki\r\n")).toBe(hashDocument("bir\niki\n"));
  });

  it("ignores trailing whitespace on a line", () => {
    expect(hashDocument("bir   \niki\t\n")).toBe(hashDocument("bir\niki"));
  });

  it("ignores leading and trailing blank lines", () => {
    expect(hashDocument("\n\nmetin\n\n\n")).toBe(hashDocument("metin"));
  });

  it("does not ignore a difference that matters", () => {
    expect(hashDocument("metin")).not.toBe(hashDocument("metın"));
  });

  it("keeps interior blank lines, which markdown treats as structure", () => {
    expect(normaliseForHash("bir\n\niki")).toBe("bir\n\niki");
    expect(hashDocument("bir\n\niki")).not.toBe(hashDocument("bir\niki"));
  });
});

describe("the shipped template", () => {
  it("uses only placeholders the dictionary knows", () => {
    expect(unknownPlaceholders(TEMPLATE, context())).toEqual([]);
  });

  it("uses every placeholder the specification lists", () => {
    expect(extractPlaceholders(TEMPLATE).sort()).toEqual(
      Object.keys(buildPlaceholders(context())).sort(),
    );
  });
});

describe("renderAgreement", () => {
  it("fills every placeholder and leaves none behind", () => {
    const { markdown } = renderAgreement(TEMPLATE, context());

    expect(markdown).not.toMatch(/\{\{/);
    expect(markdown).toContain("Elif Yaren Çekiç");
    expect(markdown).toContain("Tuanna Demir");
    expect(markdown).toContain("**Sürüm:** 1");
    expect(markdown).toContain("14.03.2026");
    expect(markdown).toContain("05.05.1995");
  });

  it("is deterministic: two calls produce identical bytes", () => {
    const first = renderAgreement(TEMPLATE, context());
    const second = renderAgreement(TEMPLATE, context());

    expect(first.markdown).toBe(second.markdown);
    expect(first.hash).toBe(second.hash);
  });

  it("hashes the filled text, not the template", () => {
    const filled = renderAgreement(TEMPLATE, context());
    expect(filled.hash).not.toBe(hashDocument(TEMPLATE));
    expect(filled.hash).toBe(hashDocument(filled.markdown));
  });

  it("shows the acceptance stamp as pending until it happens", () => {
    const { markdown } = renderAgreement(TEMPLATE, context());
    expect(markdown).toContain("Onay tarihi: (onay bekliyor)");
    expect(markdown).toContain("IP: (onay bekliyor)");
  });

  it("stamps the acceptance once it is given", () => {
    const { markdown } = renderAgreement(
      TEMPLATE,
      context({
        acceptance: { acceptedAt: new Date("2026-04-01T13:45:00.000Z"), ip: "203.0.113.10" },
      }),
    );

    expect(markdown).toContain("Onay tarihi: 01.04.2026 13:45 UTC");
    expect(markdown).toContain("IP: 203.0.113.10");
  });

  it("names the missing placeholder when the birth date is absent", () => {
    const attempt = () => renderAgreement(TEMPLATE, context({
      writer: { ...context().writer, birthDate: null },
    }));

    expect(attempt).toThrow(AgreementRenderError);
    try {
      attempt();
    } catch (error) {
      expect((error as AgreementRenderError).placeholders).toContain("yazar.dogum_tarihi");
      expect((error as AgreementRenderError).message).toContain("yazar.dogum_tarihi");
    }
  });

  it("names the missing publisher setting, which is what the promotion reports", () => {
    const attempt = () =>
      renderAgreement(TEMPLATE, context({
        publisher: { ...context().publisher, partner2: null },
      }));

    expect(attempt).toThrow(/dergi\.ortak_2/);
  });

  it("accepts an absent pen name and writes an em dash", () => {
    const { markdown } = renderAgreement(
      TEMPLATE,
      context({ writer: { ...context().writer, penName: null } }),
    );
    expect(markdown).toContain("Mahlas: —");
  });

  it("refuses a template that uses an unknown placeholder", () => {
    const attempt = () => renderAgreement("Merhaba {{yazar.telefon}}", context());

    expect(attempt).toThrow(AgreementRenderError);
    expect(attempt).toThrow(/yazar\.telefon/);
  });
});

describe("escaping user supplied values", () => {
  it("stops a display name from becoming a heading", () => {
    const { markdown } = renderAgreement(
      TEMPLATE,
      context({ writer: { ...context().writer, displayName: "# Ali" } }),
    );

    expect(markdown).toContain("\\# Ali");
    // The unescaped form must not appear at the start of a line
    expect(markdown).not.toMatch(/^# Ali$/m);
  });

  it("stops a name from breaking the table it sits in", () => {
    expect(escapeForTemplate("Ali | Veli")).toBe("Ali \\| Veli");
  });

  it("neutralises raw HTML", () => {
    expect(escapeForTemplate("<script>alert(1)</script>")).not.toContain("<script>");
  });

  it("escapes the backslash itself first, so escaping cannot be undone", () => {
    expect(escapeForTemplate("\\#")).toBe("\\\\\\#");
  });
});

describe("date formatting", () => {
  it("writes dates as GG.AA.YYYY", () => {
    expect(formatContractDate("1995-05-05")).toBe("05.05.1995");
    expect(formatContractDate(new Date("2026-12-31T22:00:00.000Z"))).toBe("31.12.2026");
  });

  it("returns null for a missing or unparseable date", () => {
    expect(formatContractDate(null)).toBeNull();
    expect(formatContractDate("bugün")).toBeNull();
  });
});
