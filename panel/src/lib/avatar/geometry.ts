/**
 * Drawing primitives for the avatar renderer (D-194).
 *
 * Shapes are described as control points and turned into SVG paths here, so
 * the art in `render.ts` stays readable numbers. Every shape goes through the
 * same smoothing, which is what keeps sixteen hair styles and six faces in one
 * drawing system rather than a pile of hand-traced paths.
 */

export type Point = readonly [number, number];

/**
 * A point on a closed shape. The optional flag marks whether the edge that
 * starts here takes the hair texture (`true`, the default for hair) or stays
 * smooth (`false`, e.g. a hairline that must meet the forehead cleanly).
 */
export type ShapePoint = readonly [number, number] | readonly [number, number, boolean];

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

function channels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function toHex(parts: readonly number[]): string {
  return `#${parts
    .map((part) => Math.round(Math.min(255, Math.max(0, part))).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Linear blend of two hex colours; `amount` 0 keeps `from`, 1 gives `to`. */
export function mix(from: string, to: string, amount: number): string {
  const a = channels(from);
  const b = channels(to);
  return toHex(a.map((part, index) => part + (b[index]! - part) * amount));
}

/** The shadow tone. Mixed towards a warm plum instead of black, so shade never looks dirty. */
export function shade(hex: string, amount = 0.22): string {
  return mix(hex, "#3a1f2e", amount);
}

export function tint(hex: string, amount = 0.3): string {
  return mix(hex, "#ffffff", amount);
}

/** Relative luminance (0–1), for deciding whether a detail needs a dark or a light line. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((part) => {
    const c = part / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

const round = (value: number) => Math.round(value * 10) / 10;
const pt = (point: Point) => `${round(point[0])} ${round(point[1])}`;

/** Mirrors a point across the avatar's vertical centre line. */
export function mirrorX(point: Point, centre = 512): Point {
  return [centre * 2 - point[0], point[1]];
}

/**
 * Builds a symmetric closed outline from its right half, listed from the top
 * centre down to the bottom centre. The left half is the mirror, in reverse.
 */
export function symmetric(rightHalf: readonly Point[]): Point[] {
  const left = rightHalf
    .slice(1, -1)
    .reverse()
    .map((point) => mirrorX(point));
  return [...rightHalf, ...left];
}

type Segment = { from: Point; c1: Point; c2: Point; to: Point };

/** Catmull-Rom through every point, as cubic Bézier segments. */
function closedSegments(points: readonly Point[], tension = 1): Segment[] {
  const count = points.length;
  const at = (index: number) => points[(index + count) % count]!;
  const segments: Segment[] = [];
  for (let index = 0; index < count; index += 1) {
    const p0 = at(index - 1);
    const p1 = at(index);
    const p2 = at(index + 1);
    const p3 = at(index + 2);
    segments.push({
      from: p1,
      c1: [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension],
      c2: [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension],
      to: p2,
    });
  }
  return segments;
}

export function smoothClosedPath(points: readonly Point[], tension = 1): string {
  const segments = closedSegments(points, tension);
  const body = segments.map((s) => `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.to)}`).join(" ");
  return `M${pt(points[0]!)} ${body}Z`;
}

/** Catmull-Rom through an open run of points; the ends repeat themselves as neighbours. */
function openSegments(points: readonly Point[], tension = 1): Segment[] {
  const at = (index: number) => points[Math.min(points.length - 1, Math.max(0, index))]!;
  const segments: Segment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = at(index - 1);
    const p1 = at(index);
    const p2 = at(index + 1);
    const p3 = at(index + 2);
    segments.push({
      from: p1,
      c1: [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension],
      c2: [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension],
      to: p2,
    });
  }
  return segments;
}

/** An open smooth curve through the points (the ends are not joined). */
export function smoothOpenPath(points: readonly Point[], tension = 1): string {
  if (points.length < 2) return "";
  const body = openSegments(points, tension).map((s) => `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.to)}`).join(" ");
  return `M${pt(points[0]!)} ${body}`;
}

function bezierAt(s: Segment, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * s.from[0] + b * s.c1[0] + c * s.c2[0] + d * s.to[0],
    a * s.from[1] + b * s.c1[1] + c * s.c2[1] + d * s.to[1],
  ];
}

/** Evenly spaced points along a segment, by arc length. */
function resample(s: Segment, spacing: number): Point[] {
  const dense: Point[] = [];
  const steps = 48;
  for (let index = 0; index <= steps; index += 1) dense.push(bezierAt(s, index / steps));

  const lengths = [0];
  for (let index = 1; index < dense.length; index += 1) {
    const [x0, y0] = dense[index - 1]!;
    const [x1, y1] = dense[index]!;
    lengths.push(lengths[index - 1]! + Math.hypot(x1 - x0, y1 - y0));
  }
  const total = lengths[lengths.length - 1]!;
  const count = Math.max(1, Math.round(total / spacing));

  const result: Point[] = [];
  let cursor = 0;
  for (let index = 0; index <= count; index += 1) {
    const target = (total * index) / count;
    while (cursor < lengths.length - 2 && lengths[cursor + 1]! < target) cursor += 1;
    const span = lengths[cursor + 1]! - lengths[cursor]! || 1;
    const t = (target - lengths[cursor]!) / span;
    const [x0, y0] = dense[cursor]!;
    const [x1, y1] = dense[cursor + 1]!;
    result.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
  }
  return result;
}

export type Texture = "straight" | "wavy" | "curly" | "coily";

/** Wavelength and bump height of each texture on an outline, in canvas units. */
const EDGE: Record<Texture, { spacing: number; amplitude: number } | null> = {
  straight: null,
  wavy: { spacing: 64, amplitude: 6 },
  curly: { spacing: 36, amplitude: 10 },
  coily: { spacing: 24, amplitude: 7 },
};

/**
 * A closed outline whose flagged edges carry the hair texture: smooth for
 * straight hair, a gentle wave, round scallops for curls, tight ones for
 * coils. The bumps always point outwards, whichever way the points run.
 */
export function texturedClosedPath(points: readonly ShapePoint[], texture: Texture, scale = 1): string {
  const plain = points.map((point) => [point[0], point[1]] as Point);
  const segments = closedSegments(plain);
  const edge = EDGE[texture];

  // Shoelace sign: positive means clockwise on screen (y grows downwards)
  let area = 0;
  plain.forEach((point, index) => {
    const next = plain[(index + 1) % plain.length]!;
    area += point[0] * next[1] - next[0] * point[1];
  });
  const outward = area > 0 ? 1 : -1;

  let d = `M${pt(plain[0]!)}`;
  segments.forEach((segment, index) => {
    const textured = points[index]![2] !== false;
    if (!edge || !textured) {
      d += ` C${pt(segment.c1)} ${pt(segment.c2)} ${pt(segment.to)}`;
      return;
    }
    const spacing = edge.spacing * scale;
    const amplitude = edge.amplitude * scale;
    const samples = resample(segment, spacing);
    for (let step = 1; step < samples.length; step += 1) {
      const [x0, y0] = samples[step - 1]!;
      const [x1, y1] = samples[step]!;
      const length = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = ((y1 - y0) / length) * outward;
      const ny = (-(x1 - x0) / length) * outward;
      // A wave alternates in and out; curls and coils always bulge outwards
      const sign = texture === "wavy" ? (step % 2 === 0 ? -1 : 1) : 1;
      const control: Point = [(x0 + x1) / 2 + nx * amplitude * 2 * sign, (y0 + y1) / 2 + ny * amplitude * 2 * sign];
      d += ` Q${pt(control)} ${pt([x1, y1])}`;
    }
  });
  return `${d}Z`;
}

/**
 * The strokes drawn inside hair to show its texture: long strands for
 * straight hair, S-curves for waves, small arcs for curls and coils.
 */
export function textureStrands(guides: readonly (readonly Point[])[], texture: Texture): string {
  return guides
    .map((guide) => {
      if (texture === "straight") return smoothOpenPath(guide);

      const segments = openSegments(guide);
      if (texture === "wavy") {
        const points = segments.flatMap((segment, index) =>
          resample(segment, 30).slice(index === 0 ? 0 : 1),
        );
        const waved = points.map((point, index) => {
          const previous = points[Math.max(0, index - 1)]!;
          const next = points[Math.min(points.length - 1, index + 1)]!;
          const dx = next[0] - previous[0];
          const dy = next[1] - previous[1];
          const length = Math.hypot(dx, dy) || 1;
          const offset = Math.sin(index * 1.4) * 7;
          return [point[0] + (dy / length) * offset, point[1] - (dx / length) * offset] as Point;
        });
        return smoothOpenPath(waved);
      }

      // Separate arcs all opening the same way read as curls; alternating or
      // touching ones read as letters (x, o) at thumbnail size
      const radius = texture === "curly" ? 10 : 7;
      return segments
        .flatMap((segment) => resample(segment, radius * 4.2))
        .map(([x, y]) => `M${pt([x - radius, y])} A${radius} ${radius} 0 0 1 ${pt([x + radius, y])}`)
        .join(" ");
    })
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Hair locks                                                          */
/* ------------------------------------------------------------------ */

/**
 * One lock of hair: root point, tip point, width at the root and how far its
 * middle bows sideways. Hair styles are lists of these (D-195), which is what
 * gives the drawing separate, overlapping locks instead of one helmet shape.
 */
export type Lock = readonly [rootX: number, rootY: number, tipX: number, tipY: number, width: number, bend: number];

/** How each texture bends a lock along its length and how it ends. */
const LOCK_TEXTURE: Record<Texture, { waves: number; amplitude: number; tipWidth: number }> = {
  straight: { waves: 0, amplitude: 0, tipWidth: 0 },
  wavy: { waves: 0.55, amplitude: 12, tipWidth: 0.04 },
  curly: { waves: 0.8, amplitude: 13, tipWidth: 0.14 },
  coily: { waves: 1.1, amplitude: 10, tipWidth: 0.22 },
};

type LockSpine = { points: Point[]; normals: Point[]; widths: number[] };

function lockSpine(lock: Lock, texture: Texture): LockSpine {
  const [rx, ry, tx, ty, width, bend] = lock;
  const length = Math.hypot(tx - rx, ty - ry) || 1;
  const nx = -(ty - ry) / length;
  const ny = (tx - rx) / length;
  const shape = LOCK_TEXTURE[texture];
  const steps = 12;

  const points: Point[] = [];
  const widths: number[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    // The wave grows towards the tip: the root sits flat against the head
    const wave = shape.amplitude * Math.sin(t * Math.PI * 2 * shape.waves) * t;
    const offset = bend * 4 * t * (1 - t) + wave;
    points.push([rx + (tx - rx) * t + nx * offset, ry + (ty - ry) * t + ny * offset]);
    widths.push(width * (shape.tipWidth + (1 - shape.tipWidth) * (1 - t) ** 0.9));
  }

  const normals = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)]!;
    const next = points[Math.min(points.length - 1, index + 1)]!;
    const dx = next[0] - previous[0];
    const dy = next[1] - previous[1];
    const size = Math.hypot(dx, dy) || 1;
    return [-dy / size, dx / size] as Point;
  });
  return { points, normals, widths };
}

/** The closed outline of a lock: out along one edge, back along the other. */
export function lockPath(lock: Lock, texture: Texture): string {
  const { points, normals, widths } = lockSpine(lock, texture);
  const left = points.map((p, i) => [p[0] + (normals[i]![0] * widths[i]!) / 2, p[1] + (normals[i]![1] * widths[i]!) / 2] as Point);
  const right = points.map((p, i) => [p[0] - (normals[i]![0] * widths[i]!) / 2, p[1] - (normals[i]![1] * widths[i]!) / 2] as Point);
  const tipMeets = widths[widths.length - 1]! < 1;
  const outline = [...left, ...right.reverse().slice(tipMeets ? 1 : 0)];
  return smoothClosedPath(outline, 0.9);
}

/** The strand line drawn inside a lock, off its centre, to show its flow. */
export function lockStrand(lock: Lock, texture: Texture): string {
  const { points, normals, widths } = lockSpine(lock, texture);
  const run = points
    .map((p, i) => [p[0] + normals[i]![0] * widths[i]! * 0.16, p[1] + normals[i]![1] * widths[i]! * 0.16] as Point)
    .slice(2, 9);
  return smoothOpenPath(run);
}

/** A lock seen in the mirror, for symmetric styles. */
export function mirrorLock(lock: Lock, centre = 512): Lock {
  return [centre * 2 - lock[0], lock[1], centre * 2 - lock[2], lock[3], lock[4], -lock[5]];
}
