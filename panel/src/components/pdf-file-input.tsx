"use client";

/**
 * A PDF file field that refuses an oversized file in the browser (D-301).
 *
 * The host cuts a request off at about 4.5 MB before the server action runs,
 * so the action's own "Dosya çok büyük" never reaches the member: they saw the
 * site's error page instead. Checking here says why, and what to do, and keeps
 * the form from sending a request that cannot arrive.
 */
import { useState } from "react";
import { Input } from "@/components/ui";
import { oversizeMessage } from "@/lib/upload-size";

export function PdfFileInput({ id, name = "file", maxMb }: { id: string; name?: string; maxMb: number }) {
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <>
      <Input
        id={id}
        name={name}
        type="file"
        required
        accept=".pdf,application/pdf"
        aria-describedby={problem ? `${id}-problem` : undefined}
        onChange={(event) => {
          const message = oversizeMessage(event.currentTarget.files?.[0]?.size ?? 0, maxMb);
          // The browser's own validation then holds the submit button's request back
          event.currentTarget.setCustomValidity(message ?? "");
          setProblem(message);
        }}
      />
      {problem && (
        <p id={`${id}-problem`} role="alert" className="mt-1 text-sm text-danger">
          {problem}
        </p>
      )}
    </>
  );
}
