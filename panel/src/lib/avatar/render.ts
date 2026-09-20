/**
 * The team avatar renderer (D-195): configuration in, SVG out.
 *
 * Every chosen part draws itself into one or more named layers
 * (`LAYER_ORDER`). The builder shows the layers stacked as separate SVGs, so
 * changing the hair redraws only the hair; the server joins them into one SVG
 * and turns that into the transparent PNG. One function family does both, so
 * the preview is exactly the file the admin downloads.
 *
 * Nothing typed by a member reaches this code: every value comes from the
 * registry's catalogue or from numbers in `assets/`. There is no background
 * element, so the PNG keeps its alpha.
 */
import { buildPalette, CANVAS, LAYER_ORDER, type DrawContext, type LayerName } from "./canvas";
import { EAR_BASE_X, facePathFor } from "./assets/face";
import type { Asset, ColorOption } from "./assets/types";
import { HAIR_IMAGE_DIR } from "./assets/hair-images";
import { FIELDS, THUMBS, type AvatarConfig, type Field, type FieldKey, type ThumbView } from "./registry";

export { LAYER_ORDER, type LayerName };

function colorOf(key: FieldKey, config: AvatarConfig): string {
  const field: Field = FIELDS[key];
  const options = field.options as readonly ColorOption[];
  return options.find((option) => option.id === config[key])?.hex ?? options[0]!.hex;
}

/** The assets a configuration has chosen, in registry order. */
function chosenAssets(config: AvatarConfig): Asset[] {
  const assets: Asset[] = [];
  for (const key of Object.keys(FIELDS) as FieldKey[]) {
    const field: Field = FIELDS[key];
    if (field.kind === "color") continue;
    const stored = config[key] as string | string[];
    const ids = Array.isArray(stored) ? stored : [stored];
    for (const option of field.options) if (ids.includes(option.id)) assets.push(option);
  }
  return assets;
}

type Prepared = { assets: Asset[]; base: Omit<DrawContext, "id" | "def"> };

/** In the browser the files are served from `public/`; the server inlines them. */
const publicHref = (file: string) => `/${HAIR_IMAGE_DIR}/${file}`;

function prepare(config: AvatarConfig, imageHref: (file: string) => string): Prepared {
  const lip = colorOf("lipColor", config);
  const face = facePathFor(config.face);
  return {
    assets: chosenAssets(config),
    base: {
      palette: buildPalette({
        skin: colorOf("skinTone", config),
        hair: colorOf("hairColor", config),
        eye: colorOf("eyeColor", config),
        lip: lip === "" ? null : lip,
        clothing: colorOf("clothingColor", config),
        glasses: colorOf("glassesColor", config),
        metal: colorOf("jewelryColor", config),
      }),
      face,
      earShift: face.right[4]![0] - EAR_BASE_X,
      texture: config.hairTexture,
      selected: new Set([...config.extras, ...config.piercings]),
      imageHref,
    },
  };
}

function drawLayer(prepared: Prepared, layer: LayerName): { body: string; defs: string } {
  const defs: string[] = [];
  const context: DrawContext = {
    ...prepared.base,
    id: (name) => `${layer}-${name}`,
    def: (markup) => defs.push(markup),
  };
  const body = prepared.assets.map((asset) => asset.layers?.[layer]?.(context) ?? "").join("");
  return { body, defs: defs.join("") };
}

export type RenderOptions = {
  /** Crops the drawing: a raw view box or one of the registry's thumbnail views. */
  viewBox?: string;
  view?: ThumbView;
  /** Output size in pixels; the drawing is resolution independent. */
  size?: number;
  /** Layers to leave out, e.g. the face details on a hair thumbnail. */
  omit?: readonly LayerName[];
  /** Overrides where picture files are loaded from; the server inlines them. */
  imageHref?: (file: string) => string;
};

function openSvg(options: RenderOptions): string {
  const size = options.size ?? CANVAS;
  const viewBox = options.viewBox ?? (options.view ? THUMBS[options.view] : `0 0 ${CANVAS} ${CANVAS}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}">`;
}

const STYLE = `stroke-linecap="round" stroke-linejoin="round"`;

/** The whole avatar as one SVG: the PNG's source and every thumbnail. */
export function renderAvatarSvg(config: AvatarConfig, options: RenderOptions = {}): string {
  const prepared = prepare(config, options.imageHref ?? publicHref);
  const omit = new Set(options.omit ?? []);
  const parts = LAYER_ORDER.filter((layer) => !omit.has(layer)).map((layer) => ({ layer, ...drawLayer(prepared, layer) }));
  return (
    openSvg(options) +
    `<defs>${parts.map((part) => part.defs).join("")}</defs>` +
    `<g ${STYLE}>${parts.map((part) => `<g data-layer="${part.layer}">${part.body}</g>`).join("")}</g>` +
    "</svg>"
  );
}

/**
 * Each layer as its own SVG on the same canvas, for the builder's stacked
 * preview. Empty layers are skipped. Ids are prefixed with the layer name,
 * so the stack can live in one document.
 */
export function renderAvatarLayers(config: AvatarConfig, size = CANVAS): { layer: LayerName; svg: string }[] {
  const prepared = prepare(config, publicHref);
  return LAYER_ORDER.map((layer) => ({ layer, ...drawLayer(prepared, layer) }))
    .filter((part) => part.body !== "")
    .map((part) => ({
      layer: part.layer,
      svg: `${openSvg({ size })}<defs>${part.defs}</defs><g ${STYLE}>${part.body}</g></svg>`,
    }));
}

/** The SVG as a data URI, for an `<img>` (the CSP allows `data:` images). */
export function avatarDataUri(config: AvatarConfig, options: RenderOptions = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderAvatarSvg(config, options))}`;
}

/** The layers a thumbnail of this field leaves out. */
export function thumbOmit(key: FieldKey): readonly LayerName[] | undefined {
  const field: Field = FIELDS[key];
  return field.kind === "asset" && "omit" in field ? field.omit : undefined;
}
