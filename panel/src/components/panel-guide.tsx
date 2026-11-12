import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CircleHelp, ExternalLink, RotateCcw } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { GuideFigure } from "@/components/panel-guide-figures";
import type { GuideBlock, GuideSection, GuideTone, PanelGuide } from "@/lib/panel-guides";
import { cn } from "@/lib/utils";

/**
 * Renders the panel usage guides (D-384). The text lives as data in
 * `src/lib/panel-guides/*` so a test can check that every page it points to
 * still exists; this file only lays it out.
 */

// `**…**` marks a button or menu label; the guide has no other markup, so a
// full Markdown pipeline (and its sanitising) would be dead weight here.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-medium text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

const TONE: Record<GuideTone, string> = {
  // The site has no green token of its own; the writer tag's green reads as "fine" here
  ok: "border-role-writer/40 bg-role-writer/5",
  warn: "border-accent/40 bg-accent-soft",
  neutral: "border-line bg-surface",
};

const TONE_MARK: Record<GuideTone, string> = { ok: "✓", warn: "!", neutral: "•" };

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="text-sm leading-relaxed text-ink">{inline(block.text)}</p>;
    case "steps":
      return (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink">
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink">
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>
      );
    case "note":
      return (
        <p className="rounded-md border border-line bg-paper px-3 py-2 text-sm leading-relaxed text-muted">
          {inline(block.text)}
        </p>
      );
    case "figure":
      return <GuideFigure name={block.name} caption={block.caption} />;
    case "flow":
      return (
        <figure className="rounded-md border border-line bg-paper p-4">
          {/* An ordered list, so a screen reader reads the steps in order */}
          <ol className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {block.steps.map((step, index) => (
              <li key={step} className="flex items-center gap-2 sm:contents">
                <span className="flex min-h-12 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink sm:max-w-44 sm:flex-none">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-paper">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </span>
                {index < block.steps.length - 1 && (
                  <ArrowRight className="hidden size-4 shrink-0 text-muted sm:block" aria-hidden />
                )}
              </li>
            ))}
          </ol>
          {block.loop && (
            <p className="mt-3 flex items-start gap-2 text-xs text-muted">
              <RotateCcw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {block.loop}
            </p>
          )}
          <figcaption className="mt-2 text-center text-xs text-muted">{block.caption}</figcaption>
        </figure>
      );
    case "timeline":
      return (
        <figure className="rounded-md border border-line bg-paper p-4">
          <ol className="grid gap-2 sm:auto-cols-fr sm:grid-flow-col">
            {block.segments.map((segment, index) => (
              <li key={segment.label} className="rounded-md border border-line bg-surface">
                {/* The bar darkens step by step, so the order reads without the numbers */}
                <div className="h-2 rounded-t-md bg-accent" style={{ opacity: 0.35 + (0.65 * (index + 1)) / block.segments.length }} />
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-ink">{segment.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{segment.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <figcaption className="mt-2 text-center text-xs text-muted">{block.caption}</figcaption>
        </figure>
      );
    case "compare":
      return (
        <div className={cn("grid gap-2", block.items.length > 2 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2")}>
          {block.items.map((item) => (
            <div key={item.title} className={cn("rounded-md border px-3 py-2", TONE[item.tone])}>
              <p className="mb-1 text-sm font-medium text-ink">
                <span aria-hidden className="mr-1.5">
                  {TONE_MARK[item.tone]}
                </span>
                {item.title}
              </p>
              <ul className="space-y-0.5 text-xs leading-relaxed text-muted">
                {item.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case "links":
      return (
        <div>
          <h3 className="mb-2 text-sm font-medium text-ink">{block.title}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {block.items.map((link) => (
              <li key={link.href} className="rounded-md border border-line px-3 py-2">
                {/* Outside sites open in a new tab, so the panel page stays where it was */}
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                >
                  {link.label}
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only"> (yeni sekmede açılır)</span>
                </a>
                <p className="mt-1 text-xs leading-relaxed text-muted">{link.note}</p>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

function SectionBody({ section }: { section: GuideSection }) {
  return (
    <div className="space-y-3">
      {section.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

export function PanelGuideView({ guide, related }: { guide: PanelGuide; related?: { href: string; label: string } }) {
  return (
    <>
      <PageHeader
        title={guide.title}
        description={guide.intro}
        actions={
          related && (
            <Link href={related.href} className="text-sm text-accent hover:underline">
              {related.label} →
            </Link>
          )
        }
      />

      <Card className="mb-6">
        <h2 className="mb-2 font-serif text-lg">İçindekiler</h2>
        <ol className="grid list-decimal gap-x-8 gap-y-1 pl-5 text-sm sm:grid-cols-2">
          {guide.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-accent hover:underline">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </Card>

      {guide.sections.map((section, index) => (
        <Card key={section.id} id={section.id} className="mb-6 scroll-mt-6 target:ring-2 target:ring-accent/40">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-lg">
              {index + 1}. {section.title}
            </h2>
            {section.href && (
              <Link href={section.href} className="text-sm text-accent hover:underline">
                Sayfaya git →
              </Link>
            )}
          </div>
          {section.who && <p className="mb-3 text-xs tracking-wide text-muted uppercase">{section.who}</p>}
          <SectionBody section={section} />
        </Card>
      ))}
    </>
  );
}

/** A small "how does this work?" link beside a form, to the guide section that explains it. */
export function GuideHint({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border border-line bg-paper px-2 py-1 text-xs text-accent transition-colors hover:bg-accent-soft"
    >
      <CircleHelp className="size-3.5 shrink-0" aria-hidden />
      {children}
    </Link>
  );
}

/**
 * A guide section folded into a page, for people who cannot open the panel
 * guides: an applicant signs the contract before they are a writer.
 */
export function GuideSectionDetails({ section, summary }: { section: GuideSection; summary: string }) {
  return (
    <details className="rounded-md border border-line bg-paper px-3 py-2">
      <summary className="flex cursor-pointer items-center gap-1.5 text-sm text-accent">
        <CircleHelp className="size-4 shrink-0" aria-hidden />
        {summary}
      </summary>
      <div className="mt-3">
        <SectionBody section={section} />
      </div>
    </details>
  );
}
