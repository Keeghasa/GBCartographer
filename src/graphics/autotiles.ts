/**
 * Auto-tile templates (the author, 2026-10-10): placeholder sheets laid out the way GB Cartographer's 9 and W
 * stamps read them (src/app/autotile.ts), to try the auto-tiles and to repaint as real art later.
 * - Box (9): 3 × 3 tiles, corners, edges and middle.
 * - Wang (W): the 47-tile blob sheet, 8 × 6 tiles, one tile per neighbour shape in mask order; drawn as the cave
 *   style: a dark wall (shade 2) with a white outline (shade 0) where it meets open ground, the 48th slot black.
 */
import { E, N, NE, NW, S, SE, SW, W, WANG_COLUMNS, WANG_MASKS, WANG_ROWS } from "../app/autotile";
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
