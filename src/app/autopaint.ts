/**
 * Which sheet pieces an area auto-tile puts where (the author's outdoor pieces and RPG Maker-layout blocks,
 * 2026-10-12). Pure: given which cells are filled, each function returns the minitiles (8 × 8 sheet tiles, as
 * [column, row]) for one cell's four quarters (TL, TR, BL, BR), or null for a quarter it leaves alone. The painter
 * (usePainting) and the offline renderer in the tests use these, so what the tests look at is what gets painted.
 */
import { E, N, NE, NW, S, SE, SW, W, maskAt } from "./autotile";

export type Piece = [number, number] | null;
type Filled = (x: number, y: number) => boolean;

/**
 * RPG Maker's autotile block (2 × 3 tiles of 16 px, 4 × 6 minitiles): for one quarter of a cell, its two side
 * neighbours and its corner neighbour pick the minitile. Both sides filled: the fill, or with the corner empty the
 * inner corner, taken from the top-left tile's OPPOSITE minitile (that tile is drawn as a small hole in the middle,
 * each minitile notched at the corner facing the centre). One side: that edge. Neither: the outer corner.
 */
export function rpgQuarter(quarter: number, sideA: boolean, sideB: boolean, diagonal: boolean): [number, number] {
  // sideA: across the quarter's vertical side (W for TL / BL, E for TR / BR); sideB: across its horizontal side (N or S).
  const right = quarter === 1 || quarter === 3, bottom = quarter >= 2;
  if (sideA && sideB) return diagonal ? [right ? 2 : 1, bottom ? 4 : 3] : [right ? 0 : 1, bottom ? 0 : 1];
  if (sideA) return [right ? 2 : 1, bottom ? 5 : 2];
  if (sideB) return [right ? 3 : 0, bottom ? 4 : 3];
  return [right ? 3 : 0, bottom ? 5 : 2];
}

/** A filled cell's four minitiles in an RPG Maker block, from its 8-bit neighbour mask. */
export function rpgCell(mask: number): [number, number][] {
  const has = (bit: number) => Boolean(mask & bit);
  return [rpgQuarter(0, has(W), has(N), has(NW)), rpgQuarter(1, has(E), has(N), has(NE)), rpgQuarter(2, has(W), has(S), has(SW)), rpgQuarter(3, has(E), has(S), has(SE))];
}

/**
 * The mound ledge sheet (src/graphics/pieces.ts, 48 × 80, 6 × 10 minitiles): columns 1–4 rows 0–3 the plateau
 * (row 0 its top border, rows 1–2 the plate inside, row 3 its bottom border; columns 1 and 4 its left and right
 * borders, the corners rounded); columns 0 and 5 the rock that flanks it; rows 4–5 the rock face, rows 6–7 its
 * foot; row 8 the inner corners (columns 0–3: notched at the top left, top right, bottom left, bottom right);
 * row 9 the flank of a taller plateau (left straight, left closing, right straight, right closing).
 */
export function moundPlateau(mask: number): [number, number][] {
  const has = (bit: number) => Boolean(mask & bit);
  const quarter = (index: number, side: boolean, up: boolean, diagonal: boolean): [number, number] => {
    const right = index === 1 || index === 3, bottom = index >= 2;
    if (side && up) return diagonal ? [right ? 3 : 2, bottom ? 2 : 1] : [index, 8];
    if (side) return [right ? 3 : 2, bottom ? 3 : 0];
    if (up) return [right ? 4 : 1, bottom ? 2 : 1];
    return [right ? 4 : 1, bottom ? 3 : 0];
  };
  return [quarter(0, has(W), has(N), has(NW)), quarter(1, has(E), has(N), has(NE)), quarter(2, has(W), has(S), has(SW)), quarter(3, has(E), has(S), has(SE))];
}

/**
 * Where the mound's pieces go in cell (x, y): the plateau, the rock face under its bottom edge, rock beside it.
 * `continues` says which cells count as more plateau for a plateau cell's own border (the painter passes "off the
 * picture too", so a plateau running off the edge shows no border there); faces and rock only come from `plateau`.
 */
export function moundLayout(plateau: Filled, x: number, y: number, continues: Filled = plateau): { kind: "plateau" | "face" | "beside" | "none"; pieces: Piece[] } {
  if (plateau(x, y)) return { kind: "plateau", pieces: moundPlateau(maskAt(continues, x, y)) };
  const face = (fx: number, fy: number) => !plateau(fx, fy) && plateau(fx, fy - 1);
  if (face(x, y)) {
    const left = plateau(x - 1, y - 1), right = plateau(x + 1, y - 1);
    return { kind: "face", pieces: [[left ? 2 : 1, 4], [right ? 3 : 4, 4], [left ? 2 : 1, 6], [right ? 3 : 4, 6]] };
  }
  // Rock beside a plateau or a face: the half of this cell next to it. Beside a plateau the side slopes out once,
  // from the top cell (the mound's own side, rows 0–1) to full width at the plateau's bottom cell, straight between.
  const beside = (right: boolean): [Piece, Piece] => {
    const nx = right ? x + 1 : x - 1, column = right ? 0 : 5;
    if (face(nx, y)) return [[column, 4], [column, 6]];
    if (!plateau(nx, y)) return [null, null];
    const top = !plateau(nx, y - 1), bottom = !plateau(nx, y + 1);
    const straight: [number, number] = [right ? 0 : 2, 9], closing: [number, number] = [right ? 1 : 3, 9];
    if (top) return [[column, 0], [column, 1]];
    return bottom ? [closing, [column, 3]] : [straight, straight];
  };
  const [rightTop, rightBottom] = beside(true), [leftTop, leftBottom] = beside(false);
  const pieces: Piece[] = [leftTop, rightTop, leftBottom, rightBottom];
  return { kind: pieces.some(Boolean) ? "beside" : "none", pieces };
}

/**
 * The author's forest (a 64 × 32 sheet: a clump of trees on the left, one tree on the right; units of 32 px). The
 * clump is a staggered lattice: a tree in the middle of every unit and trees on the units' corners, each corner tree
 * shared by the four units around it. So each 16 px quarter of a unit takes the clump's quarter only when the three
 * units around that corner are forest too (then all four sharers draw their part of that tree), else the lone
 * tree's quarter. Pieces here are 16 px quarters, as [tile column, tile row] of their top-left 8 × 8 tile.
 */
export function forestLayout(forest: Filled, x: number, y: number): Piece[] {
  if (!forest(x, y)) return [null, null, null, null];
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], quarter): Piece => {
    const qx = quarter % 2, qy = quarter >> 1;
    const clump = forest(x + dx, y) && forest(x, y + dy) && forest(x + dx, y + dy);
    return [(clump ? 0 : 4) + qx * 2, qy * 2];
  });
}
