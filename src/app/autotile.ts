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
export type AutotileKind = "box" | "wang" | "across" | "down" | "path" | "edges" | "corner" | "wallface" | "anim" | "atlas" | "atlasAnim" | "atlasWall" | "mound" | "forest" | "xp" | "xpAnim" | "xpCliff" | "xpCliffTall";
const whole = (w: number, h: number) => w % 8 === 0 && h % 8 === 0;
/**
 * `hidden`: no longer offered (the author's review, 2026-10-14), though stamps already set to it keep painting:
 * "dropped" styles, and RPG Maker's layouts "folded" into Area with edges / Animated area (which take those sheets).
 */
export const AUTOTILES: { id: AutotileKind; glyph: string; name: string; about: string; size: string; fits: (w: number, h: number) => boolean; hidden?: "dropped" | "folded" }[] = [
  { id: "box", glyph: "9", name: "9-slice box", about: "drag a rectangle: corners, edges and middle stretch over it", size: "whole tiles, at least 3 × 3", fits: (w, h) => whole(w, h) && w >= 24 && h >= 24 },
  { id: "across", glyph: "↔", name: "Fence style", about: "drag a line: left and right tiles cap the ends, the middle repeats (fences, bridges, platforms)", size: "whole tiles, at least 3 wide", fits: (w, h) => whole(w, h) && w >= 24 },
  { id: "down", glyph: "↕", name: "Ladder style", about: "drag down: top and bottom tiles cap the ends, the middle repeats (ladders, pillars, waterfalls)", size: "whole tiles, at least 3 tall", fits: (w, h) => whole(w, h) && h >= 24 },
  { id: "path", glyph: "P", name: "Road", about: "paint a line: each tile joins its neighbours up, down, left and right (roads, rivers, fences)", size: "a 16-tile sheet, 4 × 4 tiles", fits: (w, h) => w === 32 && h === 32 },
  { id: "wang", glyph: "W", name: "Wang (47)", about: "paint an area: each tile fits all eight neighbours, inner corners too", size: "a 47-tile sheet, 8 × 6 tiles", fits: (w, h) => w === WANG_COLUMNS * 8 && h === WANG_ROWS * 8 },
  { id: "edges", hidden: "dropped", glyph: "E", name: "Wang edges (16)", about: "paint an area: each tile fits its four sides (no inner corners)", size: "a 16-tile sheet, 4 × 4 tiles", fits: (w, h) => w === 32 && h === 32 },
  { id: "corner", glyph: "C", name: "Corner Wang (2 terrains)", about: "paint at the grid's corners: two ground types blend (grass into sand, water into shore)", size: "a 16-tile sheet, 4 × 4 tiles", fits: (w, h) => w === 32 && h === 32 },
  { id: "wallface", hidden: "dropped", glyph: "F", name: "Wall face", about: "paint floor: a wall face grows one tile tall above it, nothing (black) everywhere else", size: "a 4 × 2-tile sheet", fits: (w, h) => w === 32 && (h === 16 || h === 24) },
  { id: "anim", glyph: "▶", name: "Animated tile", about: "frames side by side: stamps the first frame, the card plays them all", size: "square frames side by side, at least 2", fits: (w, h) => h % 8 === 0 && h > 0 && w % h === 0 && w / h >= 2 },
  { id: "atlas", hidden: "folded", glyph: "A", name: "RPG Maker ground (2 × 3)", about: "paint 16 px cells: a 2 × 3 block of 16 × 16 tiles in RPG Maker's layout fits every neighbour, inner corners too", size: "a 2 × 3 block of 16 px tiles, 32 × 48", fits: (w, h) => w === ATLAS_W && h === ATLAS_H },
  { id: "atlasAnim", hidden: "folded", glyph: "~", name: "Water (3 frames)", about: "a 2 × 3 block in three frames side by side (RPG Maker's water layout): paint 16 px cells, the shores fit, and the picture plays the frames while it's in hand (Save writes frame 1)", size: "three 2 × 3 blocks side by side, 96 × 48", fits: (w, h) => w === ATLAS_W * ATLAS_FRAMES && h === ATLAS_H },
  { id: "xp", glyph: "X", name: "Area with edges", about: "paint 16 px cells: RPG Maker's 3 × 4 autotile layout (a lone tile, the inner corners, a 3 × 3 block), every edge and inner corner fits; RPG Maker's 2 × 3 ground sheets (32 × 48) work too", size: "3 × 4 tiles of 16 px, 48 × 64 (or a 2 × 3 block, 32 × 48)", fits: (w, h) => (w === 48 && h === 64) || (w === ATLAS_W && h === ATLAS_H) },
  { id: "xpAnim", glyph: "X~", name: "Animated area", about: "the area layout in two or three frames side by side: paint 16 px cells, the shores fit, and the picture plays the frames while it's in hand (Save writes frame 1)", size: "two or three 48 × 64 blocks side by side, 96 × 64 or 144 × 64 (or RPG Maker's 96 × 48 water)", fits: (w, h) => ((w === 96 || w === 144) && h === 64) || (w === ATLAS_W * ATLAS_FRAMES && h === ATLAS_H) },
  { id: "xpCliff", glyph: "X▲", name: "Cliff", about: "paint 16 px cells: a plateau whose bottom row of cells is the cliff face, sides and inside corners fitted. Drawn as a + (a plateau the shape of a plus, every edge, corner and face where it sits on a map, a lone mound in the top-left corner)", size: "a + of 16 px cells, 112 × 112 (or the older packed 48 × 80)", fits: (w, h) => (w === 112 && h === 112) || (w === 48 && h === 80) },
  { id: "xpCliffTall", glyph: "X▲▲", name: "Cliff (32 px walls)", about: "paint 16 px cells: a cliff whose face is two cells (32 px) tall, like the cave wizard's walls. Drawn as its own + with the faces two cells tall (an older 48 × 80 Cliff sheet has its face stretched)", size: "a + of 16 px cells, 112 × 112 (or a 48 × 80 Cliff sheet)", fits: (w, h) => (w === 112 && h === 112) || (w === 48 && h === 80) },
  { id: "mound", hidden: "dropped", glyph: "M", name: "Mound ledge", about: "paint 16 px cells: a plateau with a rounded top plate, and a rock face that wraps its sides and foot (the author's ledge)", size: "a 6 × 10-minitile sheet, 48 × 80", fits: (w, h) => w === 48 && h === 80 },
  { id: "forest", glyph: "T", name: "Forest", about: "paint 32 px tree units: a clump of trees inside, single trees along the edge (the author's trees)", size: "a clump and a single tree side by side, 64 × 32", fits: (w, h) => w === 64 && h === 32 },
  { id: "atlasWall", hidden: "dropped", glyph: "A▣", name: "RPG Maker wall (roof + face)", about: "paint an area: its roof fits like RPG Maker ground, and a wall face two cells tall grows below its bottom edge", size: "a 2 × 3 roof block over a 2 × 2 wall block, 32 × 80", fits: (w, h) => w === ATLAS_W && h === ATLAS_H + ATLAS_WALL_H },
];

/**
 * Atlas auto-tiles (the author, 2026-10-12): RPG Maker's autotile layout, kept as it is so sheets in that format
 * can be painted over. A map cell is 16 px (2 × 2 GB tiles). A 2 × 3 block of 16 px tiles (32 × 48, 4 × 6 minitiles
 * of 8 px) holds: row 0 left, the four inner-corner minitiles; row 0 right, the plain sample tile; rows 1–2, a
 * 2 × 2-tile region drawn with its outer edges. Any of the 47 neighbour shapes is put together from four
 * minitiles, one per quarter of the cell: for the quarter at a corner, its two side neighbours and that corner
 * neighbour say which minitile: both sides filled → the fill (or, corner empty, the inner corner); one side filled →
 * that edge; neither → the outer corner.
 * Water (atlasAnim) is three such blocks side by side, one per animation frame. A wall (atlasWall) is a roof block
 * over a 2 × 2-tile wall region (4 × 4 minitiles, 32 × 32: edges and corners only, no inner corners).
 */
export const ATLAS_W = 32, ATLAS_H = 48, ATLAS_FRAMES = 3, ATLAS_WALL_H = 32;




/**
 * A wall face's four minitiles from a 2 × 2-tile region (4 × 4 minitiles at `top`): only the left and right ends
 * and the top and bottom rows matter (`left` / `right`: a face continues that way; `above` / `below`: more face).
 */
export function atlasWallCell(left: boolean, right: boolean, above: boolean, below: boolean, top: number): [number, number][] {
  const column = (isRight: boolean) => isRight ? (right ? 2 : 3) : (left ? 1 : 0);
  const row = (isBottom: boolean) => top + (isBottom ? (below ? 4 : 5) : (above ? 3 : 2)) - 2;
  return [[column(false), row(false)], [column(true), row(false)], [column(false), row(true)], [column(true), row(true)]];
}
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

/**
 * The style a stamp gets when a style is picked from the menu: Area with edges and Animated area take RPG Maker's
 * layouts (2026-10-14, folded in), so a sheet in that layout is set to the RPG Maker style underneath.
 */
export function styleFor(kind: AutotileKind, width: number, height: number): AutotileKind {
  if (kind === "xp" && AUTOTILES.find((item) => item.id === "atlas")!.fits(width, height)) return "atlas";
  if (kind === "xpAnim" && AUTOTILES.find((item) => item.id === "atlasAnim")!.fits(width, height)) return "atlasAnim";
  return kind;
}
/** The style shown in the menu for a stamp's style (RPG Maker's layouts show as the area they were folded into). */
export const shownStyle = (kind: AutotileKind | undefined): AutotileKind | undefined => kind === "atlas" ? "xp" : kind === "atlasAnim" ? "xpAnim" : kind;
