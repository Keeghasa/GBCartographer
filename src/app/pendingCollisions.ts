/**
 * Collisions a map generator made for a new background (the author, 2026-11-02: "collisions written too"). They live
 * in a GB Studio scene's `collisions`, and a brand-new background is in no scene yet, so they wait in the project's
 * Cartographer/collisions.json (since 2026-11-20, so they travel with it; older ones in this browser move in on first
 * read) until GB Studio has put the background in a scene: the next time the background is
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

const post = (file: string, values: number[] | null) => fetch("./__cartographer/pending-collisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file, values }) });

/** Kept in the open project's Cartographer/collisions.json. Resolves false when it couldn't be written. */
export async function keepPending(_project: string, file: string, values: Uint8Array): Promise<boolean> {
  return (await post(file, Array.from(values)).catch(() => null))?.ok ?? false;
}

/** The open project's pending collisions for a background; this browser's older ones for the project move in first. */
export async function pendingFor(project: string, file: string): Promise<number[] | undefined> {
  const local = readStored<Kept>(KEY, {});
  for (const [name, values] of Object.entries(local[project] ?? {})) {
    if ((await post(name, values).catch(() => null))?.ok) dropLocal(project, name);
  }
  const read = await fetch("./__cartographer/pending-collisions", { cache: "no-cache" }).then((response) => response.ok ? response.json() as Promise<{ collisions?: Record<string, number[]> }> : null).catch(() => null);
  return read?.collisions?.[file];
}

export async function dropPending(_project: string, file: string): Promise<void> {
  await post(file, null).catch(() => null);
}

function dropLocal(project: string, file: string) {
  const kept = readStored<Kept>(KEY, {});
  if (!kept[project]?.[file]) return;
  const { [file]: _gone, ...rest } = kept[project];
  store(KEY, { ...kept, [project]: rest });
}
