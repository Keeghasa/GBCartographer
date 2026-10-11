import { describe, expect, it } from "vitest";
import { canBox, canWang, E, maskAt, N, NE, reduceMask, S, W, WANG_MASKS, wangSlot } from "./autotile";
import { acrossTemplate, animTemplate, boxTemplate, cornerTemplate, downTemplate, edgesTemplate, pathTemplate, wallFaceTemplate, wangTemplate } from "../graphics/autotiles";
import { AUTOTILES } from "./autotile";

describe("auto-tiles", () => {
  it("has the 47 blob shapes: a corner counts only with both its sides", () => {
    expect(WANG_MASKS.length).toBe(47);
    expect(reduceMask(NE)).toBe(0);
    expect(reduceMask(N | NE | E)).toBe(N | NE | E);
    expect(wangSlot(255)).toEqual({ column: 46 % 8, row: Math.floor(46 / 8) });
  });

  it("reads neighbours, off the grid counting as filled", () => {
    const filled = new Set(["1,1", "2,1"]);
    const at = (x: number, y: number) => x < 0 || y < 0 || x > 3 || y > 3 || filled.has(`${x},${y}`);
    expect(maskAt(at, 1, 1)).toBe(E);
    expect(maskAt(at, 0, 0) & (N | W)).toBe(N | W);
    expect(maskAt(at, 1, 2) & (N | S)).toBe(N);
  });

  it("knows which stamps fit and draws the Wang template at 8 × 6 tiles", () => {
    expect(canBox(24, 24)).toBe(true);
    expect(canBox(16, 24)).toBe(false);
    expect(canWang(64, 48)).toBe(true);
    const sheet = wangTemplate();
    expect([sheet.width, sheet.height]).toEqual([64, 48]);
    expect(canWang(sheet.width, sheet.height)).toBe(true);
    // Painting finds a tile's shape by its pixels, so all 47 must differ.
    const tiles = WANG_MASKS.map((_, index) => { const x = (index % 8) * 8, y = Math.floor(index / 8) * 8; return Array.from({ length: 64 }, (_, at) => sheet.pixels[(y + (at >> 3)) * 64 + x + (at & 7)]).join(""); });
    expect(new Set(tiles).size).toBe(47);
  });

  it("draws a template for every auto-tile that fits it, its painted tiles all different", () => {
    const made = { box: boxTemplate(), wang: wangTemplate(), across: acrossTemplate(), down: downTemplate(), path: pathTemplate(), edges: edgesTemplate(), corner: cornerTemplate(), wallface: wallFaceTemplate(), anim: animTemplate() };
    for (const kind of AUTOTILES) expect(kind.fits(made[kind.id].width, made[kind.id].height), kind.id).toBe(true);
    const distinct = (sheet: { width: number; pixels: Uint8Array }, count: number, columns: number) => new Set(Array.from({ length: count }, (_, index) => { const x = (index % columns) * 8, y = Math.floor(index / columns) * 8; return Array.from({ length: 64 }, (_, at) => sheet.pixels[(y + (at >> 3)) * sheet.width + x + (at & 7)]).join(""); })).size;
    expect(distinct(made.path, 16, 4)).toBe(16);
    expect(distinct(made.edges, 16, 4)).toBe(16);
    expect(distinct(made.corner, 16, 4)).toBe(16);
    expect(distinct(made.wallface, 12, 4)).toBe(11);
  });
});
