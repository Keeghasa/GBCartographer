/**
 * Collisions a map generator made for a new background (the author, 2026-11-02: "collisions written too"). They live
 * in a GB Studio scene's `collisions`, and a brand-new background is in no scene yet, so they wait here (per
 * computer, by project and file) until GB Studio has put the background in a scene: the next time the background is
 * opened, every scene that shows it with no collisions at all takes them as unsaved collision edits, and Save writes
 * them (the collision brush's own path, only that scene's `collisions` field). A scene that has collisions is never
 * touched.
 */
import { readStored, store } from "./storage";

/** GB Studio's Solid collision tile (all four sides), the same in top-down, platform and shoot-'em-up scenes. */
export const SOLID = 15;

const KEY = "gbc-pending-collisions";
type Kept = Record<string, Record<string, number[]>>;

/** One value per 8 × 8 tile, `tilesWide` a row: the screen at (x0, y0) tiles, `wide` × `tall` tiles of it. */
export function sliceTiles(values: Uint8Array, tilesWide: number, x0: number, y0: number, wide: number, tall: number): Uint8Array {
  const out = new Uint8Array(wide * tall);
  const tilesTall = Math.floor(values.length / tilesWide);
  for (let y = 0; y < tall; y += 1) for (let x = 0; x < wide; x += 1) if (x0 + x < tilesWide && y0 + y < tilesTall) out[y * wide + x] = values[(y0 + y) * tilesWide + x0 + x];
  return out;
}

/** The scene's collisions with the pending ones in, or null when it has collisions of its own (or another size). */
export function withPending(scene: Uint8Array, pending: ArrayLike<number> | undefined): Uint8Array | null {
  if (!pending || pending.length !== scene.length || scene.some((value) => value !== 0) || !Array.prototype.some.call(pending, (value: number) => value !== 0)) return null;
  return Uint8Array.from(pending);
}

export function keepPending(project: string, file: string, values: Uint8Array) {
  const kept = readStored<Kept>(KEY, {});
  store(KEY, { ...kept, [project]: { ...kept[project], [file]: Array.from(values) } });
}

export function pendingFor(project: string, file: string): number[] | undefined {
  return readStored<Kept>(KEY, {})[project]?.[file];
}

export function dropPending(project: string, file: string) {
  const kept = readStored<Kept>(KEY, {});
  if (!kept[project]?.[file]) return;
  const { [file]: _gone, ...rest } = kept[project];
  store(KEY, { ...kept, [project]: rest });
}
