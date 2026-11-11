import type { JSX } from "react";
import type { GuideFigureName } from "@/lib/panel-guides";

/**
 * The guide's drawings (D-384). Inline SVG coloured with `currentColor` and
 * the theme's text classes, so they follow light and dark mode without image
 * files to upload or keep in step. Flows, timelines and comparisons are HTML
 * (`panel-guide.tsx`); only what has to be drawn lives here.
 */

function Page({ x, last, label }: { x: number; last: boolean; label: string }) {
  return (
    <g transform={`translate(${x} 10)`}>
      <rect width="120" height="160" rx="4" className="fill-surface stroke-current text-line" strokeWidth="1.5" />
      {[22, 34, 46, 58, 70, 82, 94].map((y) => (
        <rect key={y} x="14" y={y} width={y === 94 ? 60 : 92} height="4" rx="2" className="fill-current text-line" />
      ))}
      {last && (
        <g>
          <text x="14" y="114" className="fill-current text-muted" fontSize="8">
            İmza
          </text>
          <path
            d="M14 128 q8 -14 16 0 t16 0 q6 -8 14 -2"
            fill="none"
            className="stroke-current text-accent"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line x1="14" y1="132" x2="80" y2="132" className="stroke-current text-muted" strokeWidth="1" />
        </g>
      )}
      {/* The initials box at the foot of every page */}
      <rect x="78" y="136" width="34" height="18" rx="2" fill="none" className="stroke-current text-accent" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="95" y="149" textAnchor="middle" className="fill-current text-accent" fontSize="9" fontStyle="italic">
        E.Y.
      </text>
      <text x="14" y="150" className="fill-current text-muted" fontSize="8">
        {label}
      </text>
    </g>
  );
}

function SignedPages() {
  return (
    <svg viewBox="0 0 440 200" className="h-auto w-full max-w-xl" role="img" aria-label="Üç sayfalık belge: her sayfanın altında paraf, son sayfada ayrıca imza">
      <Page x={10} last={false} label="Sayfa 1" />
      <Page x={160} last={false} label="Sayfa 2" />
      <Page x={310} last label="Son sayfa" />
      <text x="220" y="194" textAnchor="middle" className="fill-current text-muted" fontSize="10">
        Her sayfada paraf · son sayfada ayrıca imza
      </text>
    </svg>
  );
}

// An example issue: three writers in one category; the numbers only illustrate the rule
const BUDGET = [
  { label: "Yazar A · 520", words: 520 },
  { label: "Yazar B · 430", words: 430 },
  { label: "Yazar C · 380", words: 380 },
];
const BUDGET_TOTAL = 1600;

function WordBudget() {
  const left = 10;
  const width = 420;
  const scale = width / BUDGET_TOTAL;
  const used = BUDGET.reduce((sum, row) => sum + row.words, 0);
  // Each segment starts where the ones before it end
  const starts = BUDGET.map((_, index) => left + BUDGET.slice(0, index).reduce((sum, row) => sum + row.words * scale, 0));
  const end = left + used * scale;
  return (
    <svg viewBox="0 0 440 112" className="h-auto w-full max-w-xl" role="img" aria-label={`Örnek: bir kategoride üç yazı toplam ${used} kelime, 1.600 kelimelik sınırdan ${BUDGET_TOTAL - used} kelime kaldı`}>
      <text x={left} y="16" className="fill-current text-ink" fontSize="11" fontWeight="600">
        Bir kategori · bir sayı
      </text>
      <text x={left + width} y="16" textAnchor="end" className="fill-current text-muted" fontSize="10">
        sınır 1.600 kelime
      </text>
      <rect x={left} y="26" width={width} height="34" rx="4" className="fill-surface stroke-current text-line" strokeWidth="1.5" />
      {BUDGET.map((row, index) => {
        const x = starts[index] ?? left;
        return (
          <g key={row.label}>
            <rect
              x={x + 1}
              y="28"
              width={row.words * scale - 2}
              height="30"
              rx="3"
              className="fill-current text-accent"
              opacity={1 - index * 0.25}
            />
            <text x={x + (row.words * scale) / 2} y="47" textAnchor="middle" className="fill-paper" fontSize="10">
              {row.label}
            </text>
          </g>
        );
      })}
      <text x={end + (left + width - end) / 2} y="47" textAnchor="middle" className="fill-current text-muted" fontSize="10">
        kalan {BUDGET_TOTAL - used}
      </text>
      {/* The 500-word recommendation per article, drawn as a ruler under the bar */}
      <line x1={left} y1="74" x2={left + 500 * scale} y2="74" className="stroke-current text-muted" strokeWidth="1.5" />
      <line x1={left} y1="70" x2={left} y2="78" className="stroke-current text-muted" strokeWidth="1.5" />
      <line x1={left + 500 * scale} y1="70" x2={left + 500 * scale} y2="78" className="stroke-current text-muted" strokeWidth="1.5" />
      <text x={left} y="92" className="fill-current text-muted" fontSize="10">
        Yazı başına önerilen: 500 kelime (yalnızca uyarı)
      </text>
      <text x={left} y="106" className="fill-current text-muted" fontSize="10">
        Toplamı aşan kayıt reddedilir; metni kısaltmak her zaman serbest.
      </text>
    </svg>
  );
}

const FIGURES: Record<GuideFigureName, () => JSX.Element> = {
  "signed-pages": SignedPages,
  "word-budget": WordBudget,
};

export function GuideFigure({ name, caption }: { name: GuideFigureName; caption: string }) {
  const Figure = FIGURES[name];
  return (
    <figure className="rounded-md border border-line bg-paper p-4">
      <div className="flex justify-center overflow-x-auto">
        <Figure />
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}
