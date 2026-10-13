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
import { canvas, CLEAR, Pen, type Canvas } from "./pen";

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

/** Wall face: floor, nothing; then the wall's face, one tile tall, as middle, left end, right end, both ends (no top). */
export function wallFaceTemplate(): Canvas {
  const out = canvas(32, 16, 3), p = new Pen(out);
  const floor = p.at(0, 0, 8); floor.fill(1); floor.dot(2, 5, 0); floor.dot(6, 2, 0);
  p.at(8, 0, 8).fill(3);
  // The two spare slots: a cross, so they never pass for nothing.
  for (const x of [16, 24]) { const t = p.at(x, 0, 8); t.fill(3); t.line(1, 1, 6, 6, 1); t.line(6, 1, 1, 6, 1); }
  [0, 1, 2, 3].forEach((end) => {
    const t = p.at(end * 8, 8, 8);
    t.fill(2);
    t.rect(0, 7, 8, 1, 0); t.rect(1, 3, 6, 1, 1);
    if (end === 1 || end === 3) t.rect(0, 0, 1, 8, 0);
    if (end === 2 || end === 3) t.rect(7, 0, 1, 8, 0);
  });
  return out;
}

/** Animated tile: water in four frames of 16 × 16 side by side, the wave crests drifting along. */
export function animTemplate(): Canvas {
  const out = canvas(64, 16, 1), p = new Pen(out);
  for (let frame = 0; frame < 4; frame += 1) {
    const t = p.at(frame * 16, 0, 16);
    t.fill(1);
    // Two rows of wave crests drifting right a step each frame (wrapping round the tile), a glint on each.
    for (const [y, shift] of [[4, 0], [11, 8]] as const) for (let k = 0; k < 2; k += 1) {
      const x = (frame * 2 + shift + k * 8) % 16;
      for (let i = 0; i < 4; i += 1) t.dot((x + i) % 16, y, 2);
      t.dot((x + 1) % 16, y - 1, 0); t.dot((x + 2) % 16, y - 1, 0);
    }
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
function atlasBlock(p: Pen, fill: (t: Pen) => void, side: (t: Pen, side: number) => void, notch: (t: Pen, x: number, y: number, dx: number, dy: number) => void) {
  fill(p.at(16, 0, 16));
  const region = p.at(0, 16, 32);
  fill(region);
  for (let s = 0; s < 4; s += 1) side(region, s);
  // RPG Maker's inner-corner tile: the fill with a small hole in the middle, so each minitile is notched at the
  // corner facing the centre (a quarter of a cell takes the opposite minitile, autopaint.ts rpgQuarter).
  const inner = p.at(0, 0, 16);
  fill(inner);
  notch(inner, 7, 7, -1, -1); notch(inner, 8, 7, 1, -1); notch(inner, 7, 8, -1, 1); notch(inner, 8, 8, 1, 1);
}






/**
 * Water in the author's piece style (2026-10-12): a 2 × 3 block in three frames side by side (96 × 48). The body is
 * mid-light with light wave crests that drift a step each frame; where it meets ground, a dark outline with a light
 * foam line inside it, and the outer corners rounded (see-through beyond the curve, so the ground shows).
 */
export function atlasWaterTemplate(): Canvas {
  const out = canvas(32 * 3, 48, 1), p = new Pen(out);
  for (let frame = 0; frame < 3; frame += 1) {
    const block = p.at(frame * 32, 0, 32, 48);
    atlasBlock(block, (t) => {
      t.fill(1);
      for (let y = 3; y < t.h; y += 6) for (let x = ((y / 6) % 2 ? 4 : 0) + frame * 3 - 8; x < t.w + 8; x += 8) { t.dot(x, y, 0); t.rect(x + 1, y - 1, 3, 1, 0); t.dot(x + 4, y, 0); t.rect(x + 1, y + 1, 3, 1, 2); }
    }, (t, s) => { t.side(s, 3); t.side(s, 0, 1); }, (t, x, y, dx, dy) => { t.dot(x, y, 3); t.dot(x + dx, y, 0); t.dot(x, y + dy, 0); t.dot(x + dx, y + dy, 0); });
    // Rounded outer corners: beyond a quarter circle of radius 8 the corner is see-through, the curve outlined.
    const corners: [number, number, number, number][] = [[0, 16, 1, 1], [24, 16, -1, 1], [0, 40, 1, -1], [24, 40, -1, -1]];
    for (const [x0, y0, dx, dy] of corners) for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
      const px = dx > 0 ? x : 7 - x, py = dy > 0 ? y : 7 - y;
      const d = Math.hypot(7.5 - px, 7.5 - py);
      if (d > 8) block.dot(x0 + x, y0 + y, CLEAR);
      else if (d > 7) block.dot(x0 + x, y0 + y, 3);
      else if (d > 6) block.dot(x0 + x, y0 + y, 0);
    }
  }
  return out;
}


// ---- XP-layout templates (the author, 2026-10-12: XP style for everything; autopaint.ts xpCell / xpCliffCell) -------

/** What a pixel is: `depth` pixels in from the nearest open edge (0 the outline), or null beyond a rounded corner. */
type Shader = (depth: number, x: number, y: number) => number;

/**
 * A region of `w` × `h` at (x0, y0) whose open sides (n, e, s, w) are outlined, the corners between two open sides
 * rounded with radius `r`; `notch` corners (0 TL, 1 TR, 2 BL, 3 BR) get an inner corner instead (the two edges of the
 * neighbours meeting there). Textures use x and y modulo 8, so minitiles from anywhere in a sheet join seamlessly.
 */
function xpRegion(out: Canvas, x0: number, y0: number, w: number, h: number, open: { n?: boolean; e?: boolean; s?: boolean; w?: boolean }, shade: Shader, r = 6, notch: number[] = [], inset?: Inset) {
  // `inset`: how far in from an open side the area stops, by the position along that side (a wavy shore); the
  // corners and notches stop `inset.corner` in. Pixels outside are see-through.
  const along = (n: number) => inset ? inset.at(n) : 0, cornerIn = inset?.corner ?? 0;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    let depth = 99;
    if (open.n) depth = Math.min(depth, y - along(x0 + x));
    if (open.s) depth = Math.min(depth, h - 1 - y - along(x0 + x));
    if (open.w) depth = Math.min(depth, x - along(y0 + y));
    if (open.e) depth = Math.min(depth, w - 1 - x - along(y0 + y));
    // Rounded outer corners: inside the r × r corner box, depth is measured from the arc.
    const cx = x < r ? r - (x + 0.5) : x >= w - r ? x + 0.5 - (w - r) : 0, cy = y < r ? r - (y + 0.5) : y >= h - r ? y + 0.5 - (h - r) : 0;
    const roundX = (x < r && open.w) || (x >= w - r && open.e), roundY = (y < r && open.n) || (y >= h - r && open.s);
    if (roundX && roundY && cx > 0 && cy > 0) {
      const d = r - Math.hypot(cx, cy) - cornerIn;
      depth = Math.min(depth, Math.floor(d));
    }
    for (const corner of notch) {
      const nx = corner % 2 ? w - 1 - x : x, ny = corner >= 2 ? h - 1 - y : y;
      depth = Math.min(depth, Math.round(Math.hypot(nx + 0.5, ny + 0.5) - 0.707) - cornerIn);
    }
    if (depth < 0) { out.pixels[(y0 + y) * out.width + x0 + x] = CLEAR; continue; }
    out.pixels[(y0 + y) * out.width + x0 + x] = shade(depth, (x0 + x) % 8, (y0 + y) % 8);
  }
}

/** A shore that stops short of its cell's edge: `at(n)` pixels in at position n along the side, `corner` at corners. */
interface Inset { at: (n: number) => number; corner: number }

/** An XP block (48 × 64) at x0: the lone tile, a plain sample, the inner corners, then the 3 × 3-tile block. */
function xpBlock(out: Canvas, x0: number, shade: Shader, inset?: Inset, r = 6) {
  const all = { n: true, e: true, s: true, w: true };
  xpRegion(out, x0, 0, 16, 16, all, shade, r, [], inset);
  xpRegion(out, x0 + 16, 0, 16, 16, {}, shade, r, [], inset);
  xpRegion(out, x0 + 32, 0, 16, 16, {}, shade, r, [0, 1, 2, 3], inset);
  xpRegion(out, x0, 16, 48, 48, all, shade, r, [], inset);
}

/** XP ground (48 × 64): a dirt patch, outlined dark with a mid band inside, specks on the fill. */
export function xpGroundTemplate(): Canvas {
  const out = canvas(48, 64, CLEAR);
  xpBlock(out, 0, (depth, x, y) => depth === 0 ? 3 : depth === 1 ? 2 : (x === 2 && y === 2) || (x === 6 && y === 5) ? 2 : (x === 5 && y === 1) ? 0 : 1);
  return out;
}

/**
 * XP water (144 × 64): three frames of the block side by side, a dark outline with foam inside, crests drifting. The
 * shore stops short of the cell's edge with a gentle ripple along it (the author, 2026-10-12: wiggling side to side,
 * not in and out): 2–4 px in, repeating every 8 px (so cells join), the ripple moving 3 px along the shore each frame;
 * corners rounded 3 px in.
 */
export function xpWaterTemplate(): Canvas {
  const out = canvas(144, 64, CLEAR);
  for (let frame = 0; frame < 3; frame += 1) {
  const shore: Inset = { at: (n) => 3 + Math.round(Math.sin((n + frame * 3) * Math.PI / 4)), corner: 3 };
  const water: Shader = (depth, x, y) => {
    if (depth === 0) return 3;
    if (depth === 1) return 0;
    const crest = (x - frame * 3 + 16 + (y >= 4 ? 4 : 0)) % 8;
    return (y === 2 || y === 6) && crest < 3 ? 0 : (y === 3 || y === 7) && crest < 3 ? 2 : 1;
  };
  xpBlock(out, frame * 48, water, shore, 7);
  // The lone pond (one cell on its own): a round pool about 6 px across the middle, its rim wobbling a little as the
  // frames play, like the shore.
  for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 8, angle = Math.atan2(dy, dx);
    const depth = Math.floor(6.2 + 0.45 * Math.sin(angle * 4 + frame * 2.1) - Math.hypot(dx, dy));
    out.pixels[y * out.width + frame * 48 + x] = depth < 0 ? CLEAR : water(depth, (frame * 48 + x) % 8, y % 8);
  }
  }
  // Where the shore steps in or out, the outline turns the corner too: a water pixel beside see-through (within its
  // own 8 × 8 piece, so pieces never outline each other's edges) is outline.
  const before = out.pixels.slice(), at = (x: number, y: number) => before[y * out.width + x];
  for (let y = 0; y < out.height; y += 1) for (let x = 0; x < out.width; x += 1) {
    if (at(x, y) === CLEAR) continue;
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (x + dx) >> 3 === x >> 3 && (y + dy) >> 3 === y >> 3 && x + dx >= 0 && y + dy >= 0 && at(x + dx, y + dy) === CLEAR);
    if (beside) out.pixels[y * out.width + x] = 3;
  }
  return out;
}

/**
 * XP cliff (48 × 80, read by autopaint.ts xpCliffCell), in the author's wireframe (2026-10-12): a light plateau top
 * (shade 0) outlined dark, a mid face (shade 1) under it, and a dark-green band (shade 2, 8 px, outlined on both
 * sides) down the open sides, its ends cut at 45°. Rows 0–3 the plateau (column 0 / 5 the band, columns 1–4 the top),
 * rows 4–5 the face, (0, 6) / (3, 6) where a band above ends into a wider plateau, (0, 8) / (3, 8) a band's cut top
 * beside a face, (4..5, 8..9) a lone mound. Unused minitiles stay see-through.
 */
export function xpCliffTemplate(): Canvas {
  const out = canvas(48, 80, CLEAR);
  /** Draws minitile (column, row) pixel by pixel; `right` mirrors x so one rule draws both sides. */
  const tile = (column: number, row: number, shade: (x: number, y: number) => number, right = false) => {
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) out.pixels[(row * 8 + y) * 48 + column * 8 + x] = shade(right ? 7 - x : x, y);
  };
  // The plateau top's specks: an all-blank tile never reads as part of the cliff (usePainting sheetKeys), so every
  // piece of the top carries two, and painted cells are still recognised when their neighbours are redrawn.
  const speck = (x: number, y: number) => (x === 2 && y === 5) || (x === 5 && y === 2) ? 1 : 0;
  // The band, seen from its open side: x 0 the outer outline, x 7 the inner one. `cut` cuts its top (or bottom) at 45°.
  const band = (cut: "top" | "bottom" | null, beyond = CLEAR) => (x: number, y: number) => {
    const d = cut === "top" ? x + y : cut === "bottom" ? x + 7 - y : 99;
    if (d < 7) return beyond === CLEAR ? CLEAR : y === 0 ? 3 : beyond;
    if (d === 7 || x === 0 || x === 7) return 3;
    return 2;
  };
  for (const right of [false, true]) {
    const column = right ? 5 : 0;
    tile(column, 0, band("top"), right);
    for (const row of [1, 2, 3, 4]) tile(column, row, band(null), right);
    tile(column, 5, band("bottom"), right);
    // Where a band above ends into a wider plateau: its foot cut at 45° from the plateau's top edge (y 0, the outer
    // side) down to the band's inner outline, so the plateau's top outline runs into it.
    tile(right ? 3 : 0, 6, (x, y) => x === y || (x === 7 && y < 7) ? 3 : x > y ? 2 : speck(x, y), right);
    // A band's cut top beside a face: the face shows above the cut, its top outline running on to the band.
    tile(right ? 3 : 0, 8, band("top", 1), right);
  }
  for (let column = 1; column <= 4; column += 1) {
    tile(column, 0, (x, y) => y === 0 ? 3 : speck(x, y));
    for (const row of [1, 2, 3]) tile(column, row, speck);
    tile(column, 4, (_x, y) => y === 0 ? 3 : 1);
    tile(column, 5, (_x, y) => y === 7 ? 3 : 1);
  }
  // The lone mound: a light cap over a mid face, corners cut.
  for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
    const ex = Math.min(x, 15 - x), ey = Math.min(y, 15 - y), d = ex + ey;
    out.pixels[(64 + y) * 48 + 32 + x] = d < 3 ? CLEAR : d === 3 || ex === 0 || ey === 0 || y === 9 ? 3 : y < 9 ? 0 : 1;
  }
  return out;
}
