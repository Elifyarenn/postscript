/**
 * Does the work's licence cover the text about to go public? (D-347)
 *
 * Pure, like the state machine it feeds: the service gathers the grant and the
 * version history, this decides. It is the interim guard until the D-268
 * permission model lands, and it keeps today's rule from §7.5 — an editor's
 * recorded correction stays inside the licence, a content change does not.
 * What it adds is that the text is actually compared, so a body that moved
 * without a recorded correction can no longer reach the site on an old licence.
 */
import { hashDocument } from "@/lib/agreement/normalise";

export type CoverageGrant = {
  /** sha256 of the text the licence was declared or approved for. */
  formTextHash: string;
  /** The licensed text itself, kept since D-238; null on older approvals. */
  acceptedBodyMarkdown: string | null;
  /** The `article_versions` number the declaration was made against. */
  acceptedVersion: number | null;
  signedAt: Date | null;
};

export type CoverageVersion = {
  version: number;
  bodyMarkdown: string;
  changeKind: "correction" | "content_change";
  createdAt: Date;
};

export type CoverageResult = { ok: true } | { ok: false; reason: string };

export function checkLicenceCoverage(
  grant: CoverageGrant,
  currentBody: string,
  versions: readonly CoverageVersion[],
): CoverageResult {
  // The stored text and its hash were written together; disagreement means the
  // record itself was altered, and nothing it says can be relied on
  if (grant.acceptedBodyMarkdown !== null && hashDocument(grant.acceptedBodyMarkdown) !== grant.formTextHash) {
    return { ok: false, reason: "Yayın izni kaydındaki metin ile özeti birbirini tutmuyor; kayıt bozulmuş olabilir." };
  }

  const currentHash = hashDocument(currentBody);
  if (currentHash === grant.formTextHash) return { ok: true };

  // Versions taken after the licence. The declaration names its version number;
  // an approval given on screen does not, so its moment stands in for it
  const later = versions.filter((row) =>
    grant.acceptedVersion !== null
      ? row.version > grant.acceptedVersion
      : grant.signedAt !== null && row.createdAt.getTime() > grant.signedAt.getTime(),
  );
  const newest = [...later].sort((a, b) => b.version - a.version)[0];

  // Every step away from the licensed text has to be on record as a correction,
  // and the record has to end exactly at the text being published
  if (
    !newest ||
    later.some((row) => row.changeKind !== "correction") ||
    hashDocument(newest.bodyMarkdown) !== currentHash
  ) {
    return {
      ok: false,
      reason:
        "Yayımlanacak metin, yazarın yayın izni verdiği metinle aynı değil ve aradaki fark kayıtlı bir düzeltme değil. " +
        "Yazardan bu metin için yeni Eser Onayı alınmalı.",
    };
  }

  return { ok: true };
}
