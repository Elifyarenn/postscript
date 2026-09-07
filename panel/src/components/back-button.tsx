"use client";

/**
 * A visible back button for the panel header: goes to the previous page in
 * the browser history, like the browser's own back. Falls back to the home
 * page when there is nothing to go back to.
 */
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-paper hover:text-ink"
      title="Önceki sayfaya dön"
    >
      <ChevronLeft className="size-3.5" />
      Geri
    </button>
  );
}