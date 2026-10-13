import { pieces } from "../graphics/pieces";
import { describe, expect, it } from "vitest";
import { canBox, canWang, E, maskAt, N, NE, reduceMask, S, W, WANG_MASKS, wangSlot , atlasWallCell } from "./autotile";
import { acrossTemplate, animTemplate, boxTemplate, cornerTemplate, downTemplate, edgesTemplate, pathTemplate, roadTemplate, shoreTemplate, wallFaceTemplate, wangTemplate, atlasWaterTemplate } from "../graphics/autotiles";
import { canvas as atlasBlank } from "../graphics/pen";
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
    const made = { box: boxTemplate(), wang: wangTemplate(), across: acrossTemplate(), down: downTemplate(), path: pathTemplate(), edges: edgesTemplate(), corner: cornerTemplate(), wallface: wallFaceTemplate(), anim: animTemplate(), atlas: atlasBlank(32, 48), atlasAnim: atlasWaterTemplate(), atlasWall: atlasBlank(32, 80), mound: pieces.moundSheet(), forest: pieces.pines(), xp: atlasBlank(48, 64), xpAnim: atlasBlank(144, 64), xpCliff: atlasBlank(48, 80) };
    for (const kind of AUTOTILES) expect(kind.fits(made[kind.id].width, made[kind.id].height), kind.id).toBe(true);
    const distinct = (sheet: { width: number; pixels: Uint8Array }, count: number, columns: number) => new Set(Array.from({ length: count }, (_, index) => { const x = (index % columns) * 8, y = Math.floor(index / columns) * 8; return Array.from({ length: 64 }, (_, at) => sheet.pixels[(y + (at >> 3)) * sheet.width + x + (at & 7)]).join(""); })).size;
    expect(distinct(made.path, 16, 4)).toBe(16);
    expect(distinct(made.edges, 16, 4)).toBe(16);
    expect(distinct(made.corner, 16, 4)).toBe(16);
    expect(distinct(made.wallface, 12, 4)).toBe(11);
    expect(distinct(shoreTemplate(), 16, 4)).toBe(16);
    expect(distinct(roadTemplate(), 16, 4)).toBe(16);
    // Atlas blocks: no minitile is a plain single shade (painting tells a block's cells by their minitiles), and the
    // edges, corners and inner corners are told apart.
    for (const sheet of [made.atlasAnim]) {
      const tiles = Array.from({ length: 24 }, (_, index) => { const x = (index % 4) * 8, y = Math.floor(index / 4) * 8; return Array.from({ length: 64 }, (_, at) => sheet.pixels[(y + (at >> 3)) * sheet.width + x + (at & 7)]); });
      expect(tiles.some((tile) => new Set(tile).size === 1), "a plain minitile").toBe(false);
      expect(distinct(sheet, 24, 4)).toBeGreaterThanOrEqual(13);
    }
  });

  it("puts an RPG Maker wall face together", () => {
    // A wall face: a lone cell is all ends; one with faces either side and above uses the middle of the region.
    expect(atlasWallCell(false, false, false, false, 6)).toEqual([[0, 6], [3, 6], [0, 9], [3, 9]]);
    expect(atlasWallCell(true, true, true, false, 6)).toEqual([[1, 7], [2, 7], [1, 9], [2, 9]]);
  });
});
