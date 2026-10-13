import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { forestLayout, moundLayout, rpgCell, xpCell, xpCliffCell, type Piece } from "./autopaint";
import { maskAt } from "./autotile";
import { atlasWaterTemplate, xpCliffTemplate, xpGroundTemplate, xpWaterTemplate } from "../graphics/autotiles";
import { pieces } from "../graphics/pieces";
import type { Canvas } from "../graphics/pen";
import { encodePng } from "../gb/png";
import { CLEAR } from "../paint";

/** Shapes as text: "#" filled, anything else empty; one character per cell. */
const shape = (rows: string[]) => ({ w: rows[0].length, h: rows.length, filled: (x: number, y: number) => rows[y]?.[x] === "#" });

/** Paints a picture the way the stamp tool does: each cell's pieces (minitiles of `size` px) copied from the sheet. */
function paint(sheet: Canvas, cellsW: number, cellsH: number, cell: number, layout: (x: number, y: number) => Piece[], size = 8): Canvas {
  const out: Canvas = { width: cellsW * cell, height: cellsH * cell, pixels: new Uint8Array(cellsW * cell * cellsH * cell) };
  for (let y = 0; y < cellsH; y += 1) for (let x = 0; x < cellsW; x += 1) layout(x, y).forEach((piece, quarter) => {
    if (!piece) return;
    const ox = x * cell + (quarter % 2) * size, oy = y * cell + (quarter >> 1) * size;
    for (let py = 0; py < size; py += 1) for (let px = 0; px < size; px += 1) {
      const shade = sheet.pixels[(piece[1] * 8 + py) * sheet.width + piece[0] * 8 + px];
      out.pixels[(oy + py) * out.width + ox + px] = shade === CLEAR ? 0 : shade;
    }
  });
  return out;
}

/** Writes the picture as a PNG at 4× when OUT is set (to look at while working on the sheets). */
function save(name: string, art: Canvas) {
  if (!process.env.OUT) return;
  const scale = 4, shades = [[224, 248, 207], [134, 192, 108], [48, 104, 80], [7, 24, 33]];
  const rgba = new Uint8ClampedArray(art.width * scale * art.height * scale * 4);
  for (let y = 0; y < art.height * scale; y += 1) for (let x = 0; x < art.width * scale; x += 1) rgba.set([...shades[art.pixels[Math.floor(y / scale) * art.width + Math.floor(x / scale)]], 255], (y * art.width * scale + x) * 4);
  writeFileSync(`${process.env.OUT}/${name}.png`, encodePng(rgba, art.width * scale, art.height * scale, (bytes) => deflateSync(bytes)));
}

/** Every outline pixel (shade 3) inside the filled cells is within 3 px of an empty cell (rounded corners sit a little in): no lines inside an area. */
function strayOutlines(art: Canvas, cell: number, filled: (x: number, y: number) => boolean): number {
  let stray = 0;
  const empty = (px: number, py: number) => px < 0 || py < 0 || px >= art.width || py >= art.height || !filled(Math.floor(px / cell), Math.floor(py / cell));
  for (let py = 0; py < art.height; py += 1) for (let px = 0; px < art.width; px += 1) {
    if (empty(px, py) || art.pixels[py * art.width + px] !== 3) continue;
    let near = false;
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) if (empty(px + dx, py + dy)) near = true;
    if (!near) stray += 1;
  }
  return stray;
}

const L = shape([
  "..........",
  ".######...",
  ".######...",
  ".....##...",
  ".....#####",
  ".....#####",
  "..........",
]);
const blob = shape([
  "...........",
  ".####..###.",
  ".#########.",
  ".##..####..",
  ".#########.",
  "...####....",
  "...........",
]);

describe("area auto-tiles, painted offline", () => {
  it("takes RPG Maker's minitiles: outer corners, edges, the fill, and the opposite minitile for an inner corner", () => {
    expect(rpgCell(0)).toEqual([[0, 2], [3, 2], [0, 5], [3, 5]]);
    expect(rpgCell(255)).toEqual([[1, 3], [2, 3], [1, 4], [2, 4]]);
    // Everything but the north-west corner: the top-left quarter is the inner-corner tile's bottom-right minitile.
    expect(rpgCell(255 & ~128)[0]).toEqual([1, 1]);
    expect(rpgCell(255 & ~2)[1]).toEqual([0, 1]);
    expect(rpgCell(255 & ~32)[2]).toEqual([1, 0]);
    expect(rpgCell(255 & ~8)[3]).toEqual([0, 0]);
  });

  it("draws RPG Maker water with no lines inside the water (inner corners notched, not edged)", () => {
    const sheet = atlasWaterTemplate();
    for (const [name, { w, h, filled }] of [["water-L", L], ["water-blob", blob]] as const) {
      const art = paint(sheet, w, h, 16, (x, y) => filled(x, y) ? rpgCell(maskAt((cx, cy) => cx < 0 || cy < 0 || cx >= w || cy >= h ? false : filled(cx, cy), x, y)) : [null, null, null, null]);
      save(name, art);
      expect(strayOutlines(art, 16, filled), name).toBe(0);
    }
  });

  it("draws the XP ground and water with no lines inside, and the XP cliff", () => {
    for (const [sheetName, sheet] of [["ground", xpGroundTemplate()], ["water", xpWaterTemplate()]] as const) for (const [name, { w, h, filled }] of [["L", L], ["blob", blob]] as const) {
      const art = paint(sheet, w, h, 16, (x, y) => filled(x, y) ? xpCell(maskAt((cx, cy) => cx < 0 || cy < 0 || cx >= w || cy >= h ? false : filled(cx, cy), x, y)) : [null, null, null, null]);
      save(`xp-${sheetName}-${name}`, art);
      expect(strayOutlines(art, 16, filled), `${sheetName} ${name}`).toBe(0);
    }
    const hills = shape(["...........", "...##..###.", ".#####.###.", ".#####.###.", ".##.##..##.", "......#....", "..........."]);
    save("xp-cliff", paint(xpCliffTemplate(), hills.w, hills.h, 16, (x, y) => xpCliffCell(hills.filled, x, y)));
  });

  it("never uses an all-blank cliff piece (a blank tile doesn't read as cliff, so painted cells would be lost)", () => {
    const sheet = xpCliffTemplate(), used = new Set<string>();
    // Every neighbourhood of a cell: its 8 neighbours and the cells below them that decide faces.
    for (let bits = 0; bits < 1 << 12; bits += 1) {
      const cells = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2], [1, 2], [0, 0]];
      const filled = (x: number, y: number) => x === 0 && y === 0 ? true : cells.slice(0, 11).some(([cx, cy], i) => cx === x && cy === y && Boolean(bits & (1 << i)));
      for (const piece of xpCliffCell(filled, 0, 0)) if (piece) used.add(piece.join());
    }
    for (const key of used) {
      const [column, row] = key.split(",").map(Number);
      let ink = 0;
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) { const shade = sheet.pixels[(row * 8 + y) * sheet.width + column * 8 + x]; if (shade !== 0 && shade !== CLEAR) ink += 1; }
      expect(ink, `piece ${key}`).toBeGreaterThan(0);
    }
  });

  it("paints the XP cliff cell by cell the way the painter does (cells read back from the picture) as if all at once", () => {
    const sheet = xpCliffTemplate();
    for (const [name, ring] of [["ring", shape(["#####", "#.#.#", "#####"])], ["block", shape(["#####", "#####", "#####"])]] as const) {
    const w = ring.w, h = ring.h;
    const art: Canvas = { width: w * 16, height: h * 16, pixels: new Uint8Array(w * 16 * h * 16) };
    const tileKey = (pixels: Uint8Array, width: number, x0: number, y0: number) => { let key = ""; for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) key += pixels[(y0 + y) * width + x0 + x]; return key; };
    const keys = new Set<string>();
    for (let row = 0; row < 10; row += 1) for (let column = 0; column < 6; column += 1) {
      const tile = new Uint8Array(64);
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) { const v = sheet.pixels[(row * 8 + y) * 48 + column * 8 + x]; tile[y * 8 + x] = v === CLEAR ? 0 : v; }
      const key = tileKey(tile, 8, 0, 0);
      if (/[123]/.test(key)) keys.add(key);
    }
    const order: [number, number][] = [];
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (ring.filled(x, y)) order.push([x, y]);
    for (const [cx, cy] of name === "ring" ? order.reverse() : order) {
      const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
      const filled = (x: number, y: number) => inside(x, y) && ((x === cx && y === cy) || keys.has(tileKey(art.pixels, art.width, x * 16, y * 16)));
      const cells: [number, number, Piece[]][] = [];
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (filled(cx + dx, cy + dy)) cells.push([cx + dx, cy + dy, xpCliffCell(filled, cx + dx, cy + dy)]);
      for (const [x, y, pieces] of cells) pieces.forEach((piece, quarter) => {
        if (!piece) return;
        for (let py = 0; py < 8; py += 1) for (let px = 0; px < 8; px += 1) { const v = sheet.pixels[(piece[1] * 8 + py) * 48 + piece[0] * 8 + px]; art.pixels[(y * 16 + (quarter >> 1) * 8 + py) * art.width + x * 16 + (quarter % 2) * 8 + px] = v === CLEAR ? 0 : v; }
      });
    }
    const whole = paint(sheet, w, h, 16, (x, y) => xpCliffCell((fx, fy) => fx >= 0 && fy >= 0 && fx < w && fy < h && ring.filled(fx, fy), x, y));
    save(`xp-cliff-${name}`, art);
    expect([...art.pixels], name).toEqual([...whole.pixels]);
    }
  });

  it("draws the mound with no lines inside the plateau, a face under it and rock beside it", () => {
    const sheet = pieces.moundSheet();
    const tall = shape(["..........", ".###..###.", ".###..###.", ".###.####.", ".###.####.", ".....#..#.", ".........."]);
    for (const [name, { w, h, filled }] of [["mound-L", L], ["mound-blob", blob], ["mound-tall", tall]] as const) {
      const plateau = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && filled(x, y);
      const art = paint(sheet, w, h + 1, 16, (x, y) => moundLayout(plateau, x, y).pieces);
      save(name, art);
      expect(strayOutlines(art, 16, plateau), name).toBe(0);
    }
  });

  it("draws forests as the clump inside and lone trees round the edge, trees shared across units whole", () => {
    const area = shape(["......", ".####.", ".####.", ".####.", "......"]);
    const strip = shape(["....", ".###", ".###", "...."]);
    for (const [name, sheet] of [["pines", pieces.pines()], ["round", pieces.roundTrees()]] as const) for (const [shapeName, { w, h, filled }] of [["area", area], ["strip", strip]] as const) {
      const forest = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && filled(x, y);
      const art = paint(sheet, w, h, 32, (x, y) => forestLayout(forest, x, y), 16);
      save(`forest-${name}-${shapeName}`, art);
      // Nothing is drawn outside the forest's units.
      for (let py = 0; py < art.height; py += 1) for (let px = 0; px < art.width; px += 1) if (!forest(Math.floor(px / 32), Math.floor(py / 32))) expect(art.pixels[py * art.width + px]).toBe(0);
    }
  });
});
