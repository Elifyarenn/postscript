"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { resolveHelpTarget, type HelpTarget } from "@/lib/panel-guides/help-match";

/**
 * The panels' help links (D-384, D-386): the header's "Bu sayfanın rehberi"
 * button and the "Yardım" link beside every page title both open the guide
 * section that explains the current page. `PanelShell` hands over only the
 * small path→section table, not the guide texts; outside a panel there is no
 * table and the links stay hidden.
 */

type GuideHelp = { targets: HelpTarget[]; guidePath: string };

const GuideHelpContext = createContext<GuideHelp | null>(null);

export function GuideHelpProvider({ value, children }: { value: GuideHelp; children: ReactNode }) {
  return <GuideHelpContext.Provider value={value}>{children}</GuideHelpContext.Provider>;
}

function useHelpTarget() {
  const help = useContext(GuideHelpContext);
  const pathname = usePathname();
  return help ? resolveHelpTarget(help.targets, help.guidePath, pathname) : null;
}

export function GuideHelpButton() {
  const target = useHelpTarget();
  if (!target) return null;
  return (
    <Link
      href={target.href}
      className="inline-flex min-h-10 items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-accent transition-colors hover:bg-accent-soft sm:min-h-0"
      title="Bu sayfanın nasıl kullanıldığını anlatan rehber bölümünü açar"
    >
      <CircleHelp className="size-3.5" aria-hidden />
      <span className="sm:hidden">Rehber</span>
      <span className="hidden sm:inline">Bu sayfanın rehberi</span>
    </Link>
  );
}

/** Beside a page title: names the section, so the reader knows what they will get. */
export function PageHelpLink() {
  const target = useHelpTarget();
  if (!target) return null;
  return (
    <Link
      href={target.href}
      className="inline-flex items-center gap-1 rounded-md border border-line bg-paper px-2 py-1 text-xs text-accent transition-colors hover:bg-accent-soft"
    >
      <CircleHelp className="size-3.5 shrink-0" aria-hidden />
      Yardım{target.title ? `: ${target.title}` : ": kullanım rehberi"}
    </Link>
  );
}
