/**
 * The writer promotion conditions (§6) as codes and as the checklist rows
 * the admin and the member see (D-366). Kept free of the database so the
 * account screens can show the same list the service checks.
 */
import { MINIMUM_WRITER_AGE } from "@/lib/age";

export type EligibilityProblem =
  | "email_not_verified"
  | "birth_date_missing"
  | "under_age"
  | "kvkk_not_accepted"
  | "banned";

/**
 * Every condition in the satisfied wording, in the order shown. A `Record`
 * over the codes, so a condition cannot be checked and left off a screen: the
 * admin's list had no KVKK row and the member's looked for a code the service
 * never returns, so an account without consent showed every tick green.
 */
export const ELIGIBILITY_RULE_LABELS: Record<EligibilityProblem, string> = {
  email_not_verified: "E-posta adresi doğrulanmış",
  birth_date_missing: "Doğum tarihi girilmiş",
  under_age: `${MINIMUM_WRITER_AGE} yaşını doldurmuş`,
  kvkk_not_accepted: "KVKK aydınlatma metni onaylanmış",
  banned: "Yasaklı değil",
};

/** The rows in display order, for a checklist. */
export const ELIGIBILITY_RULES = (Object.entries(ELIGIBILITY_RULE_LABELS) as [EligibilityProblem, string][]).map(
  ([id, label]) => ({ id, label }),
);
