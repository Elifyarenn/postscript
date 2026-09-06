/**
 * PDF generation for legal documents (DECISIONS.md D-011).
 *
 * pdf-lib with an embedded DejaVu Sans, because the built-in fonts use
 * WinAnsi encoding and would fail on "ş", "ğ" and "ı" — unacceptable in a
 * document that has to stand as evidence of what the writer agreed to.
 *
 * Every generated document carries the version and the sha256 of the source
 * text in its footer, so a printed copy can be tied back to a database row.
 */
import "server-only";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { readFileSync } from "node:fs";
import path from "node:path";

const PAGE_WIDTH = 595.28; // A4 at 72 dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const BODY_SIZE = 10;
const LINE_HEIGHT = 14;

let regularFontBytes: Buffer | null = null;
let boldFontBytes: Buffer | null = null;

function loadFonts(): { regular: Buffer; bold: Buffer } {
  if (!regularFontBytes || !boldFontBytes) {
    const directory = path.join(process.cwd(), "assets", "fonts");
    regularFontBytes = readFileSync(path.join(directory, "DejaVuSans.ttf"));
    boldFontBytes = readFileSync(path.join(directory, "DejaVuSans-Bold.ttf"));
  }
  return { regular: regularFontBytes, bold: boldFontBytes };
}

/** Greedy word wrap against the real measured width of the embedded font. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export type PdfSection = { heading?: string; body: string };

export type PdfDocumentInput = {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
  /** Rendered small at the bottom of every page. */
  footerNote: string;
};

export async function renderDocumentPdf(input: PdfDocumentInput): Promise<Buffer> {
  const { regular, bold } = loadFonts();

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const bodyFont = await pdf.embedFont(regular, { subset: true });
  const headingFont = await pdf.embedFont(bold, { subset: true });

  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  const pages: PDFPage[] = [];

  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let cursorY = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    cursorY = PAGE_HEIGHT - MARGIN;
  };

  const write = (text: string, font: PDFFont, size: number, gapAfter: number) => {
    for (const line of wrapText(text, font, size, usableWidth)) {
      if (cursorY < MARGIN + LINE_HEIGHT * 2) newPage();
      if (line !== "") {
        page.drawText(line, { x: MARGIN, y: cursorY, size, font, color: rgb(0.1, 0.1, 0.1) });
      }
      cursorY -= size + 4;
    }
    cursorY -= gapAfter;
  };

  write(input.title, headingFont, 16, 6);
  if (input.subtitle) write(input.subtitle, bodyFont, 9, 10);

  for (const section of input.sections) {
    if (section.heading) write(section.heading, headingFont, 11, 2);
    write(section.body, bodyFont, BODY_SIZE, 10);
  }

  // Footers last, so every page can carry its number out of the total (§8)
  pages.forEach((target, index) => {
    target.drawText(input.footerNote, {
      x: MARGIN,
      y: MARGIN / 2,
      size: 7,
      font: bodyFont,
      color: rgb(0.45, 0.45, 0.45),
      maxWidth: usableWidth - 60,
    });

    const label = `${index + 1} / ${pages.length}`;
    target.drawText(label, {
      x: PAGE_WIDTH - MARGIN - bodyFont.widthOfTextAtSize(label, 7),
      y: MARGIN / 2,
      size: 7,
      font: bodyFont,
      color: rgb(0.45, 0.45, 0.45),
    });
  });

  return Buffer.from(await pdf.save());
}
