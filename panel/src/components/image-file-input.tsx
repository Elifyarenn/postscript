"use client";

/**
 * An image file field that refuses an oversized drawing in the browser
 * (D-362), as `PdfFileInput` does for PDFs (D-301): the host would cut the
 * request off before the action could say why.
 */
import { useState } from "react";
import { Input } from "@/components/ui";
import { IMAGE_ADVICE, oversizeMessage } from "@/lib/upload-size";

export function ImageFileInput({ id, name = "file", maxMb }: { id: string; name?: string; maxMb: number }) {
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <>
      <Input
        id={id}
        name={name}
        type="file"
        required
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        aria-describedby={problem ? `${id}-problem` : undefined}
        onChange={(event) => {
          const message = oversizeMessage(event.currentTarget.files?.[0]?.size ?? 0, maxMb, IMAGE_ADVICE);
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
