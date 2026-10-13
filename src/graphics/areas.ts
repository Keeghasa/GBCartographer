/**
 * Painting whole areas with the library's pieces (the author, 2026-10-13: the wizards, the village and the tile
 * sheets drawn with what we made, the XP sheets, the cliff and the forest brush). Each painter puts pieces into a
 * canvas the way the stamp tool would (autopaint.ts decides which piece goes where), so a generated map looks like one
 * painted by hand and can be painted on further with the same stamps.
 */
import { forestLayout, xpCell, xpCliffCell } from "../app/autopaint";
import { maskAt } from "../app/autotile";
import { xpCliffTemplate, xpWaterTemplate } from "./autotiles";
import { CLEAR, type Canvas } from "./pen";
import { pieces } from "./pieces";
import { TEMP_ASSETS } from "./temp";

type Filled = (x: number, y: number) => boolean;

/** A sheet by its temp-asset id (made once). */
const made = new Map<string, Canvas>();
export function sheet(id: "xp-grass" | "xp-sand" | "xp-dirt" | "xp-stone-floor" | "xp-wood-floor" | "xp-carpet" | "xp-tile-floor" | "xp-snow" | "water" | "cliff" | "pines" | "round"): Canvas {
  let art = made.get(id);
  if (!art) {
    art = id === "water" ? xpWaterTemplate() : id === "cliff" ? xpCliffTemplate() : id === "pines" ? pieces.pines() : id === "round" ? pieces.roundTrees() : TEMP_ASSETS.find((asset) => asset.id === id)!.make();
    made.set(id, art);
  }
  return art;
}

/** Copies an 8 × 8 piece (sheet column / row, in 8 px units) to (x, y); see-through pixels are skipped (or `under`). */
function put(out: Canvas, art: Canvas, column: number, row: number, x: number, y: number, size = 8) {
  for (let py = 0; py < size; py += 1) for (let px = 0; px < size; px += 1) {
    const value = art.pixels[(row * 8 + py) * art.width + column * 8 + px];
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

/** Cliffs (Cliff XP) on 16 px cells: plateaus with their faces where the cell below isn't cliff. */
export function paintCliffs(out: Canvas, filled: Filled, cellsW: number, cellsH: number, x0 = 0, y0 = 0) {
  const art = sheet("cliff"), is = (x: number, y: number) => x >= 0 && y >= 0 && x < cellsW && y < cellsH && filled(x, y);
  for (let y = 0; y < cellsH; y += 1) for (let x = 0; x < cellsW; x += 1) {
    xpCliffCell(is, x, y).forEach((piece, quarter) => { if (piece) put(out, art, piece[0], piece[1], x0 + x * 16 + (quarter % 2) * 8, y0 + y * 16 + (quarter >> 1) * 8); });
  }
}

/** Forest on 32 px units (the pine or round forest brush): the clump inside, lone trees round the edge. */
export function paintForest(out: Canvas, art: Canvas, forest: Filled, unitsW: number, unitsH: number, x0 = 0, y0 = 0) {
  const is = (x: number, y: number) => x >= 0 && y >= 0 && x < unitsW && y < unitsH && forest(x, y);
  for (let y = 0; y < unitsH; y += 1) for (let x = 0; x < unitsW; x += 1) {
    forestLayout(is, x, y).forEach((piece, quarter) => {
      if (!piece) return;
      for (let ty = 0; ty < 2; ty += 1) for (let tx = 0; tx < 2; tx += 1) put(out, art, piece[0] + tx, piece[1] + ty, x0 + x * 32 + (quarter % 2) * 16 + tx * 8, y0 + y * 32 + (quarter >> 1) * 16 + ty * 8);
    });
  }
}

/** A 16 × 16 piece of a sheet as a tile (the fill of an XP block, a cliff face…): (column, row) in 8 px units. */
export function pieceOf(art: Canvas, column: number, row: number, w = 16, h = 16): Canvas {
  const out: Canvas = { width: w, height: h, pixels: new Uint8Array(w * h) };
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const value = art.pixels[(row * 8 + y) * art.width + column * 8 + x]; out.pixels[y * w + x] = value === CLEAR ? 0 : value; }
  return out;
}
