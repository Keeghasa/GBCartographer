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
