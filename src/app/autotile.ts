/**
 * Auto-tiles for saved stamps (the author, 2026-10-10): a stamp marked 9 (box) or W (Wang) paints by layout rules
 * instead of as one block.
 *
 * Box (9): a stamp of at least 3 × 3 tiles stretched over a dragged rectangle (corners, repeated edges, repeated middle).
 *
 * Wang (W): the 47-tile "blob" set (as in excaliburjs.com/blog/Autotiling Technique): every 8 × 8 tile painted with
 * it looks at its eight neighbours and takes the tile drawn for that shape. A corner neighbour only counts when both
 * sides next to it are filled too, which leaves 47 shapes. The sheet is 8 tiles wide and 6 high: the 47 shapes in
 * order of their mask (bits: N 1, NE 2, E 4, SE 8, S 16, SW 32, W 64, NW 128), the 48th slot unused. Off the
 * picture counts as filled, so a wall runs on past the edge.
 */
export const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;
export const WANG_COLUMNS = 8, WANG_ROWS = 6;

/** Drops each corner bit unless both of its sides are set: 256 masks become 47. */
export function reduceMask(mask: number): number {
  let out = mask & (N | E | S | W);
  if (mask & NE && mask & N && mask & E) out |= NE;
  if (mask & SE && mask & S && mask & E) out |= SE;
  if (mask & SW && mask & S && mask & W) out |= SW;
  if (mask & NW && mask & N && mask & W) out |= NW;
  return out;
}

/** The 47 reduced masks, in sheet order. */
export const WANG_MASKS: readonly number[] = [...new Set(Array.from({ length: 256 }, (_, mask) => reduceMask(mask)))].sort((a, b) => a - b);
const SLOT = new Map(WANG_MASKS.map((mask, index) => [mask, index]));

/** Where a mask's tile sits on the sheet (column, row). */
export function wangSlot(mask: number): { column: number; row: number } {
  const index = SLOT.get(reduceMask(mask)) ?? 0;
  return { column: index % WANG_COLUMNS, row: Math.floor(index / WANG_COLUMNS) };
}

/** The neighbour mask of tile (tx, ty) given which tiles are filled; off the grid counts as filled. */
export function maskAt(filled: (tx: number, ty: number) => boolean, tx: number, ty: number): number {
  const at = (dx: number, dy: number) => filled(tx + dx, ty + dy);
  return (at(0, -1) ? N : 0) | (at(1, -1) ? NE : 0) | (at(1, 0) ? E : 0) | (at(1, 1) ? SE : 0) | (at(0, 1) ? S : 0) | (at(-1, 1) ? SW : 0) | (at(-1, 0) ? W : 0) | (at(-1, -1) ? NW : 0);
}

/** A stamp can be a box auto-tile when it is whole tiles, at least 3 × 3. */
export const canBox = (w: number, h: number) => w % 8 === 0 && h % 8 === 0 && w >= 24 && h >= 24;
/** A stamp can be a Wang sheet when it is exactly 8 × 6 tiles. */
export const canWang = (w: number, h: number) => w === WANG_COLUMNS * 8 && h === WANG_ROWS * 8;
