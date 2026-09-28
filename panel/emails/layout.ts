/**
 * The one layout every PostScript mail is drawn with (D-269).
 *
 * A template describes its message as a few blocks; this module turns the same
 * blocks into the plain text part and the HTML part, so the two cannot say
 * different things. The text part is exactly what the templates produced
 * before the layout existed (`tests/fixtures/mail-text-baseline.json`).
 *
 * The HTML is written for mail clients, not browsers: tables for layout,
 * inline styles, no web fonts, no images (most clients block them until asked)
 * and a button that is a plain link, with the address repeated under it.
 * Every value that comes from a person — a name, a title, a note, a message —
 * is escaped, and only http(s) links become clickable.
 */

export type MailBlock =
  /** A paragraph. A line break inside it stays a line break. */
  | { type: "paragraph"; text: string }
  /**
   * The primary link. In text: the lead, then the address (on the next line,
   * or after a space); in HTML: the lead, a button, and the address in small print.
   */
  | { type: "action"; lead?: string; url: string; label: string; inline?: boolean }
  /** Label/value lines, e.g. the fields of a contact message. */
  | { type: "details"; rows: [label: string, value: string][] }
  /** A short labelled note on the same line: "Editör notu: …". */
  | { type: "note"; label: string; text: string }
  /** A labelled block of free text on the lines below its label: "Mesaj:\n…". */
  | { type: "quote"; label: string; text: string };

export type MailDocument = {
  /** The template's name; the outbox shows it to admins. */
  kind: string;
  subject: string;
  /** The HTML title; the subject says it again in the inbox, so it can be plainer. */
  heading: string;
  greeting?: string;
  blocks: MailBlock[];
  /** Carries a link that signs in, verifies or resets; the outbox drops it once done. */
  sensitive?: boolean;
};

export type Template = {
  kind: string;
  subject: string;
  text: string;
  html: string;
  sensitive?: boolean;
};

export const SIGNATURE_TEXT = "\n\n—\npostscript\nBu ileti otomatik olarak gönderildi.";

/** The magazine's public home; mail is read long after, away from any panel. */
const SITE_HOME = "https://www.postscriptmag.com";

/* ------------------------------------------------------------------ */
/* Plain text                                                          */
/* ------------------------------------------------------------------ */

function blockText(block: MailBlock): string {
  switch (block.type) {
    case "paragraph":
      return block.text;
    case "action":
      if (!block.lead) return block.url;
      return `${block.lead}${block.inline ? " " : "\n"}${block.url}`;
    case "details":
      return block.rows.map(([label, value]) => `${label}: ${value}`).join("\n");
    case "note":
      return `${block.label} ${block.text}`;
    case "quote":
      return `${block.label}\n${block.text}`;
  }
}

export function renderText(doc: MailDocument): string {
  const parts = [...(doc.greeting ? [doc.greeting] : []), ...doc.blocks.map(blockText)];
  return parts.join("\n\n") + SIGNATURE_TEXT;
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped, with line breaks kept; Outlook ignores `white-space: pre-wrap`. */
function escapeLines(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

/** Only a web address may become a link; anything else (javascript:, data:) stays text. */
export function isSafeLink(url: string): boolean {
  return /^https?:\/\/[^\s"'<>]+$/i.test(url);
}

// The panel's palette (globals.css): burgundy accent on cream paper
const COLOR = {
  paper: "#f5f3ec",
  surface: "#ffffff",
  ink: "#241218",
  muted: "#8a767d",
  line: "#ddd5c8",
  accent: "#5c152a",
  accentSoft: "#f2e6e9",
} as const;

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const P_STYLE = `margin:0 0 16px 0;font-family:${SANS};font-size:15px;line-height:24px;color:${COLOR.ink};`;

function linkHtml(url: string, text: string): string {
  if (!isSafeLink(url)) return escapeHtml(text);
  return `<a href="${escapeHtml(url)}" target="_blank" style="color:${COLOR.accent};text-decoration:underline;">${escapeHtml(text)}</a>`;
}

function actionHtml(block: Extract<MailBlock, { type: "action" }>): string {
  const lead = block.lead ? `<p style="${P_STYLE}">${escapeLines(block.lead)}</p>` : "";
  if (!isSafeLink(block.url)) {
    return `${lead}<p style="${P_STYLE}">${escapeHtml(block.url)}</p>`;
  }
  const href = escapeHtml(block.url);
  return (
    lead +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px 0;"><tr>` +
    `<td bgcolor="${COLOR.accent}" style="background-color:${COLOR.accent};border-radius:3px;">` +
    `<a href="${href}" target="_blank" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:3px;">${escapeHtml(block.label)}</a>` +
    `</td></tr></table>` +
    `<p style="margin:0 0 20px 0;font-family:${SANS};font-size:12px;line-height:18px;color:${COLOR.muted};word-break:break-all;">` +
    `Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:<br>${linkHtml(block.url, block.url)}</p>`
  );
}

function boxHtml(inner: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;"><tr>` +
    `<td style="background-color:${COLOR.paper};border-left:3px solid ${COLOR.accent};padding:12px 16px;font-family:${SANS};font-size:14px;line-height:22px;color:${COLOR.ink};">` +
    inner +
    `</td></tr></table>`
  );
}

function blockHtml(block: MailBlock): string {
  switch (block.type) {
    case "paragraph":
      return `<p style="${P_STYLE}">${escapeLines(block.text)}</p>`;
    case "action":
      return actionHtml(block);
    case "details":
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;border-top:1px solid ${COLOR.line};">` +
        block.rows
          .map(
            ([label, value]) =>
              `<tr><td valign="top" width="1%" style="width:1%;padding:8px 20px 8px 0;border-bottom:1px solid ${COLOR.line};font-family:${SANS};font-size:13px;line-height:20px;color:${COLOR.muted};white-space:nowrap;">${escapeHtml(label)}</td>` +
              `<td valign="top" style="padding:8px 0;border-bottom:1px solid ${COLOR.line};font-family:${SANS};font-size:14px;line-height:20px;color:${COLOR.ink};word-break:break-word;">${escapeLines(value)}</td></tr>`,
          )
          .join("") +
        `</table>`
      );
    case "note":
      return boxHtml(`<strong style="font-weight:600;">${escapeHtml(block.label)}</strong> ${escapeLines(block.text)}`);
    case "quote":
      return boxHtml(
        `<div style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:${COLOR.muted};text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(block.label.replace(/:$/, ""))}</div>` +
          escapeLines(block.text),
      );
  }
}

/** First sentence-sized piece of the message, shown by the inbox beside the subject. */
function preheader(doc: MailDocument): string {
  const first = doc.blocks[0];
  const source = !first
    ? doc.heading
    : first.type === "paragraph"
      ? first.text
      : first.type === "action"
        ? (first.lead ?? doc.heading)
        : doc.heading;
  const flat = source.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? `${flat.slice(0, 117)}…` : flat;
}

export function renderHtml(doc: MailDocument): string {
  const greeting = doc.greeting ? `<p style="${P_STYLE}">${escapeHtml(doc.greeting)}</p>` : "";
  const body = doc.blocks.map(blockHtml).join("");

  return `<!DOCTYPE html>
<html lang="tr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(doc.subject)}</title>
<style>
  body { margin: 0; padding: 0; }
  a { color: ${COLOR.accent}; }
  @media only screen and (max-width: 600px) {
    .ps-card { padding: 28px 20px !important; }
    .ps-heading { font-size: 22px !important; line-height: 28px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.paper};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader(doc))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.paper}" style="background-color:${COLOR.paper};">
<tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 18px 4px;">
<div style="font-family:${SERIF};font-size:26px;line-height:30px;color:${COLOR.accent};letter-spacing:0.02em;">PostScript</div>
<div style="font-family:${SERIF};font-size:12px;line-height:18px;font-style:italic;color:${COLOR.muted};">The things left unsaid</div>
</td></tr>
<tr><td bgcolor="${COLOR.surface}" style="background-color:${COLOR.surface};border:1px solid ${COLOR.line};border-top:4px solid ${COLOR.accent};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="ps-card" style="padding:36px 40px 20px 40px;">
<h1 class="ps-heading" style="margin:0 0 20px 0;font-family:${SERIF};font-size:24px;line-height:32px;font-weight:normal;color:${COLOR.ink};">${escapeHtml(doc.heading)}</h1>
${greeting}${body}
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 4px 0 4px;font-family:${SANS};font-size:12px;line-height:18px;color:${COLOR.muted};">
Bu ileti otomatik olarak gönderildi.<br>
<a href="${SITE_HOME}" target="_blank" style="color:${COLOR.muted};text-decoration:underline;">PostScript Dergi</a> · postscriptmag.com
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

/** Both parts from one description. */
export function renderMail(doc: MailDocument): Template {
  return {
    kind: doc.kind,
    subject: doc.subject,
    text: renderText(doc),
    html: renderHtml(doc),
    ...(doc.sensitive ? { sensitive: true } : {}),
  };
}
