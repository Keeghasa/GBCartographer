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

/** Path: a road (shade 1) on grass (0), joining the tile's sides its mask names, edged in 3 wherever it meets grass. */
export function pathTemplate(): Canvas {
  return sheet16((t, mask) => {
    t.fill(0);
    t.rect(2, 2, 4, 4, 1);
    if (mask & EDGE_N) t.rect(2, 0, 4, 2, 1);
    if (mask & EDGE_S) t.rect(2, 6, 4, 2, 1);
    if (mask & EDGE_W) t.rect(0, 2, 2, 4, 1);
    if (mask & EDGE_E) t.rect(6, 2, 2, 4, 1);
    // Grass next to road becomes its edge, so every arm is edged along its length.
    const road = (x: number, y: number) => x >= 0 && y >= 0 && x < 8 && y < 8 && t.get(x, y) === 1;
    const edge: [number, number][] = [];
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) if (!road(x, y) && (road(x - 1, y) || road(x + 1, y) || road(x, y - 1) || road(x, y + 1))) edge.push([x, y]);
    for (const [x, y] of edge) t.dot(x, y, 3);
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

/**
 * Overworld shore (C), in the overworld generator's look: grass (0) and water (1, a wave in 2) by corner, with a dark
 * shoreline (3) along the water's edge inside each tile. The generator's Shores draws its water with it.
 */
export function shoreTemplate(): Canvas {
  return sheet16((t, mask) => {
    const water = (x: number, y: number) => Boolean(mask & (y < 4 ? (x < 4 ? CORNER_NW : CORNER_NE) : (x < 4 ? CORNER_SW : CORNER_SE)));
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) t.dot(x, y, water(x, y) ? 1 : 0);
    if (mask & CORNER_NW) t.rect(1, 2, 2, 1, 2);
    if (mask & CORNER_SE) t.rect(5, 6, 2, 1, 2);
    if (!(mask & CORNER_NW)) t.dot(1, 1, 1);
    if (!(mask & CORNER_SE)) t.dot(6, 5, 1);
    // The shoreline: water next to grass (inside the tile) turns dark.
    const edge: [number, number][] = [];
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
      if (!water(x, y)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && x + dx < 8 && y + dy >= 0 && y + dy < 8 && !water(x + dx, y + dy))) edge.push([x, y]);
    }
    for (const [x, y] of edge) t.dot(x, y, 3);
  }, 0);
}

/** Overworld road (P), in the overworld generator's look: a dirt band (1) with pebbles (2) on grass (0), no edging. */
export function roadTemplate(): Canvas {
  return sheet16((t, mask) => {
    t.fill(0);
    t.rect(2, 2, 4, 4, 1);
    if (mask & EDGE_N) t.rect(2, 0, 4, 2, 1);
    if (mask & EDGE_S) t.rect(2, 6, 4, 2, 1);
    if (mask & EDGE_W) t.rect(0, 2, 2, 4, 1);
    if (mask & EDGE_E) t.rect(6, 2, 2, 4, 1);
    t.dot(3, 3, 2); t.dot(5, 4, 2);
    if (!mask) t.box(2, 2, 4, 4, 2);
  }, 0);
}

// ---- Atlas (RPG Maker-style) templates, the author's ask 2026-10-12: our own wireframes in that layout ---------------

/**
 * A 2 × 3 Atlas block (autotile.ts): `fill` paints the ground over any box; `side` draws one edge (0 top, 1 right,
 * 2 bottom, 3 left) along a box's side. Rows 1–2: a 32 × 32 region with all four edges; row 0 left: the inner-corner
 * tile (each minitile with the two edges that meet at its outer corner); row 0 right: the plain sample.
 */
function atlasBlock(p: Pen, fill: (t: Pen) => void, side: (t: Pen, side: number) => void, mark = 3) {
  fill(p.at(16, 0, 16));
  const region = p.at(0, 16, 32);
  fill(region);
  for (let s = 0; s < 4; s += 1) side(region, s);
  const inner = p.at(0, 0, 16);
  fill(inner);
  side(inner.at(0, 0, 8), 0); side(inner.at(0, 0, 8), 3);
  side(inner.at(8, 0, 8), 0); side(inner.at(8, 0, 8), 1);
  side(inner.at(0, 8, 8), 2); side(inner.at(0, 8, 8), 3);
  side(inner.at(8, 8, 8), 2); side(inner.at(8, 8, 8), 1);
  // A dot just inside each inner corner tells it from the outer corner (the same two edges meet there).
  inner.dot(2, 2, mark); inner.dot(13, 2, mark); inner.dot(2, 13, mark); inner.dot(13, 13, mark);
}

const dots = (t: Pen, shade: number, step = 5) => { for (let y = 1; y < t.h; y += step) for (let x = (y / step) % 2 ? 3 : 1; x < t.w; x += step) t.dot(x, y, shade); };
const thinSide = (shade: number) => (t: Pen, s: number) => t.side(s, shade);

/** Atlas grass: light ground with dots, a dark edge. */
export function atlasGrassTemplate(): Canvas {
  const out = canvas(32, 48, 0), p = new Pen(out);
  atlasBlock(p, (t) => { t.fill(0); dots(t, 1); }, thinSide(3));
  return out;
}

/** Atlas floor: paving (a 4 px grid of lines) with a dark edge, for interiors. */
export function atlasFloorTemplate(): Canvas {
  const out = canvas(32, 48, 1), p = new Pen(out);
  atlasBlock(p, (t) => { t.fill(1); for (let y = 0; y < t.h; y += 8) t.rect(0, y + 7, t.w, 1, 2); for (let x = 0; x < t.w; x += 8) t.rect(x + 7, 0, 1, t.h, 2); }, thinSide(3));
  return out;
}

/** Atlas mountain ledge: grass on top, a cliff face three pixels tall below its bottom edge, thin edges elsewhere. */
export function atlasLedgeTemplate(): Canvas {
  const out = canvas(32, 48, 0), p = new Pen(out);
  atlasBlock(p, (t) => { t.fill(0); dots(t, 1); }, (t, s) => {
    if (s !== 2) { t.side(s, 3); return; }
    t.rect(0, t.h - 3, t.w, 3, 2);
    t.rect(0, t.h - 1, t.w, 1, 3);
    for (let x = 1; x < t.w; x += 4) t.dot(x, t.h - 2, 3);
  });
  return out;
}

/** Atlas forest edge: canopy (round dark blobs) inside, a two-pixel dark border where it meets open ground. */
export function atlasForestTemplate(): Canvas {
  const out = canvas(32, 48, 1), p = new Pen(out);
  atlasBlock(p, (t) => { t.fill(1); for (let y = 0; y < t.h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < t.w; x += 8) { t.round(x + 1, y + 1, 6, 6, 2, 2); t.dot(x + 2, y + 2, 0); } }, (t, s) => { t.side(s, 3); t.side(s, 3, 1); });
  return out;
}

/** Atlas water: three blocks side by side, the waves (dark dashes and a light glint) moving a step each frame; a dark shoreline. */
export function atlasWaterTemplate(): Canvas {
  const out = canvas(32 * 3, 48, 1), p = new Pen(out);
  for (let frame = 0; frame < 3; frame += 1) {
    atlasBlock(p.at(frame * 32, 0, 32, 48), (t) => {
      t.fill(1);
      for (let y = 2; y < t.h; y += 6) for (let x = ((y / 6) % 2 ? 4 : 0) + frame * 2; x < t.w + 8; x += 8) { t.rect(x - 8, y, 3, 1, 2); t.rect(x, y, 3, 1, 2); t.dot(x + 1, y - 1, 0); t.dot(x - 7, y - 1, 0); }
    }, thinSide(3));
  }
  return out;
}

/** Atlas wall: a roof block (shingles) over a 2 × 2-tile wall region (bricks) with its edges, 32 × 80. */
export function atlasWallTemplate(): Canvas {
  const out = canvas(32, 80, 2), p = new Pen(out);
  atlasBlock(p.at(0, 0, 32, 48), (t) => { t.fill(2); for (let y = 3; y < t.h; y += 4) t.rect(0, y, t.w, 1, 3); for (let y = 0; y < t.h; y += 4) for (let x = (y / 4) % 2 ? 4 : 0; x < t.w; x += 8) t.dot(x, y + 1, 0); }, thinSide(0), 0);
  const face = p.at(0, 48, 32);
  face.fill(1);
  for (let y = 0; y < 32; y += 4) { face.rect(0, y + 3, 32, 1, 2); for (let x = (y / 4) % 2 ? 4 : 0; x < 32; x += 8) face.rect(x + 3, y, 1, 3, 2); }
  for (let s = 0; s < 4; s += 1) face.side(s, 3);
  face.rect(0, 0, 32, 1, 0);
  return out;
}
