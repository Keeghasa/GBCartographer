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

/**
 * Every auto-tile a stamp can be (the author's picks, 2026-10-10): its glyph on the card, what it does, and which
 * stamp sizes fit it. Sheets of 16 are 4 × 4 tiles, indexed by a 4-bit mask (column mask % 4, row mask / 4):
 * edges N 1, E 2, S 4, W 8 for paths and edge-Wang; corners NW 1, NE 2, SW 4, SE 8 (set: the second terrain) for
 * corner-Wang. The wall-face sheet is 4 × 3 tiles: floor, nothing; the upper wall row and the lower wall row, each
 * as middle, left end, right end, both ends.
 */
export type AutotileKind = "box" | "wang" | "across" | "down" | "path" | "edges" | "corner" | "wallface" | "anim";
const whole = (w: number, h: number) => w % 8 === 0 && h % 8 === 0;
export const AUTOTILES: { id: AutotileKind; glyph: string; name: string; about: string; size: string; fits: (w: number, h: number) => boolean }[] = [
  { id: "box", glyph: "9", name: "Box", about: "drag a rectangle: corners, edges and middle stretch over it", size: "whole tiles, at least 3 × 3", fits: (w, h) => whole(w, h) && w >= 24 && h >= 24 },
  { id: "across", glyph: "↔", name: "3-slice across", about: "drag a line: left and right tiles cap the ends, the middle repeats (fences, bridges, platforms)", size: "whole tiles, at least 3 wide", fits: (w, h) => whole(w, h) && w >= 24 },
  { id: "down", glyph: "↕", name: "3-slice down", about: "drag down: top and bottom tiles cap the ends, the middle repeats (ladders, pillars, waterfalls)", size: "whole tiles, at least 3 tall", fits: (w, h) => whole(w, h) && h >= 24 },
  { id: "path", glyph: "P", name: "Path", about: "paint a line: each tile joins its neighbours up, down, left and right (roads, rivers, fences)", size: "a 16-tile sheet, 4 × 4 tiles", fits: (w, h) => w === 32 && h === 32 },
  { id: "wang", glyph: "W", name: "Wang (47)", about: "paint an area: each tile fits all eight neighbours, inner corners too", size: "a 47-tile sheet, 8 × 6 tiles", fits: (w, h) => w === WANG_COLUMNS * 8 && h === WANG_ROWS * 8 },
  { id: "edges", glyph: "E", name: "Wang edges (16)", about: "paint an area: each tile fits its four sides (no inner corners)", size: "a 16-tile sheet, 4 × 4 tiles", fits: (w, h) => w === 32 && h === 32 },
  { id: "corner", glyph: "C", name: "Corner Wang (2 terrains)", about: "paint at the grid's corners: two ground types blend (grass into sand, water into shore)", size: "a 16-tile sheet, 4 × 4 tiles", fits: (w, h) => w === 32 && h === 32 },
  { id: "wallface", glyph: "F", name: "Wall face", about: "paint floor: walls grow two tiles tall above it, nothing (black) everywhere else", size: "a 4 × 3-tile sheet", fits: (w, h) => w === 32 && h === 24 },
  { id: "anim", glyph: "▶", name: "Animated tile", about: "frames side by side: stamps the first frame, the card plays them all", size: "square frames side by side, at least 2", fits: (w, h) => h % 8 === 0 && h > 0 && w % h === 0 && w / h >= 2 },
];
export const autotileOf = (id: string | undefined) => AUTOTILES.find((item) => item.id === id);

/** The 4-bit masks of the 16-tile sheets: which of a tile's four sides (or corners) are set. */
export const EDGE_N = 1, EDGE_E = 2, EDGE_S = 4, EDGE_W = 8;
export const CORNER_NW = 1, CORNER_NE = 2, CORNER_SW = 4, CORNER_SE = 8;
export function edgeMask(filled: (tx: number, ty: number) => boolean, tx: number, ty: number): number {
  return (filled(tx, ty - 1) ? EDGE_N : 0) | (filled(tx + 1, ty) ? EDGE_E : 0) | (filled(tx, ty + 1) ? EDGE_S : 0) | (filled(tx - 1, ty) ? EDGE_W : 0);
}
export const slot16 = (mask: number) => ({ column: mask % 4, row: Math.floor(mask / 4) });

/** A stamp can be a box auto-tile when it is whole tiles, at least 3 × 3. */
export const canBox = (w: number, h: number) => w % 8 === 0 && h % 8 === 0 && w >= 24 && h >= 24;
/** A stamp can be a Wang sheet when it is exactly 8 × 6 tiles. */
export const canWang = (w: number, h: number) => w === WANG_COLUMNS * 8 && h === WANG_ROWS * 8;
