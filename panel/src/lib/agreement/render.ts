/**
 * Filling the contract template (§3, §4).
 *
 * The template is markdown with `{{a.b_c}}` placeholders. This module is pure
 * and deterministic: the same template and the same context produce the same
 * bytes, every time. Nothing here reads the clock, the database or the request.
 *
 * A placeholder the dictionary does not know, or a required value that is
 * missing, raises `AgreementRenderError`. Nothing is ever left blank quietly —
 * a contract with a hole in it is worse than no contract.
 */
import { hashDocument } from "./normalise";

export class AgreementRenderError extends Error {
  /** The placeholders that could not be filled, e.g. `["yazar.dogum_tarihi"]`. */
  readonly placeholders: string[];

  constructor(message: string, placeholders: string[]) {
    super(message);
    this.name = "AgreementRenderError";
    this.placeholders = placeholders;
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export type AgreementContext = {
  agreement: {
    version: number;
    /** Publication date; null while the version is still a draft. */
    publishedAt: Date | null;
    /** SHA-256 of the raw template, see §5.1. */
    bodyHash: string;
  };
  publisher: {
    partner1: string | null;
    partner2: string | null;
    address: string | null;
    email: string | null;
    domain: string | null;
    jurisdictionCity: string | null;
  };
  writer: {
    displayName: string;
    /** `YYYY-MM-DD`; null fails the render, which is the point (§6.1). */
    birthDate: string | null;
    email: string;
    /** The one value allowed to be absent; renders as an em dash. */
    penName: string | null;
  };
  kvkkVersion: number | null;
  /** Null before acceptance: the preview shows "(onay bekliyor)". */
  acceptance: { acceptedAt: Date | null; ip: string | null } | null;
};

const PENDING = "(onay bekliyor)";
const ABSENT = "—";

/* ------------------------------------------------------------------ */
/* Formatting and escaping                                             */
/* ------------------------------------------------------------------ */

/** `GG.AA.YYYY`, in UTC so the printed date never shifts with the server. */
export function formatContractDate(value: Date | string | null): string | null {
  if (value === null) return null;

  const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
  if (Number.isNaN(date.getTime())) return null;

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

/** `GG.AA.YYYY SS:DD` for the acceptance stamp. */
export function formatContractDateTime(value: Date): string {
  const time = `${String(value.getUTCHours()).padStart(2, "0")}:${String(
    value.getUTCMinutes(),
  ).padStart(2, "0")}`;
  return `${formatContractDate(value)} ${time} UTC`;
}

/**
 * Neutralises markdown and HTML in a user supplied value.
 *
 * A display name of `# Ali` must appear as the text `# Ali`, not as a heading,
 * and a name containing `|` must not break the table it sits in. rehype-sanitize
 * runs afterwards as well; this is the layer that keeps the *markdown* honest.
 */
export function escapeForTemplate(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}[\]()#+\-.!|>~])/g, "\\$1")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------------ */
/* Dictionary                                                          */
/* ------------------------------------------------------------------ */

/** Placeholders whose value may legitimately be empty. */
const OPTIONAL = new Set(["yazar.mahlas"]);

/**
 * Every placeholder the template is allowed to use, and where it comes from
 * (§3). A placeholder outside this map fails the render.
 */
export function buildPlaceholders(context: AgreementContext): Record<string, string | null> {
  const escape = escapeForTemplate;

  return {
    "agreement.version": String(context.agreement.version),
    "agreement.published_at": formatContractDate(context.agreement.publishedAt),
    "agreement.body_hash": context.agreement.bodyHash,

    "dergi.ortak_1": context.publisher.partner1 ? escape(context.publisher.partner1) : null,
    "dergi.ortak_2": context.publisher.partner2 ? escape(context.publisher.partner2) : null,
    "dergi.adres": context.publisher.address ? escape(context.publisher.address) : null,
    "dergi.eposta": context.publisher.email ? escape(context.publisher.email) : null,
    "dergi.domain": context.publisher.domain ? escape(context.publisher.domain) : null,
    "dergi.sehir": context.publisher.jurisdictionCity
      ? escape(context.publisher.jurisdictionCity)
      : null,

    "yazar.ad_soyad": context.writer.displayName ? escape(context.writer.displayName) : null,
    "yazar.dogum_tarihi": formatContractDate(context.writer.birthDate),
    "yazar.eposta": context.writer.email ? escape(context.writer.email) : null,
    // The only placeholder allowed to be empty; an em dash stands in
    "yazar.mahlas": context.writer.penName ? escape(context.writer.penName) : ABSENT,

    "kvkk.version": context.kvkkVersion === null ? null : String(context.kvkkVersion),

    "acceptance.accepted_at": context.acceptance?.acceptedAt
      ? formatContractDateTime(context.acceptance.acceptedAt)
      : PENDING,
    "acceptance.ip": context.acceptance ? (context.acceptance.ip ?? ABSENT) : PENDING,
  };
}

/** Every placeholder that appears in a template, in order of first appearance. */
export function extractPlaceholders(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(/\{\{([^}]*)\}\}/g)) {
    found.add((match[1] ?? "").trim());
  }
  return [...found];
}

/** Placeholders used by a template that the dictionary cannot supply (§9). */
export function unknownPlaceholders(template: string, context: AgreementContext): string[] {
  const known = buildPlaceholders(context);
  return extractPlaceholders(template).filter((name) => !(name in known));
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

export type RenderedAgreement = { markdown: string; hash: string };

/**
 * Fills the template and hashes the result.
 *
 * The returned hash is the one that goes into
 * `agreement_acceptances.body_hash_at_acceptance`: it covers the filled text,
 * not the raw template (§5.2).
 */
export function renderAgreement(
  templateMarkdown: string,
  context: AgreementContext,
): RenderedAgreement {
  const values = buildPlaceholders(context);
  const used = extractPlaceholders(templateMarkdown);

  const unknown = used.filter((name) => !(name in values));
  if (unknown.length > 0) {
    throw new AgreementRenderError(
      `Şablonda tanınmayan yer tutucu: ${unknown.join(", ")}`,
      unknown,
    );
  }

  const missing = used.filter((name) => !OPTIONAL.has(name) && !values[name]);
  if (missing.length > 0) {
    throw new AgreementRenderError(
      `Sözleşme ayarları eksik: ${missing.join(", ")}`,
      missing,
    );
  }

  const markdown = templateMarkdown.replace(/\{\{([^}]*)\}\}/g, (_match, rawName: string) => {
    // Non-null: every name has just been checked against the dictionary
    return values[rawName.trim()]!;
  });

  return { markdown, hash: hashDocument(markdown) };
}
