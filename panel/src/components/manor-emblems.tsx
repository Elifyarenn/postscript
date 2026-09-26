/**
 * Line drawings for the manor game's rooms (D-263). Thin strokes in the text
 * colour, meant to read like an engraving in an old book rather than an icon
 * set. Decorative only: every one is hidden from screen readers.
 */
import type { ReactNode } from "react";

export type ManorMood =
  | "hall"
  | "portraits"
  | "mirror"
  | "ballroom"
  | "pantry"
  | "library"
  | "conservatory"
  | "tunnel"
  | "ending";

/** The eight-ray star the magazine draws everywhere, reused for the endings. */
function starPath(cx: number, cy: number, long: number): string {
  const points: string[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI / 8) * i - Math.PI / 2;
    const radius = i % 4 === 0 ? long : i % 2 === 0 ? long * 0.42 : long * 0.12;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

/** A pointed gothic arch from (x, bottom) to (x + width, bottom), rising to `top`. */
function lancet(x: number, width: number, top: number, bottom: number): string {
  const spring = top + width * 0.9;
  return `M${x} ${bottom}V${spring}Q${x} ${top + width * 0.15} ${x + width / 2} ${top}Q${x + width} ${top + width * 0.15} ${x + width} ${spring}V${bottom}`;
}

const DRAWINGS: Record<ManorMood, ReactNode> = {
  // The entrance: a tall window, lightning behind the tracery
  hall: (
    <>
      <path d={lancet(24, 72, 8, 152)} />
      <path d={lancet(32, 56, 18, 152)} />
      <path d="M60 18V152M32 96H88" />
      <circle cx="60" cy="58" r="14" />
      <path d="M60 44V72M46 58H74" opacity="0.6" />
      <path d="M74 104l-8 14h8l-10 18" strokeWidth="1.6" />
      <path d="M40 104v10M46 112v10M52 102v8" opacity="0.45" />
    </>
  ),
  // Two oval portrait frames on their cords
  portraits: (
    <>
      <path d="M60 4L36 30M60 4l24 26" opacity="0.6" />
      <ellipse cx="60" cy="74" rx="38" ry="48" />
      <ellipse cx="60" cy="74" rx="31" ry="41" />
      <circle cx="60" cy="62" r="11" />
      <path d="M38 106c4-16 14-24 22-24s18 8 22 24" />
      <circle cx="56" cy="61" r="1.4" fill="currentColor" />
      <circle cx="64" cy="61" r="1.4" fill="currentColor" />
      <path d="M22 140h76M30 148h60" opacity="0.5" />
    </>
  ),
  // The great mirror, and a veiled figure standing in it
  mirror: (
    <>
      <path d={lancet(20, 80, 6, 154)} />
      <path d={lancet(28, 64, 16, 146)} />
      <path d="M28 146h64" />
      <circle cx="60" cy="66" r="9" />
      <path d="M50 64c2-12 18-12 20 0l4 22H46z" opacity="0.7" />
      <path d="M52 86l-8 52h32l-8-52" />
      <path d="M68 92l14-10" />
    </>
  ),
  // The chandelier over the ballroom, symmetrical
  ballroom: (
    <>
      <path d="M60 2V40" />
      <circle cx="60" cy="46" r="6" />
      <path d="M60 52v36M20 70c10 22 30 26 40 26s30-4 40-26" />
      <path d="M34 82c6 12 16 16 26 16s20-4 26-16" opacity="0.6" />
      <path d="M20 70v-10M40 84v-10M60 96V86M80 84V74M100 70V60" />
      <path d="M20 56c-2-3 0-6 0-8 0 2 2 5 0 8zM40 70c-2-3 0-6 0-8 0 2 2 5 0 8zM60 82c-2-3 0-6 0-8 0 2 2 5 0 8zM80 70c-2-3 0-6 0-8 0 2 2 5 0 8zM100 56c-2-3 0-6 0-8 0 2 2 5 0 8z" fill="currentColor" />
      <path d="M60 98l6 12-6 14-6-14z" opacity="0.7" />
      <path d="M60 124v8M40 86l3 8-3 8-3-8zM80 86l3 8-3 8-3-8z" opacity="0.5" />
      <path d="M26 150h68" opacity="0.5" />
    </>
  ),
  // The garden door in the pantry, its rusted lock
  pantry: (
    <>
      <path d={lancet(26, 68, 12, 152)} />
      <path d="M26 152h68M60 34v118" />
      <path d="M34 58h52M34 92h52M34 126h52" opacity="0.45" />
      <rect x="66" y="96" width="14" height="18" rx="2" />
      <circle cx="73" cy="103" r="2.4" />
      <path d="M73 105v5" />
      <path d="M80 92c6 0 8-6 8-10s-4-8-8-8" opacity="0.7" />
    </>
  ),
  // The diary with its wax seal
  library: (
    <>
      <path d="M12 118c16-8 32-8 48 0 16-8 32-8 48 0V52c-16-8-32-8-48 0-16-8-32-8-48 0z" />
      <path d="M60 52v66" />
      <path d="M22 64c10-4 20-4 30 0M22 76c10-4 20-4 30 0M22 88c10-4 20-4 30 0M68 64c10-4 20-4 30 0M68 76c10-4 20-4 30 0" opacity="0.45" />
      <circle cx="84" cy="96" r="12" />
      <path d={starPath(84, 96, 7)} fill="currentColor" opacity="0.8" />
      <path d="M58 24v14M54 30c0-6 4-10 4-12 0 2 4 6 4 12s-8 6-8 0z" />
      <path d="M52 38h12v6H52z" />
    </>
  ),
  // A rose window, broken, and the vines through it
  conservatory: (
    <>
      <circle cx="60" cy="62" r="46" />
      <circle cx="60" cy="62" r="14" />
      <path d="M60 16v32M60 76v32M14 62h32M74 62h32M27 29l23 23M70 72l23 23M93 29L70 52M50 72L27 95" />
      <path d="M78 22l6 14-10 4 8 12" strokeWidth="1.6" opacity="0.8" />
      <path d="M20 150c10-20 4-34 16-48s24-8 30-20M34 116c-8-2-12-8-12-14 6 0 12 6 12 14zM52 96c2-8 8-12 14-12 0 6-6 12-14 12z" />
      <path d="M92 118v8M100 128v8M84 132v8" opacity="0.45" />
    </>
  ),
  // Arches narrowing into the dark, a torch on the wall
  tunnel: (
    <>
      <path d={lancet(10, 100, 10, 156)} />
      <path d={lancet(28, 64, 40, 156)} opacity="0.75" />
      <path d={lancet(42, 36, 70, 156)} opacity="0.5" />
      <path d={lancet(52, 16, 100, 156)} opacity="0.3" />
      <path d="M10 156h100" />
      <path d="M92 92l8-14M96 78c-4-4-2-10 2-14 1 4 5 6 4 11-1 3-3 4-6 3z" />
    </>
  ),
  // Every ending: the magazine's star in a ring, between two rules
  ending: (
    <>
      <circle cx="60" cy="80" r="40" />
      <circle cx="60" cy="80" r="34" opacity="0.5" />
      <path d={starPath(60, 80, 30)} fill="currentColor" />
      <path d="M4 80h12M104 80h12M60 20v12M60 128v12" opacity="0.6" />
    </>
  ),
};

export function ManorEmblem({ mood, className }: { mood: ManorMood; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 160"
      aria-hidden
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {DRAWINGS[mood]}
    </svg>
  );
}
