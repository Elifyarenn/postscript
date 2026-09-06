/**
 * Reads the contract template from the repository.
 *
 * The template is a file, not a database row, so a change to it is a reviewable
 * diff. Publishing a version copies it into `agreement_versions.body_markdown`,
 * which is what every acceptance is then measured against — the file can move
 * on without disturbing contracts already signed.
 */
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { hashDocument } from "./normalise";

export const TEMPLATE_FILE = "yazar-sozlesmesi-ve-ruhsat-taahhudu.md";

/** Only set by tests, which swap the template to exercise the render rules. */
let override: string | null = null;

/**
 * Read from disk every time rather than cached: the file is the source of every new
 * version, and a cached copy would quietly go stale the moment it changed.
 * It is ten kilobytes, read only when a contract is previewed or published.
 */
export function readAgreementTemplate(): string {
  return override ?? readFileSync(path.join(process.cwd(), "contracts", TEMPLATE_FILE), "utf8");
}

/** SHA-256 of the raw, unfilled template (§5.1). */
export function templateHash(): string {
  return hashDocument(readAgreementTemplate());
}

export function setAgreementTemplateForTests(markdown: string | null): void {
  override = markdown;
}
