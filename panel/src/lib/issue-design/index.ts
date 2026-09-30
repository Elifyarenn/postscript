/**
 * Every issue whose designed pages are kept in code (D-274). A new issue's
 * manifest is added to this list and nowhere else.
 */
import { ISSUE_01_DESIGN } from "./issue-01";
import { designManifestSchema, type DesignManifest } from "./manifest";

export const DESIGNS: DesignManifest[] = [ISSUE_01_DESIGN].map((manifest) => designManifestSchema.parse(manifest));

export function designFor(issueNumber: number): DesignManifest | null {
  return DESIGNS.find((manifest) => manifest.issueNumber === issueNumber) ?? null;
}
