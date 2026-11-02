/**
 * Picture to background (W1, 2026-10-10): the pure part of the wizard. A framed RGBA picture goes through fewer
 * colors (the "keep colors" slider, optional dithering), the palette fit (four colors a tile, at most 8 or 7
 * palettes) and, when asked, the tile budget (near tiles merge until the count fits GB Studio's Color Only limit).
 *
 * (the author, 2026-11-02): the dither pattern is a choice (none, ordered, Floyd-Steinberg) with a strength; tiles can
 * be locked to a palette slot (the fitter gives that slot its own palette, fitted to the locked tiles only); several
 * pictures can share one palette set (`fitPictures`); and the source can be rotated and cropped first (`rotatedSize`,
 * `clampCrop`).
 */
import { CELL, CLEAR, countUniqueTiles, fitPalettes, fitTileBudget, posterize, type FitReport } from "../paint";
import { UNIQUE_TILE_LIMITS } from "../gb/limits";

export type DitherKind = "none" | "ordered" | "floyd";

export interface FitOptions {
  /** Colors to keep before fitting, 4 … 64 (fewer = cleaner tiles, more merging). */
  keep: number;
  /** The dither pattern (true = ordered, as before 2026-11-02; false = none). */
  dither: boolean | DitherKind;
  /** Dither strength, 0 … 100 (100, the default, is the strength the ordered pattern always had). */
  strength?: number;
  /** Palettes allowed: 8, or 7 to keep slot 8 for the UI. */
  max: 7 | 8;
  /** Merge near tiles until the picture fits the tile budget. */
  budget: boolean;
  /** Each tile's locked slot, 1-based (0 free): those tiles wear that slot, its palette fitted to them alone. */
  locks?: Uint8Array;
}

export interface FitResult {
  width: number; height: number;
  /** Each pixel's shade in its tile's palette. */
  pixels: Uint8Array;
  /** Each tile's palette, 1-based (0 none). */
  cells: Uint16Array;
  palettes: string[][];
  /** The palettes' own names (else "<name> 1"…): a batch names its shared palettes once, so each save reuses them. */
  names?: string[];
  /** Unique tiles (flipped copies merged, as in a Color Only scene) before and after the budget step. */
  tilesBefore: number; tiles: number; merged: number;
  limit: number;
  report: FitReport;
}

export const TILE_LIMIT = UNIQUE_TILE_LIMITS.colorOnly;

const ditherKind = (dither: FitOptions["dither"]): DitherKind => dither === true ? "ordered" : dither === false ? "none" : dither;

/** 4 × 4 ordered-dither thresholds, -0.5 … 0.5 (the same pattern as paint.ts's posterize). */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((value) => value / 16 - 0.5);
const rgbDistance = (r: number, g: number, b: number, r2: number, g2: number, b2: number) => 3 * (r - r2) ** 2 + 6 * (g - g2) ** 2 + (b - b2) ** 2;

/**
 * Fewer colors with the chosen dither: the median-cut colors come from posterize (no dither), then each pixel maps to
 * its nearest with an ordered pattern or Floyd-Steinberg error diffusion, scaled by `strength` (0 … 100).
 */
export function reduceColors(rgba: Uint8ClampedArray, width: number, height: number, keep: number, kind: DitherKind, strength = 100): Uint8ClampedArray {
  if (kind === "none" || strength <= 0) return keep < 64 ? posterize(rgba, width, height, keep) : rgba;
  if (kind === "ordered" && strength === 100) return posterize(rgba, width, height, Math.min(keep, 64), true);
  const flat = posterize(rgba, width, height, Math.min(keep, 64));
  const seen = new Set<number>(), palette: number[][] = [];
  for (let p = 0; p < flat.length; p += 4) {
    if (flat[p + 3] < 128) continue;
    const key = (flat[p] << 16) | (flat[p + 1] << 8) | flat[p + 2];
    if (!seen.has(key)) { seen.add(key); palette.push([flat[p], flat[p + 1], flat[p + 2]]); }
  }
  const out = new Uint8ClampedArray(rgba);
  if (palette.length < 2) return flat;
  const nearest = (r: number, g: number, b: number) => {
    let best = 0, bestDistance = Infinity;
    for (let i = 0; i < palette.length; i += 1) { const d = rgbDistance(r, g, b, palette[i][0], palette[i][1], palette[i][2]); if (d < bestDistance) { bestDistance = d; best = i; } }
    return palette[best];
  };
  if (kind === "ordered") {
    const amount = Math.min(48, 160 / Math.sqrt(palette.length)) * strength / 100;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const p = (y * width + x) * 4;
      if (rgba[p + 3] < 128) continue;
      const bias = BAYER4[(y & 3) * 4 + (x & 3)] * amount;
      out.set(nearest(rgba[p] + bias, rgba[p + 1] + bias, rgba[p + 2] + bias), p);
    }
    return out;
  }
  // Floyd-Steinberg: each pixel's error (times the strength) goes 7/16 right, 3/16 down-left, 5/16 down, 1/16 down-right.
  const work = Float32Array.from(rgba), share = strength / 100;
  const spread = (x: number, y: number, e: number[], part: number) => {
    if (x < 0 || x >= width || y >= height) return;
    const q = (y * width + x) * 4;
    if (rgba[q + 3] < 128) return;
    for (let c = 0; c < 3; c += 1) work[q + c] += e[c] * part;
  };
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const p = (y * width + x) * 4;
    if (rgba[p + 3] < 128) continue;
    const pick = nearest(work[p], work[p + 1], work[p + 2]);
    out.set(pick, p);
    const e = [0, 1, 2].map((c) => (work[p + c] - pick[c]) * share);
    spread(x + 1, y, e, 7 / 16); spread(x - 1, y + 1, e, 3 / 16); spread(x, y + 1, e, 5 / 16); spread(x + 1, y + 1, e, 1 / 16);
  }
  return out;
}

/** A copy with every pixel outside the chosen tiles see-through, so the fit leaves them alone. */
function onlyTiles(rgba: Uint8ClampedArray, width: number, height: number, keepTile: (cell: number) => boolean): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba), cw = Math.ceil(width / CELL);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (!keepTile((y >> 3) * cw + (x >> 3))) out[(y * width + x) * 4 + 3] = 0;
  return out;
}

/**
 * The palette fit with locks: each locked slot's palette is fitted to its locked tiles alone (one palette), the free
 * tiles share the slots no lock took (as many as are left of `max`), and empty slots in between repeat the first
 * palette (they only fill the numbering). Without locks it is fitPalettes as it was.
 */
export function fitWithLocks(rgba: Uint8ClampedArray, width: number, height: number, max: number, locks?: Uint8Array): ReturnType<typeof fitPalettes> {
  const used = locks ? [...new Set(locks)].filter((slot) => slot > 0 && slot <= max).sort((a, b) => a - b) : [];
  if (!used.length || !locks) return fitPalettes(rgba, width, height, max);
  const count = Math.ceil(width / CELL) * Math.ceil(height / CELL);
  const cells = new Uint16Array(count), pixels = new Uint8Array(width * height).fill(CLEAR);
  const palettes: string[][] = [];
  const report: FitReport = { overfull: [], before: 0, after: 0, changed: 0 };
  const take = (fit: ReturnType<typeof fitPalettes>, slotOf: (wear: number) => number, mine: (cell: number) => boolean) => {
    const cw = Math.ceil(width / CELL);
    for (let at = 0; at < pixels.length; at += 1) { const cell = ((at / width | 0) >> 3) * cw + ((at % width) >> 3); if (mine(cell)) pixels[at] = fit.pixels[at]; }
    for (let cell = 0; cell < count; cell += 1) if (mine(cell) && fit.cells[cell]) cells[cell] = slotOf(fit.cells[cell]);
    fit.palettes.forEach((colors, index) => { palettes[slotOf(index + 1) - 1] = colors; });
    report.overfull.push(...fit.report.overfull); report.before += fit.report.before; report.after += fit.report.after; report.changed += fit.report.changed;
  };
  for (const slot of used) {
    const mine = (cell: number) => locks[cell] === slot;
    take(fitPalettes(onlyTiles(rgba, width, height, mine), width, height, 1), () => slot, mine);
  }
  const free = Array.from({ length: max }, (_, index) => index + 1).filter((slot) => !used.includes(slot));
  const freeTile = (cell: number) => !used.includes(locks[cell]);
  if (free.length) take(fitPalettes(onlyTiles(rgba, width, height, freeTile), width, height, free.length), (wear) => free[wear - 1], freeTile);
  // A free tile with no slot left (every slot locked): it wears the first locked slot (its shades stay unfitted).
  else for (let cell = 0; cell < count; cell += 1) if (freeTile(cell)) cells[cell] = used[0];
  for (let index = 0; index < palettes.length; index += 1) if (!palettes[index]) palettes[index] = [...(palettes.find(Boolean) ?? ["#FFFFFF", "#AAAAAA", "#555555", "#000000"])];
  report.overfull.sort((a, b) => a - b);
  return { palettes, cells, pixels, report };
}

export function fitPicture(rgba: Uint8ClampedArray, width: number, height: number, options: FitOptions): FitResult {
  const fewer = reduceColors(rgba, width, height, options.keep, ditherKind(options.dither), options.strength ?? 100);
  const fit = fitWithLocks(fewer, width, height, options.max, options.locks);
  return budgeted(fit, width, height, options.budget);
}

function budgeted(fit: ReturnType<typeof fitPalettes>, width: number, height: number, budget: boolean): FitResult {
  const tilesBefore = countUniqueTiles(fit.pixels, width, height, true);
  let pixels = fit.pixels, tiles = tilesBefore, merged = 0;
  if (budget && tilesBefore > TILE_LIMIT) {
    const under = fitTileBudget(fit.pixels, width, height, true, TILE_LIMIT);
    pixels = under.pixels; tiles = under.tiles; merged = under.merged;
  }
  return { width, height, pixels, cells: fit.cells, palettes: fit.palettes, tilesBefore, tiles, merged, limit: TILE_LIMIT, report: fit.report };
}

/**
 * Batch (the author, 2026-11-02): several framed pictures of the same size share one palette set. They are stacked
 * into one tall picture (whole tiles, so no tile spans two), reduced and fitted together, then cut apart; each keeps
 * its own tile budget. Every result has the same palettes (and `names`, so saving them one by one adds them once).
 */
export function fitPictures(pictures: Uint8ClampedArray[], width: number, height: number, options: Omit<FitOptions, "locks">, name = "Background"): FitResult[] {
  if (!pictures.length) return [];
  const stack = new Uint8ClampedArray(width * height * 4 * pictures.length);
  pictures.forEach((rgba, index) => stack.set(rgba, index * width * height * 4));
  const total = height * pictures.length;
  const fewer = reduceColors(stack, width, total, options.keep, ditherKind(options.dither), options.strength ?? 100);
  const fit = fitPalettes(fewer, width, total, options.max);
  const cellsEach = Math.ceil(width / CELL) * (height / CELL);
  const names = fit.palettes.map((_, index) => `${name} ${index + 1}`);
  return pictures.map((_, index) => {
    const part = { ...fit, pixels: fit.pixels.slice(index * width * height, (index + 1) * width * height), cells: fit.cells.slice(index * cellsEach, (index + 1) * cellsEach) };
    return { ...budgeted(part, width, height, options.budget), names };
  });
}

/** The bounding size of a width × height picture turned by `degrees`. */
export function rotatedSize(width: number, height: number, degrees: number): [number, number] {
  const rad = degrees * Math.PI / 180, c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  return [Math.round(width * c + height * s), Math.round(width * s + height * c)];
}

/** A crop box, 0 … 1 of the turned picture. */
export interface CropBox { x: number; y: number; w: number; h: number }

/** A crop box from two dragged corners (any order), kept inside the picture and at least `least` across; null if too small. */
export function clampCrop(ax: number, ay: number, bx: number, by: number, least = 0.02): CropBox | null {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const x = clamp(Math.min(ax, bx)), y = clamp(Math.min(ay, by)), w = clamp(Math.max(ax, bx)) - x, h = clamp(Math.max(ay, by)) - y;
  return w < least || h < least ? null : { x, y, w, h };
}

/** Each tile of a width × height picture (0 free, else a slot), painted by a brush of tiles: a lock map's cell index. */
export function lockCell(width: number, x: number, y: number): number {
  return (y >> 3) * Math.ceil(width / CELL) + (x >> 3);
}

/** Size presets in whole screens; the label is what the wizard shows. */
export const SCREEN_SIZES: [number, number, string][] = [[160, 144, "1 screen"], [320, 144, "2 wide"], [160, 288, "2 tall"], [320, 288, "4 screens"]];
