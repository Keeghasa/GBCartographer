/**
 * Tile budget fixer steps (W6): the near-duplicate tile merges a picture could take, cheapest first, and applying
 * them one at a time or all in one go. Pure: nothing here draws or keeps state.
 */
import { CLEAR, countUniqueTiles } from "../paint";

const CELL = 8;

/**
 * One candidate merge: tile `from` (used once) would become a copy of tile `into`; `diff` pixels differ. `flip`
 * (Color Only scenes, the author, 2026-11-02) copies `into` mirrored: 1 left-right, 2 upside down, 3 both.
 */
export interface MergeStep { from: number; into: number; diff: number; flip?: number }

/** Where a tile's pixel (x, y) comes from when copied with `flip`. */
const flipped = (x: number, y: number, flip = 0) => (flip & 2 ? 7 - y : y) * CELL + (flip & 1 ? 7 - x : x);

/**
 * The candidate merges at most `maxDiff` pixels apart, fewest differences first (then in reading order). Tiles are
 * cell indexes, row by row. Two used-once tiles that are each other's nearest are listed once (both would swap).
 * With `flips` (Color Only: flipped copies count once, as GB Studio counts them) mirrored copies are one pattern,
 * and a tile also matches another's mirror images, so the merge copies it flipped. The twin is the most used close
 * pattern, unflipped first.
 */
export function mergeSteps(pixels: Uint8Array, width: number, height: number, flips: boolean, maxDiff: number): MergeStep[] {
  const cw = Math.ceil(width / CELL), count = cw * Math.ceil(height / CELL);
  const tiles = Array.from({ length: count }, (_, cell) => tilePixels(pixels, width, height, cell));
  const orientations = flips ? [0, 1, 2, 3] : [0];
  const key = (tile: Uint8Array, flip: number) => { let text = ""; for (let at = 0; at < 64; at += 1) text += tile[flipped(at % CELL, at >> 3, flip)]; return text; };
  // Each cell's pattern: the first cell with the same tile (or a flip of it, with `flips`).
  const ids = new Int32Array(count), first = new Map<string, number>(), total = new Map<number, number>();
  tiles.forEach((tile, cell) => {
    let id: number | undefined;
    for (const flip of orientations) { id = first.get(key(tile, flip)); if (id !== undefined) break; }
    if (id === undefined) { id = cell; first.set(key(tile, 0), cell); }
    ids[cell] = id;
    total.set(id, (total.get(id) ?? 0) + 1);
  });
  const steps: MergeStep[] = [];
  for (let cell = 0; cell < count; cell += 1) {
    if (total.get(ids[cell])! > 1) continue;
    let best: MergeStep | null = null, bestUses = 0;
    for (const [other, uses] of total) {
      if (other === ids[cell]) continue;
      for (const flip of orientations) {
        let differs = 0;
        for (let at = 0; at < 64 && differs <= maxDiff; at += 1) if (tiles[cell][at] !== tiles[other][flipped(at % CELL, at >> 3, flip)]) differs += 1;
        if (differs > maxDiff) continue;
        if (!best || differs < best.diff || (differs === best.diff && uses > bestUses)) { best = { from: cell, into: other, diff: differs, ...(flip ? { flip } : {}) }; bestUses = uses; }
      }
    }
    if (best) steps.push(best);
  }
  steps.sort((a, b) => a.diff - b.diff || a.from - b.from);
  const listed = new Set<string>();
  return steps.filter((step) => {
    if (listed.has(`${step.into}>${step.from}`)) return false;
    listed.add(`${step.from}>${step.into}`);
    return true;
  });
}

/** Copies tile `into` (flipped as the step says) over tile `from` (8 × 8, clipped at the picture's edges), in place. */
export function applyMerge(pixels: Uint8Array, width: number, step: MergeStep) {
  const height = pixels.length / width, cw = Math.ceil(width / CELL);
  const tx = (step.from % cw) * CELL, ty = Math.floor(step.from / cw) * CELL;
  const sx = (step.into % cw) * CELL, sy = Math.floor(step.into / cw) * CELL;
  const source = tilePixels(pixels, width, height, step.into);
  for (let y = 0; y < CELL; y += 1) for (let x = 0; x < CELL; x += 1) {
    const at = flipped(x, y, step.flip);
    if (tx + x >= width || ty + y >= height || sx + (at % CELL) >= width || sy + (at >> 3) >= height) continue;
    pixels[(ty + y) * width + tx + x] = source[at];
  }
}

/** What tile `from` becomes after the step: tile `into`'s 64 pixels, flipped as the step says. */
export function stepTile(pixels: Uint8Array, width: number, height: number, step: MergeStep): Uint8Array {
  const source = tilePixels(pixels, width, height, step.into);
  return Uint8Array.from({ length: 64 }, (_, at) => source[flipped(at % CELL, at >> 3, step.flip)]);
}

/**
 * Applies several steps in order, in place, skipping any that would copy from a tile already changed here or change
 * a tile already copied from (chains would undo each other's saving). Returns how many were applied.
 */
export function applyMerges(pixels: Uint8Array, width: number, steps: readonly MergeStep[]): number {
  const changed = new Set<number>(), sources = new Set<number>();
  let applied = 0;
  for (const step of steps) {
    if (changed.has(step.into) || sources.has(step.from) || changed.has(step.from)) continue;
    applyMerge(pixels, width, step);
    changed.add(step.from);
    sources.add(step.into);
    applied += 1;
  }
  return applied;
}

/** What "Fix all" reached: how many tiles it merged, the unique count after, and whether that is at most the target. */
export interface FixAll { merged: number; count: number; reached: boolean }

/**
 * Fix all in one go (the author, 2026-11-02): merges near tiles, closest first, in place, until the picture has at
 * most `target` unique tiles. Starts at 1 differing pixel and allows more only when nothing closer is left, up to
 * `maxDiff`; each round lists the merges afresh, so chains never undo each other. Stops early when nothing is left
 * to merge (every tile shared, or none within `maxDiff`).
 */
export function fixAll(pixels: Uint8Array, width: number, height: number, flips: boolean, target: number, maxDiff = 64): FixAll {
  let count = countUniqueTiles(pixels, width, height, flips), merged = 0;
  for (let diff = 1; diff <= maxDiff && count > target; diff += 1) {
    for (;;) {
      const steps = mergeSteps(pixels, width, height, flips, diff);
      if (!steps.length) break;
      // A merge saves one tile at most: take just enough, then count again.
      const applied = applyMerges(pixels, width, steps.slice(0, count - target));
      if (!applied) break;
      merged += applied;
      const next = countUniqueTiles(pixels, width, height, flips);
      const stalled = next >= count;
      count = next;
      if (count <= target || stalled) break;
    }
  }
  return { merged, count, reached: count <= target };
}

/** A tile's 64 pixels, row by row; the part past the picture's edge is see-through. */
export function tilePixels(pixels: Uint8Array, width: number, height: number, tile: number): Uint8Array {
  const cw = Math.ceil(width / CELL), tx = (tile % cw) * CELL, ty = Math.floor(tile / cw) * CELL;
  const out = new Uint8Array(CELL * CELL).fill(CLEAR);
  for (let y = 0; y < CELL; y += 1) for (let x = 0; x < CELL; x += 1) {
    if (tx + x < width && ty + y < height) out[y * CELL + x] = pixels[(ty + y) * width + tx + x];
  }
  return out;
}
