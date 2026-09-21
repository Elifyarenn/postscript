/**
 * The hair styles as static SVG geometry (D-215, bukle set D-217).
 *
 * The product owner corrected the geometry of every exported style; the
 * corrected files ("pic/geometri-duzeltilmis-svg/") are embedded here as
 * template strings, plus the "daÄŸÄ±nÄ±k bukle" set ("pic/sac-daginik-bukle/").
 * They sit on the finished 1024 canvas (already on the head), so nothing is
 * transformed a second time.
 *
 * The straight texture draws the base set; wavy and curly draw the bukle
 * set (D-217). The baked colours of the exports are tokens, replaced with
 * the chosen palette at draw time:
 *   {hair}       the hair colour itself              -> palette.hair
 *   {hairBack}   the mass behind the head            -> palette.hairShade
 *   {hairStrand} strand and sheen lines              -> shade(hair, 0.35)
 *   {hairBuzz}   the buzz crop                       -> palette.hair
 *   {hairLine}   the ink outline of the hair         -> palette.hairDeep
 *   {surface}, {curl0}â€¦  the sheen and curl clips    -> context.id(name)
 * Shadows and lines are always a darker step of the chosen colour, never a
 * fixed black (D-217).
 */
import { shade } from "../geometry";
import type { DrawContext } from "../canvas";
import type { Asset } from "./types";

type HairParts = {
  back: string;
  front: string;
  /** The clip defs, keyed by the token they define. */
  defs: Record<string, string>;
};

type StaticHair = { id: string; label: string; straight: HairParts; bukle: HairParts };

function paint(markup: string, context: DrawContext): string {
  return markup
    .replace(/\{(surface|curl\d+)\}/g, (_match, name: string) => context.id(name))
    .replaceAll("{hairBuzz}", context.palette.hair)
    .replaceAll("{hairBack}", context.palette.hairShade)
    .replaceAll("{hairStrand}", shade(context.palette.hair, 0.35))
    .replaceAll("{hairLine}", context.palette.hairDeep)
    .replaceAll("{hair}", context.palette.hair);
}

export function hairStaticStyle(style: StaticHair): Asset {
  const partsFor = (context: DrawContext): HairParts => (context.texture === "straight" ? style.straight : style.bukle);
  return {
    id: style.id,
    label: style.label,
    layers: {
      backHair: (context) => {
        const parts = partsFor(context);
        for (const [name, def] of Object.entries(parts.defs)) {
          if (name.startsWith("curl")) context.def(paint(def, context));
        }
        return parts.back === "" ? "" : paint(parts.back, context);
      },
      frontHair: (context) => {
        const parts = partsFor(context);
        if (parts.defs.surface) context.def(paint(parts.defs.surface, context));
        return paint(parts.front, context);
      },
    },
  };
}

export const HAIR_STATIC: StaticHair[] = [
  {
    id: "messy",
    label: "Dağınık",
    straight: { back: `<path d="M286 445 C266 350 286 264 338 213 C381 172 447 155 512 159 C579 154 648 176 691 220 C743 274 758 357 738 447 L750 555 L773 588 L748 581 L754 635 L722 619 L711 658 L670 640 L354 640 L313 658 L302 619 L270 635 L276 581 L251 588 L274 555 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M304 391 C294 502 317 523 292 595" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 545 337 595" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M304 391 C294 502 317 523 292 595" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 545 337 595" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>`, front: `<path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M464 205 C388 225 328 285 307 367" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M482 225 Q451 288 411 315" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M560 203 C642 221 697 285 720 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M546 226 Q577 287 617 311" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" />
    </clipPath>` } },
    bukle: { back: `<path d="M286 445 C266 350 286 264 338 213 C381 172 447 155 512 159 C579 154 648 176 691 220 C743 274 758 357 738 447 L750 555 L773 588 L748 581 L754 635 L722 619 L711 658 L670 640 L354 640 L313 658 L302 619 L270 635 L276 581 L251 588 L274 555 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      </g>
    <g transform="translate(1024 0) scale(-1 1)">
      </g>
    <g clip-path="url(#{curl0})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </g>
    <g transform="translate(0 0)">
      <g transform="translate(263 432) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 528) rotate(-7) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <g transform="translate(263 432) rotate(9) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 528) rotate(-7) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl2})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(327 257) rotate(-13) scale(0.68 0.81)">
      <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(391 237) rotate(-7) scale(0.74 0.89)">
      <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(463 228) rotate(4) scale(0.76 0.91)">
      <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(538 229) rotate(6) scale(0.77 0.85)">
      <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(610 252) rotate(16) scale(0.72 0.82)">
      <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M286 445 C266 350 286 264 338 213 C381 172 447 155 512 159 C579 154 648 176 691 220 C743 274 758 357 738 447 L750 555 L773 588 L748 581 L754 635 L722 619 L711 658 L670 640 L354 640 L313 658 L302 619 L270 635 L276 581 L251 588 L274 555 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl2": `<clipPath id="{curl2}">
      <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" />
    </clipPath>` } },
  },
  {
    id: "shortMessy",
    label: "Kısa dağınık",
    straight: { back: ``, front: `<path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M464 205 C388 225 328 285 307 367" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M482 225 Q451 288 411 315" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M560 203 C642 221 697 285 720 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M546 226 Q577 287 617 311" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" />
    </clipPath>` } },
    bukle: { back: ``, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl0})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(327 257) rotate(-13) scale(0.68 0.81)">
      <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(391 237) rotate(-7) scale(0.74 0.89)">
      <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(463 228) rotate(4) scale(0.76 0.91)">
      <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(538 229) rotate(6) scale(0.77 0.85)">
      <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(610 252) rotate(16) scale(0.72 0.82)">
      <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" />
    </clipPath>` } },
  },
  {
    id: "sidePart",
    label: "Yana taranmış",
    straight: { back: ``, front: `<path d="M281 472 C266 382 284 285 336 231 C386 179 461 166 533 170 C610 171 679 202 714 260 C744 310 749 380 741 465 L716 482 C720 427 705 367 682 333 C610 338 531 311 478 267 C455 311 399 359 336 379 C318 408 311 446 311 480 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M548 199 C446 188 341 252 309 350" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M590 210 C553 218 519 231 493 251 C548 293 610 310 669 310" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M423 239 Q372 280 339 339" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M281 472 C266 382 284 285 336 231 C386 179 461 166 533 170 C610 171 679 202 714 260 C744 310 749 380 741 465 L716 482 C720 427 705 367 682 333 C610 338 531 311 478 267 C455 311 399 359 336 379 C318 408 311 446 311 480 Z" />
    </clipPath>` } },
    bukle: { back: ``, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M281 472 C266 382 284 285 336 231 C386 179 461 166 533 170 C610 171 679 202 714 260 C744 310 749 380 741 465 L716 482 C720 427 705 367 682 333 C610 338 531 311 478 267 C455 311 399 359 336 379 C318 408 311 446 311 480 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl0})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M281 472 C266 382 284 285 336 231 C386 179 461 166 533 170 C610 171 679 202 714 260 C744 310 749 380 741 465 L716 482 C720 427 705 367 682 333 C610 338 531 311 478 267 C455 311 399 359 336 379 C318 408 311 446 311 480 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M281 472 C266 382 284 285 336 231 C386 179 461 166 533 170 C610 171 679 202 714 260 C744 310 749 380 741 465 L716 482 C720 427 705 367 682 333 C610 338 531 311 478 267 C455 311 399 359 336 379 C318 408 311 446 311 480 Z" />
    </clipPath>` } },
  },
  {
    id: "pixie",
    label: "Pixie",
    straight: { back: ``, front: `<path d="M284 467 C275 403 280 326 315 270 L302 262 Q336 209 389 199 L387 184 Q451 157 516 169 C607 164 678 202 717 268 Q748 323 741 428 L728 465 L712 429 Q709 371 675 328 C609 332 544 306 498 269 Q470 316 414 341 L431 313 Q380 351 333 363 L310 461 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M548 199 C446 188 341 252 309 350" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M590 210 C553 218 519 231 493 251 C548 293 610 310 669 310" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M423 239 Q372 280 339 339" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M284 467 C275 403 280 326 315 270 L302 262 Q336 209 389 199 L387 184 Q451 157 516 169 C607 164 678 202 717 268 Q748 323 741 428 L728 465 L712 429 Q709 371 675 328 C609 332 544 306 498 269 Q470 316 414 341 L431 313 Q380 351 333 363 L310 461 Z" />
    </clipPath>` } },
    bukle: { back: ``, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M284 467 C275 403 280 326 315 270 L302 262 Q336 209 389 199 L387 184 Q451 157 516 169 C607 164 678 202 717 268 Q748 323 741 428 L728 465 L712 429 Q709 371 675 328 C609 332 544 306 498 269 Q470 316 414 341 L431 313 Q380 351 333 363 L310 461 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl0})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M284 467 C275 403 280 326 315 270 L302 262 Q336 209 389 199 L387 184 Q451 157 516 169 C607 164 678 202 717 268 Q748 323 741 428 L728 465 L712 429 Q709 371 675 328 C609 332 544 306 498 269 Q470 316 414 341 L431 313 Q380 351 333 363 L310 461 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M284 467 C275 403 280 326 315 270 L302 262 Q336 209 389 199 L387 184 Q451 157 516 169 C607 164 678 202 717 268 Q748 323 741 428 L728 465 L712 429 Q709 371 675 328 C609 332 544 306 498 269 Q470 316 414 341 L431 313 Q380 351 333 363 L310 461 Z" />
    </clipPath>` } },
  },
  {
    id: "buzz",
    label: "Çok kısa",
    straight: { back: ``, front: `<path d="M288 451 C274 359 293 276 345 230 C388 193 448 180 512 181 C576 180 636 193 679 230 C731 276 750 359 736 451 L719 454 C719 371 698 300 651 267 C612 239 562 230 512 231 C462 230 412 239 373 267 C326 300 305 371 305 454 Z" fill="{hairBuzz}" stroke="{hairLine}" stroke-width="5" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M288 451 C274 359 293 276 345 230 C388 193 448 180 512 181 C576 180 636 193 679 230 C731 276 750 359 736 451 L719 454 C719 371 698 300 651 267 C612 239 562 230 512 231 C462 230 412 239 373 267 C326 300 305 371 305 454 Z" />
    </clipPath>` } },
    bukle: { back: ``, front: `<path d="M288 451 C274 359 293 276 345 230 C388 193 448 180 512 181 C576 180 636 193 679 230 C731 276 750 359 736 451 L719 454 C719 371 698 300 651 267 C612 239 562 230 512 231 C462 230 412 239 373 267 C326 300 305 371 305 454 Z" fill="{hairBuzz}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl0})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.39)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.4472)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.4576)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.4212)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.4472)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.4576)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.4212)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.3536)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M288 451 C274 359 293 276 345 230 C388 193 448 180 512 181 C576 180 636 193 679 230 C731 276 750 359 736 451 L719 454 C719 371 698 300 651 267 C612 239 562 230 512 231 C462 230 412 239 373 267 C326 300 305 371 305 454 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M288 451 C274 359 293 276 345 230 C388 193 448 180 512 181 C576 180 636 193 679 230 C731 276 750 359 736 451 L719 454 C719 371 698 300 651 267 C612 239 562 230 512 231 C462 230 412 239 373 267 C326 300 305 371 305 454 Z" />
    </clipPath>` } },
  },
  {
    id: "curtain",
    label: "Perdeli",
    straight: { back: `<path d="M284 454 C269 353 284 267 336 214 C378 171 447 156 512 159 C577 156 646 171 688 214 C740 267 755 353 740 454 C744 546 760 617 790 663 L754 653 Q763 714 789 762 L752 744 L766 804 Q729 791 706 759 L709 791 Q677 773 658 738 L366 738 Q347 773 315 791 L318 759 Q295 791 258 804 L272 744 L235 762 Q261 714 270 653 L234 663 C264 617 280 546 284 454 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M304 391 C294 502 317 633 292 705" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 655 337 705" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M304 391 C294 502 317 633 292 705" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 655 337 705" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>`, front: `<path d="M282 471 C268 381 280 287 327 234 C372 183 443 167 512 174 C581 167 652 183 697 234 C744 287 756 381 742 471 L714 493 C717 414 691 343 657 304 C627 270 590 245 528 227 C543 282 573 320 609 348 C581 339 550 317 512 270 C474 317 443 339 415 348 C451 320 481 282 496 227 C434 245 397 270 367 304 C333 343 307 414 310 493 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M464 205 C388 225 328 285 307 367" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M482 225 Q451 288 411 315" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M560 203 C642 221 697 285 720 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M546 226 Q577 287 617 311" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 471 C268 381 280 287 327 234 C372 183 443 167 512 174 C581 167 652 183 697 234 C744 287 756 381 742 471 L714 493 C717 414 691 343 657 304 C627 270 590 245 528 227 C543 282 573 320 609 348 C581 339 550 317 512 270 C474 317 443 339 415 348 C451 320 481 282 496 227 C434 245 397 270 367 304 C333 343 307 414 310 493 Z" />
    </clipPath>` } },
    bukle: { back: `<path d="M284 454 C269 353 284 267 336 214 C378 171 447 156 512 159 C577 156 646 171 688 214 C740 267 755 353 740 454 C744 546 760 617 790 663 L754 653 Q763 714 789 762 L752 744 L766 804 Q729 791 706 759 L709 791 Q677 773 658 738 L366 738 Q347 773 315 791 L318 759 Q295 791 258 804 L272 744 L235 762 Q261 714 270 653 L234 663 C264 617 280 546 284 454 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      </g>
    <g transform="translate(1024 0) scale(-1 1)">
      </g>
    <g clip-path="url(#{curl0})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </g>
    <g transform="translate(0 0)">
      <g transform="translate(263 437) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 548) rotate(-7) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(263 656) rotate(9) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <g transform="translate(263 437) rotate(9) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 548) rotate(-7) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(263 656) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M282 471 C268 381 280 287 327 234 C372 183 443 167 512 174 C581 167 652 183 697 234 C744 287 756 381 742 471 L714 493 C717 414 691 343 657 304 C627 270 590 245 528 227 C543 282 573 320 609 348 C581 339 550 317 512 270 C474 317 443 339 415 348 C451 320 481 282 496 227 C434 245 397 270 367 304 C333 343 307 414 310 493 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl2})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 471 C268 381 280 287 327 234 C372 183 443 167 512 174 C581 167 652 183 697 234 C744 287 756 381 742 471 L714 493 C717 414 691 343 657 304 C627 270 590 245 528 227 C543 282 573 320 609 348 C581 339 550 317 512 270 C474 317 443 339 415 348 C451 320 481 282 496 227 C434 245 397 270 367 304 C333 343 307 414 310 493 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M284 454 C269 353 284 267 336 214 C378 171 447 156 512 159 C577 156 646 171 688 214 C740 267 755 353 740 454 C744 546 760 617 790 663 L754 653 Q763 714 789 762 L752 744 L766 804 Q729 791 706 759 L709 791 Q677 773 658 738 L366 738 Q347 773 315 791 L318 759 Q295 791 258 804 L272 744 L235 762 Q261 714 270 653 L234 663 C264 617 280 546 284 454 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl2": `<clipPath id="{curl2}">
      <path d="M282 471 C268 381 280 287 327 234 C372 183 443 167 512 174 C581 167 652 183 697 234 C744 287 756 381 742 471 L714 493 C717 414 691 343 657 304 C627 270 590 245 528 227 C543 282 573 320 609 348 C581 339 550 317 512 270 C474 317 443 339 415 348 C451 320 481 282 496 227 C434 245 397 270 367 304 C333 343 307 414 310 493 Z" />
    </clipPath>` } },
  },
  {
    id: "bob",
    label: "Küt kâküllü",
    straight: { back: `<path d="M294 467 C265 382 277 277 330 219 C376 172 447 154 512 157 C577 154 648 172 694 219 C747 277 759 382 730 467 L754 648 Q758 676 731 686 Q689 700 656 681 L368 681 Q335 700 293 686 Q266 676 270 648 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M304 391 C294 502 317 579 292 651" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 601 337 651" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M304 391 C294 502 317 579 292 651" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 601 337 651" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>`, front: `<path d="M282 469 C270 377 281 284 329 230 C374 181 444 167 512 170 C595 165 669 192 708 248 C745 301 750 386 742 469 L716 446 C717 392 700 345 677 318 C661 349 637 365 615 374 C630 349 635 321 633 296 C615 335 586 361 556 370 C567 343 568 316 562 291 C549 333 529 359 506 371 C510 342 505 316 496 296 C478 336 452 359 426 368 C438 340 440 312 437 291 C412 333 386 357 357 368 C369 342 372 321 369 304 C334 341 310 394 309 449 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M391 225 Q329 276 306 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M446 210 Q391 259 382 318" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M493 204 Q451 257 452 319" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M535 205 Q522 262 525 321" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M576 210 Q591 262 581 320" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M620 224 Q659 260 659 304" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M660 243 Q712 296 720 368" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 469 C270 377 281 284 329 230 C374 181 444 167 512 170 C595 165 669 192 708 248 C745 301 750 386 742 469 L716 446 C717 392 700 345 677 318 C661 349 637 365 615 374 C630 349 635 321 633 296 C615 335 586 361 556 370 C567 343 568 316 562 291 C549 333 529 359 506 371 C510 342 505 316 496 296 C478 336 452 359 426 368 C438 340 440 312 437 291 C412 333 386 357 357 368 C369 342 372 321 369 304 C334 341 310 394 309 449 Z" />
    </clipPath>` } },
    bukle: { back: `<path d="M294 467 C265 382 277 277 330 219 C376 172 447 154 512 157 C577 154 648 172 694 219 C747 277 759 382 730 467 L754 648 Q758 676 731 686 Q689 700 656 681 L368 681 Q335 700 293 686 Q266 676 270 648 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      </g>
    <g transform="translate(1024 0) scale(-1 1)">
      </g>
    <g clip-path="url(#{curl0})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </g>
    <g transform="translate(0 0)">
      <g transform="translate(263 432) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 528) rotate(-7) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <g transform="translate(263 432) rotate(9) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 528) rotate(-7) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M282 469 C270 377 281 284 329 230 C374 181 444 167 512 170 C595 165 669 192 708 248 C745 301 750 386 742 469 L716 446 C717 392 700 345 677 318 C661 349 637 365 615 374 C630 349 635 321 633 296 C615 335 586 361 556 370 C567 343 568 316 562 291 C549 333 529 359 506 371 C510 342 505 316 496 296 C478 336 452 359 426 368 C438 340 440 312 437 291 C412 333 386 357 357 368 C369 342 372 321 369 304 C334 341 310 394 309 449 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl2})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(327 257) rotate(-13) scale(0.68 0.81)">
      <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(391 237) rotate(-7) scale(0.74 0.89)">
      <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(463 228) rotate(4) scale(0.76 0.91)">
      <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(538 229) rotate(6) scale(0.77 0.85)">
      <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(610 252) rotate(16) scale(0.72 0.82)">
      <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 469 C270 377 281 284 329 230 C374 181 444 167 512 170 C595 165 669 192 708 248 C745 301 750 386 742 469 L716 446 C717 392 700 345 677 318 C661 349 637 365 615 374 C630 349 635 321 633 296 C615 335 586 361 556 370 C567 343 568 316 562 291 C549 333 529 359 506 371 C510 342 505 316 496 296 C478 336 452 359 426 368 C438 340 440 312 437 291 C412 333 386 357 357 368 C369 342 372 321 369 304 C334 341 310 394 309 449 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M294 467 C265 382 277 277 330 219 C376 172 447 154 512 157 C577 154 648 172 694 219 C747 277 759 382 730 467 L754 648 Q758 676 731 686 Q689 700 656 681 L368 681 Q335 700 293 686 Q266 676 270 648 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl2": `<clipPath id="{curl2}">
      <path d="M282 469 C270 377 281 284 329 230 C374 181 444 167 512 170 C595 165 669 192 708 248 C745 301 750 386 742 469 L716 446 C717 392 700 345 677 318 C661 349 637 365 615 374 C630 349 635 321 633 296 C615 335 586 361 556 370 C567 343 568 316 562 291 C549 333 529 359 506 371 C510 342 505 316 496 296 C478 336 452 359 426 368 C438 340 440 312 437 291 C412 333 386 357 357 368 C369 342 372 321 369 304 C334 341 310 394 309 449 Z" />
    </clipPath>` } },
  },
  {
    id: "wolf",
    label: "Katlı",
    straight: { back: `<path d="M284 454 C269 353 284 267 336 214 C378 171 447 156 512 159 C577 156 646 171 688 214 C740 267 755 353 740 454 C744 546 760 617 790 663 L754 653 Q763 714 789 762 L752 744 L766 804 Q729 791 706 759 L709 791 Q677 773 658 738 L366 738 Q347 773 315 791 L318 759 Q295 791 258 804 L272 744 L235 762 Q261 714 270 653 L234 663 C264 617 280 546 284 454 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M304 391 C294 502 317 633 292 705" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 655 337 705" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M304 391 C294 502 317 633 292 705" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 655 337 705" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>`, front: `<path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M464 205 C388 225 328 285 307 367" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M482 225 Q451 288 411 315" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M560 203 C642 221 697 285 720 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M546 226 Q577 287 617 311" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" />
    </clipPath>` } },
    bukle: { back: `<path d="M284 454 C269 353 284 267 336 214 C378 171 447 156 512 159 C577 156 646 171 688 214 C740 267 755 353 740 454 C744 546 760 617 790 663 L754 653 Q763 714 789 762 L752 744 L766 804 Q729 791 706 759 L709 791 Q677 773 658 738 L366 738 Q347 773 315 791 L318 759 Q295 791 258 804 L272 744 L235 762 Q261 714 270 653 L234 663 C264 617 280 546 284 454 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      </g>
    <g transform="translate(1024 0) scale(-1 1)">
      </g>
    <g clip-path="url(#{curl0})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </g>
    <g transform="translate(0 0)">
      <g transform="translate(263 437) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 548) rotate(-7) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(263 656) rotate(9) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <g transform="translate(263 437) rotate(9) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 548) rotate(-7) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(263 656) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl2})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(327 257) rotate(-13) scale(0.68 0.81)">
      <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(391 237) rotate(-7) scale(0.74 0.89)">
      <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(463 228) rotate(4) scale(0.76 0.91)">
      <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(538 229) rotate(6) scale(0.77 0.85)">
      <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(610 252) rotate(16) scale(0.72 0.82)">
      <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M284 454 C269 353 284 267 336 214 C378 171 447 156 512 159 C577 156 646 171 688 214 C740 267 755 353 740 454 C744 546 760 617 790 663 L754 653 Q763 714 789 762 L752 744 L766 804 Q729 791 706 759 L709 791 Q677 773 658 738 L366 738 Q347 773 315 791 L318 759 Q295 791 258 804 L272 744 L235 762 Q261 714 270 653 L234 663 C264 617 280 546 284 454 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl2": `<clipPath id="{curl2}">
      <path d="M284 469 C273 405 279 326 310 272 L291 271 L332 230 L319 215 L373 203 L365 187 L429 187 L447 160 L476 176 L517 151 L547 175 L596 163 L609 187 L655 192 L649 210 C710 235 746 313 744 387 L741 469 L716 458 C719 403 702 356 678 322 L659 370 C646 329 623 295 597 276 C610 318 608 355 595 382 C580 333 558 297 535 277 C541 319 529 356 508 385 C510 337 496 304 476 281 C461 320 435 351 407 367 C425 330 429 303 425 282 C375 309 338 345 321 393 L310 461 Z" />
    </clipPath>` } },
  },
  {
    id: "long",
    label: "Uzun",
    straight: { back: `<path d="M290 449 C266 360 280 263 337 208 C382 165 446 151 512 153 C578 151 642 165 687 208 C744 263 758 360 734 449 C734 604 749 782 774 914 Q733 951 687 928 Q653 953 617 930 L407 930 Q371 953 337 928 Q291 951 250 914 C275 782 290 604 290 449 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M304 391 C294 502 317 819 292 891" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 841 337 891" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M304 391 C294 502 317 819 292 891" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 841 337 891" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>`, front: `<path d="M282 471 C268 381 280 287 327 234 C372 183 443 167 512 174 C581 167 652 183 697 234 C744 287 756 381 742 471 L714 493 C717 414 691 343 657 304 C627 270 590 245 528 227 C543 282 573 320 609 348 C581 339 550 317 512 270 C474 317 443 339 415 348 C451 320 481 282 496 227 C434 245 397 270 367 304 C333 343 307 414 310 493 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M464 205 C388 225 328 285 307 367" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M482 225 Q451 288 411 315" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M560 203 C642 221 697 285 720 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M546 226 Q577 287 617 311" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 471 C268 381 280 287 327 234 C372 183 443 167 512 174 C581 167 652 183 697 234 C744 287 756 381 742 471 L714 493 C717 414 691 343 657 304 C627 270 590 245 528 227 C543 282 573 320 609 348 C581 339 550 317 512 270 C474 317 443 339 415 348 C451 320 481 282 496 227 C434 245 397 270 367 304 C333 343 307 414 310 493 Z" />
    </clipPath>` } },
    bukle: { back: `<path d="M290 449 C266 360 280 263 337 208 C382 165 446 151 512 153 C578 151 642 165 687 208 C744 263 758 360 734 449 C734 604 749 782 774 914 Q733 951 687 928 Q653 953 617 930 L407 930 Q371 953 337 928 Q291 951 250 914 C275 782 290 604 290 449 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      </g>
    <g transform="translate(1024 0) scale(-1 1)">
      </g>
    <g clip-path="url(#{curl0})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </g>
    <g transform="translate(0 0)">
      <g transform="translate(263 432) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 557) rotate(-7) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(263 683) rotate(9) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 794) rotate(-7) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <g transform="translate(263 432) rotate(9) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 557) rotate(-7) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(263 683) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 794) rotate(-7) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M282 471 C268 381 280 287 327 234 C372 183 443 167 512 174 C581 167 652 183 697 234 C744 287 756 381 742 471 L714 493 C717 414 691 343 657 304 C627 270 590 245 528 227 C543 282 573 320 609 348 C581 339 550 317 512 270 C474 317 443 339 415 348 C451 320 481 282 496 227 C434 245 397 270 367 304 C333 343 307 414 310 493 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl2})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 471 C268 381 280 287 327 234 C372 183 443 167 512 174 C581 167 652 183 697 234 C744 287 756 381 742 471 L714 493 C717 414 691 343 657 304 C627 270 590 245 528 227 C543 282 573 320 609 348 C581 339 550 317 512 270 C474 317 443 339 415 348 C451 320 481 282 496 227 C434 245 397 270 367 304 C333 343 307 414 310 493 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M290 449 C266 360 280 263 337 208 C382 165 446 151 512 153 C578 151 642 165 687 208 C744 263 758 360 734 449 C734 604 749 782 774 914 Q733 951 687 928 Q653 953 617 930 L407 930 Q371 953 337 928 Q291 951 250 914 C275 782 290 604 290 449 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl2": `<clipPath id="{curl2}">
      <path d="M282 471 C268 381 280 287 327 234 C372 183 443 167 512 174 C581 167 652 183 697 234 C744 287 756 381 742 471 L714 493 C717 414 691 343 657 304 C627 270 590 245 528 227 C543 282 573 320 609 348 C581 339 550 317 512 270 C474 317 443 339 415 348 C451 320 481 282 496 227 C434 245 397 270 367 304 C333 343 307 414 310 493 Z" />
    </clipPath>` } },
  },
  {
    id: "longBangs",
    label: "Uzun kâküllü",
    straight: { back: `<path d="M290 449 C266 360 280 263 337 208 C382 165 446 151 512 153 C578 151 642 165 687 208 C744 263 758 360 734 449 C734 604 749 782 774 914 Q733 951 687 928 Q653 953 617 930 L407 930 Q371 953 337 928 Q291 951 250 914 C275 782 290 604 290 449 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M304 391 C294 502 317 819 292 891" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 841 337 891" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M304 391 C294 502 317 819 292 891" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 841 337 891" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>`, front: `<path d="M282 469 C270 377 281 284 329 230 C374 181 444 167 512 170 C595 165 669 192 708 248 C745 301 750 386 742 469 L716 446 C717 392 700 345 677 318 C661 349 637 365 615 374 C630 349 635 321 633 296 C615 335 586 361 556 370 C567 343 568 316 562 291 C549 333 529 359 506 371 C510 342 505 316 496 296 C478 336 452 359 426 368 C438 340 440 312 437 291 C412 333 386 357 357 368 C369 342 372 321 369 304 C334 341 310 394 309 449 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M391 225 Q329 276 306 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M446 210 Q391 259 382 318" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M493 204 Q451 257 452 319" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M535 205 Q522 262 525 321" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M576 210 Q591 262 581 320" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M620 224 Q659 260 659 304" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M660 243 Q712 296 720 368" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 469 C270 377 281 284 329 230 C374 181 444 167 512 170 C595 165 669 192 708 248 C745 301 750 386 742 469 L716 446 C717 392 700 345 677 318 C661 349 637 365 615 374 C630 349 635 321 633 296 C615 335 586 361 556 370 C567 343 568 316 562 291 C549 333 529 359 506 371 C510 342 505 316 496 296 C478 336 452 359 426 368 C438 340 440 312 437 291 C412 333 386 357 357 368 C369 342 372 321 369 304 C334 341 310 394 309 449 Z" />
    </clipPath>` } },
    bukle: { back: `<path d="M290 449 C266 360 280 263 337 208 C382 165 446 151 512 153 C578 151 642 165 687 208 C744 263 758 360 734 449 C734 604 749 782 774 914 Q733 951 687 928 Q653 953 617 930 L407 930 Q371 953 337 928 Q291 951 250 914 C275 782 290 604 290 449 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      </g>
    <g transform="translate(1024 0) scale(-1 1)">
      </g>
    <g clip-path="url(#{curl0})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </g>
    <g transform="translate(0 0)">
      <g transform="translate(263 432) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 557) rotate(-7) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(263 683) rotate(9) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 794) rotate(-7) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <g transform="translate(263 432) rotate(9) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 557) rotate(-7) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(263 683) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 794) rotate(-7) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M282 469 C270 377 281 284 329 230 C374 181 444 167 512 170 C595 165 669 192 708 248 C745 301 750 386 742 469 L716 446 C717 392 700 345 677 318 C661 349 637 365 615 374 C630 349 635 321 633 296 C615 335 586 361 556 370 C567 343 568 316 562 291 C549 333 529 359 506 371 C510 342 505 316 496 296 C478 336 452 359 426 368 C438 340 440 312 437 291 C412 333 386 357 357 368 C369 342 372 321 369 304 C334 341 310 394 309 449 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl2})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(327 257) rotate(-13) scale(0.68 0.81)">
      <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(391 237) rotate(-7) scale(0.74 0.89)">
      <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(463 228) rotate(4) scale(0.76 0.91)">
      <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(538 229) rotate(6) scale(0.77 0.85)">
      <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g transform="translate(610 252) rotate(16) scale(0.72 0.82)">
      <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 469 C270 377 281 284 329 230 C374 181 444 167 512 170 C595 165 669 192 708 248 C745 301 750 386 742 469 L716 446 C717 392 700 345 677 318 C661 349 637 365 615 374 C630 349 635 321 633 296 C615 335 586 361 556 370 C567 343 568 316 562 291 C549 333 529 359 506 371 C510 342 505 316 496 296 C478 336 452 359 426 368 C438 340 440 312 437 291 C412 333 386 357 357 368 C369 342 372 321 369 304 C334 341 310 394 309 449 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M290 449 C266 360 280 263 337 208 C382 165 446 151 512 153 C578 151 642 165 687 208 C744 263 758 360 734 449 C734 604 749 782 774 914 Q733 951 687 928 Q653 953 617 930 L407 930 Q371 953 337 928 Q291 951 250 914 C275 782 290 604 290 449 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl2": `<clipPath id="{curl2}">
      <path d="M282 469 C270 377 281 284 329 230 C374 181 444 167 512 170 C595 165 669 192 708 248 C745 301 750 386 742 469 L716 446 C717 392 700 345 677 318 C661 349 637 365 615 374 C630 349 635 321 633 296 C615 335 586 361 556 370 C567 343 568 316 562 291 C549 333 529 359 506 371 C510 342 505 316 496 296 C478 336 452 359 426 368 C438 340 440 312 437 291 C412 333 386 357 357 368 C369 342 372 321 369 304 C334 341 310 394 309 449 Z" />
    </clipPath>` } },
  },
  {
    id: "ponytail",
    label: "At kuyruğu",
    straight: { back: `<path d="M686 262 C770 199 832 264 847 349 C865 452 834 563 867 676 C824 653 797 603 790 542 C775 598 788 662 808 702 C734 644 733 546 747 445 C760 354 746 300 697 304 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <path d="M764 288 C814 370 779 483 818 588" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />`, front: `<path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M464 205 C388 225 328 285 307 367" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M482 225 Q451 288 411 315" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M560 203 C642 221 697 285 720 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M546 226 Q577 287 617 311" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>` } },
    bukle: { back: `<path d="M686 262 C770 199 832 264 847 349 C865 452 834 563 867 676 C824 653 797 603 790 542 C775 598 788 662 808 702 C734 644 733 546 747 445 C760 354 746 300 697 304 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g clip-path="url(#{curl0})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(698 244.8279883381924) rotate(-15) scale(0.63 0.7)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(756 244.8279883381924) rotate(0) scale(0.63 0.7)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(814 244.8279883381924) rotate(15) scale(0.63 0.7)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(765 300) rotate(13) scale(0.8 1.05)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(765 404) rotate(-8) scale(0.8 1.05)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(765 508) rotate(13) scale(0.8 1.05)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(765 612) rotate(-8) scale(0.8 1.05)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl2})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M686 262 C770 199 832 264 847 349 C865 452 834 563 867 676 C824 653 797 603 790 542 C775 598 788 662 808 702 C734 644 733 546 747 445 C760 354 746 300 697 304 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl2": `<clipPath id="{curl2}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>` } },
  },
  {
    id: "bun",
    label: "Topuz",
    straight: { back: `<path d="M441 216 C401 191 412 125 447 104 C473 71 540 70 569 100 C613 112 621 179 585 210 Q512 244 441 216 Z" fill="{hair}" stroke="{hairLine}" stroke-width="6" />
    <path d="M454 191 C440 141 485 108 531 119 C568 127 579 157 564 187" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />`, front: `<path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M464 205 C388 225 328 285 307 367" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M482 225 Q451 288 411 315" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M560 203 C642 221 697 285 720 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M546 226 Q577 287 617 311" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>` } },
    bukle: { back: `<path d="M441 216 C401 191 412 125 447 104 C473 71 540 70 569 100 C613 112 621 179 585 210 Q512 244 441 216 Z" fill="{hair}" stroke="{hairLine}" stroke-width="6" />
    <g clip-path="url(#{curl0})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(427 86.35496296296296) rotate(-15) scale(0.63 0.7)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(485 86.35496296296296) rotate(0) scale(0.63 0.7)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(543 86.35496296296296) rotate(15) scale(0.63 0.7)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl2})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M441 216 C401 191 412 125 447 104 C473 71 540 70 569 100 C613 112 621 179 585 210 Q512 244 441 216 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl2": `<clipPath id="{curl2}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>` } },
  },
  {
    id: "spaceBuns",
    label: "İki topuz",
    straight: { back: `<path d="M267 216 C227 191 238 125 273 104 C299 71 366 70 395 100 C439 112 447 179 411 210 Q338 244 267 216 Z" fill="{hair}" stroke="{hairLine}" stroke-width="6" />
    <path d="M280 191 C266 141 311 108 357 119 C394 127 405 157 390 187" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
    <path d="M615 216 C575 191 586 125 621 104 C647 71 714 70 743 100 C787 112 795 179 759 210 Q686 244 615 216 Z" fill="{hair}" stroke="{hairLine}" stroke-width="6" />
    <path d="M628 191 C614 141 659 108 705 119 C742 127 753 157 738 187" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />`, front: `<path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M464 205 C388 225 328 285 307 367" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M482 225 Q451 288 411 315" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M560 203 C642 221 697 285 720 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M546 226 Q577 287 617 311" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>` } },
    bukle: { back: `<path d="M267 216 C227 191 238 125 273 104 C299 71 366 70 395 100 C439 112 447 179 411 210 Q338 244 267 216 Z" fill="{hair}" stroke="{hairLine}" stroke-width="6" />
    <path d="M615 216 C575 191 586 125 621 104 C647 71 714 70 743 100 C787 112 795 179 759 210 Q686 244 615 216 Z" fill="{hair}" stroke="{hairLine}" stroke-width="6" />
    <g clip-path="url(#{curl0})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(253 86.35496296296296) rotate(-15) scale(0.63 0.7)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(311 86.35496296296296) rotate(0) scale(0.63 0.7)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(369 86.35496296296296) rotate(15) scale(0.63 0.7)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl1})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(601 86.35496296296296) rotate(-15) scale(0.63 0.7)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(659 86.35496296296296) rotate(0) scale(0.63 0.7)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(717 86.35496296296296) rotate(15) scale(0.63 0.7)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl2})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl3})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M267 216 C227 191 238 125 273 104 C299 71 366 70 395 100 C439 112 447 179 411 210 Q338 244 267 216 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M615 216 C575 191 586 125 621 104 C647 71 714 70 743 100 C787 112 795 179 759 210 Q686 244 615 216 Z" />
    </clipPath>`, "curl2": `<clipPath id="{curl2}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl3": `<clipPath id="{curl3}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>` } },
  },
  {
    id: "braids",
    label: "Örgü",
    straight: { back: `<g transform="translate(0 0)">
      <path d="M292 394 C265 426 261 478 280 516 L309 518 C322 471 322 429 310 403 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
      <path d="M291 492 C262.0 480 255.0 509 291 530 C327.0 509 320.0 480 291 492 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M266.0 499 Q291 505 315.0 519" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 526 C263.65 514 256.65 543 291 564 C325.35 543 318.35 514 291 526 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M267.65 533 Q291 539 313.35 553" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 560 C265.3 548 258.3 577 291 598 C323.7 577 316.7 548 291 560 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M269.3 567 Q291 573 311.7 587" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 594 C266.95 582 259.95 611 291 632 C322.05 611 315.05 582 291 594 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M270.95 601 Q291 607 310.05 621" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 628 C268.6 616 261.6 645 291 666 C320.4 645 313.4 616 291 628 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M272.6 635 Q291 641 308.4 655" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 662 C270.25 650 263.25 679 291 700 C318.75 679 311.75 650 291 662 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M274.25 669 Q291 675 306.75 689" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 696 C271.9 684 264.9 713 291 734 C317.1 713 310.1 684 291 696 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M275.9 703 Q291 709 305.1 723" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 730 C273.55 718 266.55 747 291 768 C315.45 747 308.45 718 291 730 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M277.55 737 Q291 743 303.45 757" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 764 C275.2 752 268.2 781 291 802 C313.8 781 306.8 752 291 764 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M279.2 771 Q291 777 301.8 791" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M280 819 Q292 846 304 819 L298 852 L286 861 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M292 394 C265 426 261 478 280 516 L309 518 C322 471 322 429 310 403 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
      <path d="M291 492 C262.0 480 255.0 509 291 530 C327.0 509 320.0 480 291 492 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M266.0 499 Q291 505 315.0 519" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 526 C263.65 514 256.65 543 291 564 C325.35 543 318.35 514 291 526 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M267.65 533 Q291 539 313.35 553" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 560 C265.3 548 258.3 577 291 598 C323.7 577 316.7 548 291 560 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M269.3 567 Q291 573 311.7 587" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 594 C266.95 582 259.95 611 291 632 C322.05 611 315.05 582 291 594 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M270.95 601 Q291 607 310.05 621" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 628 C268.6 616 261.6 645 291 666 C320.4 645 313.4 616 291 628 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M272.6 635 Q291 641 308.4 655" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 662 C270.25 650 263.25 679 291 700 C318.75 679 311.75 650 291 662 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M274.25 669 Q291 675 306.75 689" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 696 C271.9 684 264.9 713 291 734 C317.1 713 310.1 684 291 696 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M275.9 703 Q291 709 305.1 723" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 730 C273.55 718 266.55 747 291 768 C315.45 747 308.45 718 291 730 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M277.55 737 Q291 743 303.45 757" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M291 764 C275.2 752 268.2 781 291 802 C313.8 781 306.8 752 291 764 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M279.2 771 Q291 777 301.8 791" fill="none" stroke="{hairStrand}" stroke-width="2" opacity="0.6" />
      <path d="M280 819 Q292 846 304 819 L298 852 L286 861 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3" />
    </g>`, front: `<path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M464 205 C388 225 328 285 307 367" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M482 225 Q451 288 411 315" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M560 203 C642 221 697 285 720 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M546 226 Q577 287 617 311" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>` } },
    bukle: { back: `<g transform="translate(0 0)">
      <path d="M292 394 C265 426 261 478 280 516 L309 518 C322 471 322 429 310 403 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
      <path d="M291 492 C262.0 480 255.0 509 291 530 C327.0 509 320.0 480 291 492 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 526 C263.65 514 256.65 543 291 564 C325.35 543 318.35 514 291 526 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 560 C265.3 548 258.3 577 291 598 C323.7 577 316.7 548 291 560 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 594 C266.95 582 259.95 611 291 632 C322.05 611 315.05 582 291 594 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 628 C268.6 616 261.6 645 291 666 C320.4 645 313.4 616 291 628 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 662 C270.25 650 263.25 679 291 700 C318.75 679 311.75 650 291 662 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 696 C271.9 684 264.9 713 291 734 C317.1 713 310.1 684 291 696 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 730 C273.55 718 266.55 747 291 768 C315.45 747 308.45 718 291 730 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 764 C275.2 752 268.2 781 291 802 C313.8 781 306.8 752 291 764 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M280 819 Q292 846 304 819 L298 852 L286 861 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M292 394 C265 426 261 478 280 516 L309 518 C322 471 322 429 310 403 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
      <path d="M291 492 C262.0 480 255.0 509 291 530 C327.0 509 320.0 480 291 492 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 526 C263.65 514 256.65 543 291 564 C325.35 543 318.35 514 291 526 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 560 C265.3 548 258.3 577 291 598 C323.7 577 316.7 548 291 560 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 594 C266.95 582 259.95 611 291 632 C322.05 611 315.05 582 291 594 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 628 C268.6 616 261.6 645 291 666 C320.4 645 313.4 616 291 628 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 662 C270.25 650 263.25 679 291 700 C318.75 679 311.75 650 291 662 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 696 C271.9 684 264.9 713 291 734 C317.1 713 310.1 684 291 696 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 730 C273.55 718 266.55 747 291 768 C315.45 747 308.45 718 291 730 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M291 764 C275.2 752 268.2 781 291 802 C313.8 781 306.8 752 291 764 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3.5" />
      <path d="M280 819 Q292 846 304 819 L298 852 L286 861 Z" fill="{hair}" stroke="{hairLine}" stroke-width="3" />
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl0})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M282 480 C272 411 278 303 321 243 C359 188 433 169 512 170 C591 169 665 188 703 243 C746 303 752 411 742 480 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>` } },
  },
  {
    id: "straight01",
    label: "Düz 01",
    straight: { back: `<path d="M290 449 C266 360 280 263 337 208 C382 165 446 151 512 153 C578 151 642 165 687 208 C744 263 758 360 734 449 C734 604 749 782 774 914 Q733 951 687 928 Q653 953 617 930 L407 930 Q371 953 337 928 Q291 951 250 914 C275 782 290 604 290 449 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M304 391 C294 502 317 819 292 891" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 841 337 891" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M304 391 C294 502 317 819 292 891" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" />
      <path d="M328 485 Q321 841 337 891" fill="none" stroke="{hairStrand}" stroke-width="2.5" opacity="0.6" />
    </g>`, front: `<path d="M280 478 C268 380 280 282 331 229 C377 180 446 166 512 169 C590 166 663 191 705 246 C746 301 751 389 744 478 L720 500 C720 393 696 307 656 272 C612 238 558 222 505 223 C476 266 411 320 337 347 C318 389 308 441 307 500 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <path d="M464 205 C388 225 328 285 307 367" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M482 225 Q451 288 411 315" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M560 203 C642 221 697 285 720 366" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />
    <path d="M546 226 Q577 287 617 311" fill="none" stroke="{hairStrand}" stroke-width="3" opacity="0.6" clip-path="url(#{surface})" />`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M280 478 C268 380 280 282 331 229 C377 180 446 166 512 169 C590 166 663 191 705 246 C746 301 751 389 744 478 L720 500 C720 393 696 307 656 272 C612 238 558 222 505 223 C476 266 411 320 337 347 C318 389 308 441 307 500 Z" />
    </clipPath>` } },
    bukle: { back: `<path d="M290 449 C266 360 280 263 337 208 C382 165 446 151 512 153 C578 151 642 165 687 208 C744 263 758 360 734 449 C734 604 749 782 774 914 Q733 951 687 928 Q653 953 617 930 L407 930 Q371 953 337 928 Q291 951 250 914 C275 782 290 604 290 449 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="6" />
    <g transform="translate(0 0)">
      </g>
    <g transform="translate(1024 0) scale(-1 1)">
      </g>
    <g clip-path="url(#{curl0})">
      <g transform="translate(0 0)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(1024 0) scale(-1 1)">
        <g transform="translate(266 260) rotate(-12) scale(0.85 1.22)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(286 370) rotate(10) scale(0.75 1.4)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(253 499) rotate(-10) scale(0.95 1.24)">
          <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(290 626) rotate(7) scale(0.82 1.35)">
          <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <g transform="translate(258 759) rotate(-9) scale(0.95 1.2)">
          <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
          <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </g>
    <g transform="translate(0 0)">
      <g transform="translate(263 432) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 557) rotate(-7) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(263 683) rotate(9) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 794) rotate(-7) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <g transform="translate(263 432) rotate(9) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 557) rotate(-7) scale(0.64 0.86)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(263 683) rotate(9) scale(0.64 0.86)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(272 794) rotate(-7) scale(0.64 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, front: `<path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M280 478 C268 380 280 282 331 229 C377 180 446 166 512 169 C590 166 663 191 705 246 C746 301 751 389 744 478 L720 500 C720 393 696 307 656 272 C612 238 558 222 505 223 C476 266 411 320 337 347 C318 389 308 441 307 500 Z" fill="{hair}" stroke="{hairLine}" stroke-width="5" />
    <g clip-path="url(#{curl1})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    <g clip-path="url(#{curl2})">
      <g transform="translate(288 273) rotate(-29) scale(0.75 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(335 217) rotate(-22) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(396 181) rotate(-9) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(460 171) rotate(5) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(524 169) rotate(16) scale(0.86 0.86)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(587 192) rotate(28) scale(0.88 0.88)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(650 231) rotate(37) scale(0.81 0.81)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(696 293) rotate(45) scale(0.68 0.68)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(325 290) rotate(-12) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(398 248) rotate(8) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(490 231) rotate(-6) scale(0.7 0.75)">
        <path d="M18 0 C-7 20 -9 47 11 65 C35 86 62 75 63 99 C64 118 44 132 26 121 C39 148 77 137 83 112 C91 79 64 65 42 54 C23 44 20 29 35 12 Z" fill="{hair}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M20 19 C1 49 29 58 51 70 C84 88 75 120 53 126" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(572 253) rotate(19) scale(0.7 0.75)">
        <path d="M17 0 C42 -9 72 5 76 29 C82 56 49 70 36 85 C18 109 38 132 61 117 C54 143 17 148 5 120 C-6 93 7 76 30 59 C55 41 49 19 25 20 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M36 10 C77 19 54 51 33 69 C5 93 12 125 35 132" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(638 300) rotate(24) scale(0.7 0.75)">
        <path d="M20 0 C-5 21 2 49 23 61 C49 75 78 62 78 85 C79 109 45 112 42 137 C28 119 37 99 53 91 C18 96 -1 80 -5 60 C-11 37 0 11 20 0 Z" fill="{hairBack}" stroke="{hairLine}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <path d="M15 21 C1 54 29 69 54 68 C86 72 64 102 51 110" fill="none" stroke="{hairStrand}" stroke-width="2.3" opacity="0.62" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>`, defs: { "surface": `<clipPath id="{surface}">
      <path d="M280 478 C268 380 280 282 331 229 C377 180 446 166 512 169 C590 166 663 191 705 246 C746 301 751 389 744 478 L720 500 C720 393 696 307 656 272 C612 238 558 222 505 223 C476 266 411 320 337 347 C318 389 308 441 307 500 Z" />
    </clipPath>`, "curl0": `<clipPath id="{curl0}">
      <path d="M290 449 C266 360 280 263 337 208 C382 165 446 151 512 153 C578 151 642 165 687 208 C744 263 758 360 734 449 C734 604 749 782 774 914 Q733 951 687 928 Q653 953 617 930 L407 930 Q371 953 337 928 Q291 951 250 914 C275 782 290 604 290 449 Z" />
    </clipPath>`, "curl1": `<clipPath id="{curl1}">
      <path d="M283 472 C265 451 270 423 274 405 C253 372 263 342 278 327 C263 292 286 259 305 251 C303 217 332 193 359 192 C371 161 407 151 430 163 C454 136 489 137 512 153 C535 137 570 136 594 163 C617 151 653 161 665 192 C692 193 721 217 719 251 C738 259 761 292 746 327 C761 342 771 372 750 405 C754 423 759 451 741 472 L715 456 C718 377 699 311 656 276 C619 246 568 235 512 235 C456 235 405 246 368 276 C325 311 306 377 309 456 Z" />
    </clipPath>`, "curl2": `<clipPath id="{curl2}">
      <path d="M280 478 C268 380 280 282 331 229 C377 180 446 166 512 169 C590 166 663 191 705 246 C746 301 751 389 744 478 L720 500 C720 393 696 307 656 272 C612 238 558 222 505 223 C476 266 411 320 337 347 C318 389 308 441 307 500 Z" />
    </clipPath>` } },
  },
];
