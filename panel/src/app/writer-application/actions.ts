"use server";

/**
 * The last stage of the writer application pipeline: the applicant signs the
 * contract that was defined at admin approval.
 *
 * The action re-checks the session, then the service re-verifies ownership,
 * status and the rendered-text hash. Nothing about the page render is trusted.
 */
import { redirect } from "next/navigation";
import { signApplicationContract } from "@/services/writer-applications";
import { requestMetadata, requireAuth } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { checkbox, runAction, text, type ActionState } from "@/lib/action";

export async function signApplicationContractAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    const meta = await requestMetadata();

    await signApplicationContract(
      { ...user },
      text(formData, "applicationId"),
      {
        agreementVersionId: text(formData, "agreementVersionId"),
        renderedHash: text(formData, "renderedHash"),
        acknowledged: checkbox(formData, "acknowledged") as true,
      },
      meta,
    );

    // The signature is what makes the account a writer
    destination = "/writer";
  });

  if (destination) redirect(destination);
  return result;
}