/**
 * Auto-tile templates (the author, 2026-10-10): placeholder sheets laid out the way GB Cartographer's 9 and W
 * stamps read them (src/app/autotile.ts), to try the auto-tiles and to repaint as real art later.
 * - Box (9): 3 × 3 tiles, corners, edges and middle.
 * - Wang (W): the 47-tile blob sheet, 8 × 6 tiles, one tile per neighbour shape in mask order; drawn as the cave
 *   style: a dark wall (shade 2) with a white outline (shade 0) where it meets open ground, the 48th slot black.
 * - 3-slice across (↔) and down (↕), Path (P), Wang edges (E), Corner Wang (C), Wall face (F), Animated tile (▶):
 *   laid out as src/app/autotile.ts reads them. Every tile of a sheet that painting recognises is different.
 */
import { CORNER_NE, CORNER_NW, CORNER_SE, CORNER_SW, E, EDGE_E, EDGE_N, EDGE_S, EDGE_W, N, NE, NW, S, SE, SW, W, WANG_COLUMNS, WANG_MASKS, WANG_ROWS } from "../app/autotile";
import { canvas, Pen, type Canvas } from "./pen";

export function wangTemplate(): Canvas {
  const out = canvas(WANG_COLUMNS * 8, WANG_ROWS * 8, 3), p = new Pen(out);
  WANG_MASKS.forEach((mask, index) => {
    const t = p.at((index % WANG_COLUMNS) * 8, Math.floor(index / WANG_COLUMNS) * 8, 8);
    t.fill(2);
    // Open sides: a white outline.
    if (!(mask & N)) t.rect(0, 0, 8, 1, 0);
    if (!(mask & S)) t.rect(0, 7, 8, 1, 0);
    if (!(mask & W)) t.rect(0, 0, 1, 8, 0);
    if (!(mask & E)) t.rect(7, 0, 1, 8, 0);
    // Inside corners: both sides filled, the corner open.
    if (mask & N && mask & E && !(mask & NE)) t.dot(7, 0, 0);
    if (mask & S && mask & E && !(mask & SE)) t.dot(7, 7, 0);
    if (mask & S && mask & W && !(mask & SW)) t.dot(0, 7, 0);
    if (mask & N && mask & W && !(mask & NW)) t.dot(0, 0, 0);
    // A mark in the middle tells the tiles apart while testing: the count of filled sides.
    const sides = [N, E, S, W].filter((bit) => mask & bit).length;
    for (let i = 0; i < sides; i += 1) t.dot(2 + i, 4, 1);
  });
  return out;
}

export function boxTemplate(): Canvas {
  const out = canvas(24, 24, 1), p = new Pen(out);
  p.box(0, 0, 24, 24, 3);
  p.box(1, 1, 22, 22, 0);
  // Corners marked, edges dashed, the middle dotted: easy to see what repeats.
  for (const [x, y] of [[2, 2], [20, 2], [2, 20], [20, 20]]) p.rect(x, y, 2, 2, 2);
  for (let i = 10; i < 14; i += 2) { p.dot(i, 3, 2); p.dot(i, 20, 2); p.dot(3, i, 2); p.dot(20, i, 2); }
  p.dot(11, 11, 2); p.dot(12, 12, 2);
  return out;
}

/** 3-slice across: a fence, 3 × 2 tiles (left post, rails, right post). */
export function acrossTemplate(): Canvas {
  const out = canvas(24, 16, 0), p = new Pen(out);
  p.rect(0, 5, 24, 2, 3); p.rect(0, 10, 24, 2, 3);
  p.panel(1, 2, 5, 13, 1); p.panel(18, 2, 5, 13, 1);
  p.dot(12, 6, 2); p.dot(12, 11, 2);
  return out;
}

/** 3-slice down: a ladder, 2 × 3 tiles (top, rungs, foot). */
export function downTemplate(): Canvas {
  const out = canvas(16, 24, 0), p = new Pen(out);
  p.rect(3, 0, 2, 24, 3); p.rect(11, 0, 2, 24, 3);
  for (let y = 3; y < 24; y += 4) p.rect(5, y, 6, 1, 2);
  p.rect(1, 0, 14, 2, 3); p.rect(1, 22, 14, 2, 2);
  return out;
}

/** The 16 four-bit tiles: `draw(tile, mask)` for each mask 0–15, in a 4 × 4 sheet. */
function sheet16(draw: (t: Pen, mask: number) => void, fill: number): Canvas {
  const out = canvas(32, 32, fill), p = new Pen(out);
  for (let mask = 0; mask < 16; mask += 1) draw(p.at((mask % 4) * 8, Math.floor(mask / 4) * 8, 8), mask);
  return out;
}

/** Path: a road (shade 1, edged in 3) on grass (0), joining the tile's sides its mask names. */
export function pathTemplate(): Canvas {
  return sheet16((t, mask) => {
    t.fill(0);
    t.rect(2, 2, 4, 4, 1);
    if (mask & EDGE_N) t.rect(2, 0, 4, 2, 1);
    if (mask & EDGE_S) t.rect(2, 6, 4, 2, 1);
    if (mask & EDGE_W) t.rect(0, 2, 2, 4, 1);
    if (mask & EDGE_E) t.rect(6, 2, 2, 4, 1);
    // Edges of the road: dark where it stops.
    if (!(mask & EDGE_N)) t.rect(2, 1, 4, 1, 3);
    if (!(mask & EDGE_S)) t.rect(2, 6, 4, 1, 3);
    if (!(mask & EDGE_W)) t.rect(1, 2, 1, 4, 3);
    if (!(mask & EDGE_E)) t.rect(6, 2, 1, 4, 3);
  }, 0);
}

/** Wang edges: the cave wall (shade 2) outlined in white (0) on every side that isn't more wall. */
export function edgesTemplate(): Canvas {
  return sheet16((t, mask) => {
    t.fill(2);
    if (!(mask & EDGE_N)) t.rect(0, 0, 8, 1, 0);
    if (!(mask & EDGE_S)) t.rect(0, 7, 8, 1, 0);
    if (!(mask & EDGE_W)) t.rect(0, 0, 1, 8, 0);
    if (!(mask & EDGE_E)) t.rect(7, 0, 1, 8, 0);
    t.dot(3, 3, 1);
  }, 2);
}

/** Corner Wang: grass (0, dotted) and water (2, rippled), each 4 × 4 quarter the ground of its corner. */
export function cornerTemplate(): Canvas {
  return sheet16((t, mask) => {
    const quarter = (x: number, y: number, water: boolean) => {
      t.rect(x, y, 4, 4, water ? 2 : 0);
      if (water) t.rect(x + 1, y + 2, 2, 1, 1); else t.dot(x + 1, y + 1, 1);
    };
    quarter(0, 0, Boolean(mask & CORNER_NW)); quarter(4, 0, Boolean(mask & CORNER_NE));
    quarter(0, 4, Boolean(mask & CORNER_SW)); quarter(4, 4, Boolean(mask & CORNER_SE));
  }, 0);
}

/** Wall face: floor, nothing; the upper and lower wall rows as middle, left end, right end, both ends. */
export function wallFaceTemplate(): Canvas {
  const out = canvas(32, 24, 3), p = new Pen(out);
  const floor = p.at(0, 0, 8); floor.fill(1); floor.dot(2, 5, 0); floor.dot(6, 2, 0);
  p.at(8, 0, 8).fill(3);
  // The two spare slots: a cross, so they never pass for nothing.
  for (const x of [16, 24]) { const t = p.at(x, 0, 8); t.fill(3); t.line(1, 1, 6, 6, 1); t.line(6, 1, 1, 6, 1); }
  [1, 2].forEach((row) => [0, 1, 2, 3].forEach((end) => {
    const t = p.at(end * 8, row * 8, 8);
    t.fill(2);
    t.rect(0, row === 1 ? 0 : 7, 8, 1, 0);
    if (end === 1 || end === 3) t.rect(0, 0, 1, 8, 0);
    if (end === 2 || end === 3) t.rect(7, 0, 1, 8, 0);
  }));
  return out;
}

/** Animated tile: water in four frames of 8 × 8, the ripple moving along. */
export function animTemplate(): Canvas {
  const out = canvas(32, 8, 1), p = new Pen(out);
  for (let frame = 0; frame < 4; frame += 1) {
    const t = p.at(frame * 8, 0, 8);
    t.fill(1);
    t.rect((frame * 2) % 8, 2, 3, 1, 2); t.rect((frame * 2 + 4) % 8, 5, 3, 1, 2);
    t.dot((frame * 2 + 1) % 8, 1, 0);
  }
  return out;
}
