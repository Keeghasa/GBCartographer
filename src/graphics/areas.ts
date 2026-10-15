/**
 * Painting whole areas with the library's pieces (the author, 2026-10-13: the wizards, the village and the tile
 * sheets drawn with what we made, the XP sheets, the cliff and the forest brush). Each painter puts pieces into a
 * canvas the way the stamp tool would (autopaint.ts decides which piece goes where), so a generated map looks like one
 * painted by hand and can be painted on further with the same stamps.
 */
import { forestLayout, xpCell, xpCliffCell } from "../app/autopaint";
import { maskAt } from "../app/autotile";
import { xpCliffTemplate, xpGroundTemplate, xpWaterTemplate } from "./autotiles";
import { CLEAR, type Canvas } from "./pen";
import { pieces } from "./pieces";
import { TEMP_ASSETS } from "./temp";

/**
 * The catalog's own version of a sheet by id (the author's hand edits), handed in by library.ts once it is built:
 * importing the library here would make a loop (the library's tile sheets draw from these painters).
 */
let catalogArt: (id: string) => Canvas | null = () => null;
export function setCatalogArt(lookup: (id: string) => Canvas | null) { catalogArt = lookup; made.clear(); }
/** The catalog's version of any library graphic by id (the author's hand edit, else the code's), or null. */
export const catalogVersion = (id: string): Canvas | null => catalogArt(id);

type Filled = (x: number, y: number) => boolean;

/** A sheet by its temp-asset id (made once). */
const made = new Map<string, Canvas>();
export function sheet(id: "xp-grass" | "xp-sand" | "xp-dirt" | "xp-stone-floor" | "xp-wood-floor" | "xp-carpet" | "xp-tile-floor" | "xp-snow" | "water" | "cliff" | "pines" | "round" | "xp-brick-square" | "pat-stone-wall" | "xp-flowers" | "xp-ground" | "xp-ice" | "room-border"): Canvas {
  let art = made.get(id);
  if (!art) {
    // The catalog's version first (the author's hand edits from the Asset Catalog project), else the code's.
    const catalogId = ({ water: "xp-water", cliff: "xp-cliff", pines: "piece-pines", round: "piece-round-trees", "room-border": "piece-room-border" } as Record<string, string>)[id] ?? id;
    art = catalogArt(catalogId) ?? (id === "water" ? xpWaterTemplate() : id === "cliff" ? xpCliffTemplate() : id === "pines" ? pieces.pines() : id === "round" ? pieces.roundTrees() : id === "xp-ground" || id === "room-border" ? xpGroundTemplate() : TEMP_ASSETS.find((asset) => asset.id === id)!.make());
    made.set(id, art);
  }
  return art;
}

/** Copies an 8 × 8 piece (sheet column / row, in 8 px units) to (x, y); see-through pixels are skipped (or `under`). */
function put(out: Canvas, art: Canvas, column: number, row: number, x: number, y: number, size = 8, fromY = row * 8, rows = size) {
  for (let py = 0; py < rows; py += 1) for (let px = 0; px < size; px += 1) {
    const value = art.pixels[(fromY + py) * art.width + column * 8 + px];
    const tx = x + px, ty = y + py;
    if (value === CLEAR || tx < 0 || ty < 0 || tx >= out.width || ty >= out.height) continue;
    out.pixels[ty * out.width + tx] = value;
  }
}

/**
 * An XP area on 16 px cells: every filled cell takes its four minitiles from the block by its neighbours. `beyond`
 * says whether cells off the map count as filled (water running off the edge shows no shore there).
 */
export function paintXp(out: Canvas, art: Canvas, filled: Filled, cellsW: number, cellsH: number, beyond = false, x0 = 0, y0 = 0) {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < cellsW && y < cellsH;
  const is = (x: number, y: number) => inside(x, y) ? filled(x, y) : beyond;
  for (let y = 0; y < cellsH; y += 1) for (let x = 0; x < cellsW; x += 1) {
    if (!filled(x, y)) continue;
    xpCell(maskAt(is, x, y)).forEach(([column, row], quarter) => put(out, art, column, row, x0 + x * 16 + (quarter % 2) * 8, y0 + y * 16 + (quarter >> 1) * 8));
  }
}

/** Cliffs (Cliff) on 16 px cells: plateaus with their faces where the cell below isn't cliff. */
export function paintCliffs(out: Canvas, filled: Filled, cellsW: number, cellsH: number, x0 = 0, y0 = 0, tall = false, beyond = false) {
  // With `beyond`, rock runs on past the picture's edge (the author, 2026-10-14: no bevelled cliff sides at the border).
  const art = sheet("cliff"), is = (x: number, y: number) => x < 0 || y < 0 || x >= cellsW || y >= cellsH ? beyond : filled(x, y);
  // The author's pick (2026-10-14, cliff corner review): the old foot piece where a strip meets a wider plateau, not
  // the row 7 corners (kept in the sheet, unused).
  const corners = false && hasCliffCorners(art);
  if (!tall) {
    for (let y = 0; y < cellsH; y += 1) for (let x = 0; x < cellsW; x += 1) {
      xpCliffCell(is, x, y, corners).forEach((piece, quarter) => { if (piece) put(out, art, piece[0], piece[1], x0 + x * 16 + (quarter % 2) * 8, y0 + y * 16 + (quarter >> 1) * 8); });
    }
    return;
  }
  // A face two cells (32 px) tall (the author, 2026-10-13: cave walls): the plateau ends a cell higher, its face takes
  // that cell and the one below, the sheet's 16 px face stretched by repeating its plain middle row (top edge and foot
  // kept). A rock strip one cell thin keeps the 16 px face.
  const top = (x: number, y: number) => is(x, y) && is(x, y + 1);
  const faceRow = (t: number) => t < 4 ? 32 + t : t >= 22 ? 38 + t - 22 : 37;
  const faceColumns = (x: number, y: number) => { const pieces = xpCliffCell(top, x, y, corners); return [pieces[0]![0], pieces[1]![0]]; };
  const stretched = (columns: number[], x: number, y: number, from: number) => columns.forEach((column, half) => {
    for (let t = 0; t < 16; t += 1) put(out, art, column, 0, x0 + x * 16 + half * 8, y0 + y * 16 + t, 8, faceRow(from + t), 1);
  });
  for (let y = 0; y < cellsH; y += 1) for (let x = 0; x < cellsW; x += 1) {
    if (top(x, y)) {
      if (!top(x, y + 1)) stretched(faceColumns(x, y), x, y, 0);
      else xpCliffCell(top, x, y, corners).forEach((piece, quarter) => { if (piece) put(out, art, piece[0], piece[1], x0 + x * 16 + (quarter % 2) * 8, y0 + y * 16 + (quarter >> 1) * 8); });
    } else if (is(x, y)) {
      if (top(x, y - 1)) stretched(faceColumns(x, y - 1), x, y, 16);
      else xpCliffCell(is, x, y, corners).forEach((piece, quarter) => { if (piece) put(out, art, piece[0], piece[1], x0 + x * 16 + (quarter % 2) * 8, y0 + y * 16 + (quarter >> 1) * 8); });
    }
  }
}

/**
 * A pattern 9-sliced over an area of 16 px cells (Stone wall for dungeon walls, the author 2026-10-13): the pattern
 * tiled across the area, framed where it meets the floor (a dark line, then a mid one inside it, corners turned).
 * Cells off the map count as filled, so the frame stops at the picture's edge.
 */
export function paintSliced(out: Canvas, art: Canvas, filled: Filled, cellsW: number, cellsH: number, x0 = 0, y0 = 0) {
  const is = (x: number, y: number) => x < 0 || y < 0 || x >= cellsW || y >= cellsH || filled(x, y);
  for (let cy = 0; cy < cellsH; cy += 1) for (let cx = 0; cx < cellsW; cx += 1) {
    if (!filled(cx, cy)) continue;
    for (let ly = 0; ly < 16; ly += 1) for (let lx = 0; lx < 16; lx += 1) {
      const px = cx * 16 + lx, py = cy * 16 + ly, tx = x0 + px, ty = y0 + py;
      if (tx < 0 || ty < 0 || tx >= out.width || ty >= out.height) continue;
      let edge = 9;
      if (!is(cx - 1, cy)) edge = Math.min(edge, lx);
      if (!is(cx + 1, cy)) edge = Math.min(edge, 15 - lx);
      if (!is(cx, cy - 1)) edge = Math.min(edge, ly);
      if (!is(cx, cy + 1)) edge = Math.min(edge, 15 - ly);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (!is(cx + dx, cy + dy)) edge = Math.min(edge, Math.max(dx < 0 ? lx : 15 - lx, dy < 0 ? ly : 15 - ly));
      const value = art.pixels[(py % art.height) * art.width + (px % art.width)];
      out.pixels[ty * out.width + tx] = edge === 0 ? 3 : edge === 1 ? 2 : value === CLEAR ? 3 : value;
    }
  }
}

/**
 * Forest on 32 px units (the pine or round forest brush): the clump inside, lone trees round the edge. With `beyond`,
 * the woods go on past the picture's edge (no lone trees along it).
 */
export function paintForest(out: Canvas, art: Canvas, forest: Filled, unitsW: number, unitsH: number, x0 = 0, y0 = 0, beyond = false) {
  const is = (x: number, y: number) => x < 0 || y < 0 || x >= unitsW || y >= unitsH ? beyond : forest(x, y);
  for (let y = 0; y < unitsH; y += 1) for (let x = 0; x < unitsW; x += 1) {
    forestLayout(is, x, y).forEach((piece, quarter) => {
      if (!piece) return;
      for (let ty = 0; ty < 2; ty += 1) for (let tx = 0; tx < 2; tx += 1) put(out, art, piece[0] + tx, piece[1] + ty, x0 + x * 32 + (quarter % 2) * 16 + tx * 8, y0 + y * 32 + (quarter >> 1) * 16 + ty * 8);
    });
  }
}

/** Whether a Cliff sheet has the inside-corner pieces in row 7 (columns 0–1 not see-through). */
export function hasCliffCorners(art: { width: number; height: number; pixels: Uint8Array }): boolean {
  if (art.height < 64) return false;
  for (let y = 56; y < 64; y += 1) for (let x = 0; x < 16; x += 1) if (art.pixels[y * art.width + x] !== CLEAR) return true;
  return false;
}

/** A 16 × 16 piece of a sheet as a tile (the fill of an XP block, a cliff face…): (column, row) in 8 px units. */
export function pieceOf(art: Canvas, column: number, row: number, w = 16, h = 16): Canvas {
  const out: Canvas = { width: w, height: h, pixels: new Uint8Array(w * h) };
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const value = art.pixels[(row * 8 + y) * art.width + column * 8 + x]; out.pixels[y * w + x] = value === CLEAR ? 0 : value; }
  return out;
}
