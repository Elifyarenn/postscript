"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { resolveHelpHref, type HelpTarget } from "@/lib/panel-guides/help-match";

/**
 * The header's "Bu sayfanın rehberi" button (D-384): opens the guide section
 * that explains the current page. The server hands over only the small
 * path→section table, not the guide texts.
 */
export function GuideHelpButton({ targets, guidePath }: { targets: HelpTarget[]; guidePath: string }) {
  const pathname = usePathname();
  const href = resolveHelpHref(targets, guidePath, pathname);
  if (!href) return null;
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-accent transition-colors hover:bg-accent-soft sm:min-h-0"
      title="Bu sayfanın nasıl kullanıldığını anlatan rehber bölümünü açar"
    >
      <CircleHelp className="size-3.5" aria-hidden />
      <span className="sm:hidden">Rehber</span>
      <span className="hidden sm:inline">Bu sayfanın rehberi</span>
    </Link>
  );
}
