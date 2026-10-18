/**
 * Cliff sheets drawn as a + (the author, 2026-10-18: "easier for the pixel artist to see what they are making"): a
 * 112 × 112 plateau shaped like a plus (a 3 × 3-cell middle, an arm two cells long on each side, 16 px cells), every
 * edge, corner, inside corner and face drawn once where it sits on a map; the lone mound in the top-left empty corner.
 * The Cliff (32 px walls) gets its own + of the same size, its faces two cells tall.
 *
 * The painters keep reading the packed layout (48 × 80 for a Cliff, 48 × 96 for the 32 px-wall brush): a + is turned
 * into it on load (plusToRect), and a packed sheet into a + for the catalog (rectToPlus). Where each piece sits in
 * the + is found by painting the + with a numbered sheet (every 8 × 8 piece its own value), not written by hand, so
 * the two stay in step with the painter.
 */
import { paintCliffs, setPlusToRect } from "../graphics/areas";
import { CLEAR, type Canvas } from "../graphics/pen";

export const PLUS = 112;
const CELLS = 7;
/** The + on 16 px cells: the middle three columns and rows. */
const inPlus = (x: number, y: number) => x >= 0 && y >= 0 && x < CELLS && y < CELLS && ((x >= 2 && x <= 4) || (y >= 2 && y <= 4));

export const isPlusSheet = (width: number, height: number) => width === PLUS && height === PLUS;

/** The packed sheet's size: 48 × 80 for a Cliff, 48 × 96 for the 32 px-wall brush. */
const packedHeight = (tall: boolean) => tall ? 96 : 80;
/** The lone mound's four pieces in the packed sheet (tall: two rows lower). */
const mound = (tall: boolean): [number, number][] => { const r = tall ? 10 : 8; return [[4, r], [5, r], [4, r + 1], [5, r + 1]]; };

/** For each piece of the packed sheet (column + row * 6), where it is in the + (pixels), or nothing. */
const spots = new Map<boolean, Map<number, [number, number]>>();
function spotsOf(tall: boolean): Map<number, [number, number]> {
  const known = spots.get(tall);
  if (known) return known;
  const height = packedHeight(tall), numbered: Canvas = { width: 48, height, pixels: new Uint8Array(48 * height) };
  // Every 8 × 8 piece its own value (16 up: never a shade or see-through).
  for (let y = 0; y < height; y += 1) for (let x = 0; x < 48; x += 1) numbered.pixels[y * 48 + x] = 16 + (x >> 3) + (y >> 3) * 6;
  const out: Canvas = { width: PLUS, height: PLUS, pixels: new Uint8Array(PLUS * PLUS).fill(CLEAR) };
  paintCliffs(out, inPlus, CELLS, CELLS, 0, 0, tall, false, numbered);
  const found = new Map<number, [number, number]>();
  for (let by = 0; by < PLUS; by += 8) for (let bx = 0; bx < PLUS; bx += 8) {
    const value = out.pixels[by * PLUS + bx];
    if (value < 16 || found.has(value - 16)) continue;
    // Only a whole piece counts (a 32 px face is put row by row and fills its blocks whole too).
    let whole = true;
    for (let y = 0; y < 8 && whole; y += 1) for (let x = 0; x < 8 && whole; x += 1) if (out.pixels[(by + y) * PLUS + bx + x] !== value) whole = false;
    if (whole) found.set(value - 16, [bx, by]);
  }
  mound(tall).forEach(([column, row], quarter) => found.set(column + row * 6, [(quarter % 2) * 8, (quarter >> 1) * 8]));
  spots.set(tall, found);
  return found;
}

/** A + sheet as the painters read it (48 × 80, or 48 × 96 for `tall`); pieces the + doesn't show stay see-through. */
export function plusToRect(plus: Canvas, tall: boolean): Canvas {
  const height = packedHeight(tall), out: Canvas = { width: 48, height, pixels: new Uint8Array(48 * height).fill(CLEAR) };
  for (const [piece, [px, py]] of spotsOf(tall)) {
    const column = piece % 6, row = Math.floor(piece / 6);
    for (let y = 0; y < 8; y += 1) out.pixels.set(plus.pixels.subarray((py + y) * plus.width + px, (py + y) * plus.width + px + 8), (row * 8 + y) * 48 + column * 8);
  }
  return out;
}

/** Each 8 × 8 tile's palette slot (a stamp's tileColors) moved the same way as its pixels. */
export function plusCellsToRect(cells: ArrayLike<number>, tall: boolean, none = -1): number[] {
  const height = packedHeight(tall), out = new Array<number>(6 * (height / 8)).fill(none);
  for (const [piece, [px, py]] of spotsOf(tall)) out[piece] = cells[(py / 8) * (PLUS / 8) + px / 8] ?? none;
  return out;
}

/** A Cliff stamp in hand (pixels and each tile's palette) as the brush reads it: a + turned packed, a 32 px-wall one stretched. */
export function cliffStampToRect<T extends { pixels: Uint8Array; w: number; h: number; cells?: Uint8Array }>(stamp: T, tall: boolean): T {
  const plus = isPlusSheet(stamp.w, stamp.h);
  if (!plus && !tall) return stamp;
  const art = plus ? plusToRect({ width: stamp.w, height: stamp.h, pixels: stamp.pixels }, tall) : stretchTall({ width: stamp.w, height: stamp.h, pixels: stamp.pixels });
  const cells = !stamp.cells ? undefined : plus ? Uint8Array.from(plusCellsToRect(stamp.cells, tall, 0)) : Uint8Array.from({ length: 6 * 12 }, (_, at) => stamp.cells![(tallRow(Math.floor(at / 6) * 8 + 4) >> 3) * 6 + (at % 6)]);
  return { ...stamp, pixels: art.pixels, w: art.width, h: art.height, ...(cells ? { cells } : {}) };
}

/** For each 8 × 8 tile of the + (row by row), the packed sheet's piece it shows (column + row * 6), or -1. */
const tilesOfPlus = new Map<boolean, number[]>();
function plusTiles(tall: boolean): number[] {
  const known = tilesOfPlus.get(tall);
  if (known) return known;
  const height = packedHeight(tall), numbered: Canvas = { width: 48, height, pixels: new Uint8Array(48 * height) };
  for (let y = 0; y < height; y += 1) for (let x = 0; x < 48; x += 1) numbered.pixels[y * 48 + x] = 16 + (x >> 3) + (y >> 3) * 6;
  const out: Canvas = { width: PLUS, height: PLUS, pixels: new Uint8Array(PLUS * PLUS).fill(CLEAR) };
  paintCliffs(out, inPlus, CELLS, CELLS, 0, 0, tall, false, numbered);
  const tiles = Array.from({ length: (PLUS / 8) ** 2 }, (_, at) => { const value = out.pixels[(Math.floor(at / (PLUS / 8)) * 8) * PLUS + (at % (PLUS / 8)) * 8]; return value >= 16 ? value - 16 : -1; });
  mound(tall).forEach(([column, row], quarter) => { tiles[(quarter >> 1) * (PLUS / 8) + (quarter % 2)] = column + row * 6; });
  tilesOfPlus.set(tall, tiles);
  return tiles;
}

/** A packed sheet's tile palettes (one per 8 × 8 tile, 6 across) as the +'s, following rectToPlus. */
export function rectCellsToPlus(cells: ArrayLike<number>, tall: boolean, none = -1): number[] {
  // A 48 × 80 sheet's tiles as the 32 px-wall brush stretches them (rows by the stretched rows' middles).
  const from = (piece: number) => { if (!tall || cells.length >= 6 * 12) return cells[piece]; const row = Math.floor(piece / 6); return cells[(tallRow(row * 8 + 4) >> 3) * 6 + (piece % 6)]; };
  return plusTiles(tall).map((piece) => piece < 0 ? none : from(piece) ?? none);
}

/**
 * A packed Cliff sheet (48 × 80) as a + (`tall`: with two-cell faces, its 16 px face stretched as the 32 px-wall
 * brush does): painted with the painter itself, the lone mound copied into the top-left corner.
 */
export function rectToPlus(rect: Canvas, tall: boolean): Canvas {
  const art = tall && rect.height < 96 ? stretchTall(rect) : rect;
  const out: Canvas = { width: PLUS, height: PLUS, pixels: new Uint8Array(PLUS * PLUS).fill(CLEAR) };
  paintCliffs(out, inPlus, CELLS, CELLS, 0, 0, tall, false, art);
  mound(tall).forEach(([column, row], quarter) => {
    for (let y = 0; y < 8; y += 1) out.pixels.set(art.pixels.subarray((row * 8 + y) * art.width + column * 8, (row * 8 + y) * art.width + column * 8 + 8), ((quarter >> 1) * 8 + y) * PLUS + (quarter % 2) * 8);
  });
  return out;
}

/**
 * A Cliff sheet (48 × 80) as the 32 px-wall brush reads it (48 × 96, the author 2026-10-14): the plateau rows as they
 * are, the 16 px face stretched to 32 (its top 4 rows, its plain middle row repeated, its last 10 rows), then the
 * sheet's spare pieces two tile rows lower.
 */
export const tallRow = (y: number) => y < 32 ? y : y < 64 ? (y - 32 < 4 ? y : y - 32 >= 22 ? 38 + (y - 32 - 22) : 37) : y - 16;
export function stretchTall(rect: Canvas): Canvas {
  const out: Canvas = { width: rect.width, height: 96, pixels: new Uint8Array(rect.width * 96) };
  for (let y = 0; y < 96; y += 1) out.pixels.set(rect.pixels.subarray(tallRow(y) * rect.width, tallRow(y) * rect.width + rect.width), y * rect.width);
  return out;
}

setPlusToRect((plus) => plusToRect(plus, false));
