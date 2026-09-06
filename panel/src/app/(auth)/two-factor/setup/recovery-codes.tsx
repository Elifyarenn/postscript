"use client";

/**
 * Shows the freshly issued recovery codes once, with a copy button.
 * Only hashes are kept server side, so this render is the user's one chance.
 */
import { useState } from "react";
import { Button } from "@/components/ui";

export function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the codes are on screen either way
      setCopied(false);
    }
  }

  return (
    <div className="rounded-md border border-accent/30 bg-accent-soft p-4">
      <p className="mb-3 text-sm font-medium text-accent">Kurtarma kodları</p>

      <ul className="grid grid-cols-2 gap-1.5 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>

      <Button type="button" variant="secondary" className="mt-3" onClick={copy}>
        {copied ? "Kopyalandı" : "Kodları kopyala"}
      </Button>
    </div>
  );
}
