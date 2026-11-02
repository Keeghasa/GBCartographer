/**
 * GB Snapshot's lens and saved views (the author, 2026-11-02), kept free of three.js so the server and the tests
 * can use them.
 * - Orthographic: no perspective, the usual look for top-down and isometric game art. Swapping lens keeps the model
 *   about the same size in the print: the flat view is as tall as the perspective view is at the target's distance.
 * - Saved views: a few named angles per model (camera, target, zoom, lens and the free-rotate turn), so all of one
 *   model's sprites match. Kept in the project beside the model (Cartographer/models/<model>/views.json), or in this
 *   browser for the samples and with no project open.
 */

type Vec3 = [number, number, number];
export interface SavedView {
  name: string;
  position: Vec3; target: Vec3;
  /** The orthographic camera's zoom (1 in perspective). */
  zoom: number;
  ortho: boolean;
  /** Lens, degrees (also sets the flat view's height). */
  fov: number;
  /** The free-rotate turn of the model, a quaternion x, y, z, w (identity: as it came in). */
  pivot: [number, number, number, number];
}

/** At most this many views per model. */
export const VIEW_LIMIT = 24;

/** Half the height of what a perspective lens of `fov` degrees sees at `distance`: the flat view's half height. */
export function orthoHalfHeight(distance: number, fov: number): number {
  return distance * Math.tan((fov * Math.PI) / 360);
}

/** The distance at which a perspective lens of `fov` sees `halfHeight` (the flat view's, after its zoom). */
export function perspectiveDistance(halfHeight: number, fov: number): number {
  return halfHeight / Math.tan((fov * Math.PI) / 360);
}

const numbers = (value: unknown, length: number): number[] | null =>
  Array.isArray(value) && value.length === length && value.every((n) => typeof n === "number" && Number.isFinite(n)) ? value as number[] : null;

/** Only well-formed views, names trimmed and kept short, no more than VIEW_LIMIT (anything else read is dropped). */
export function sanitizeViews(value: unknown): SavedView[] {
  if (!Array.isArray(value)) return [];
  const out: SavedView[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 60) : "";
    const position = numbers(raw.position, 3), target = numbers(raw.target, 3), pivot = numbers(raw.pivot, 4);
    const zoom = typeof raw.zoom === "number" && Number.isFinite(raw.zoom) && raw.zoom > 0 ? raw.zoom : 1;
    const fov = typeof raw.fov === "number" && raw.fov >= 1 && raw.fov <= 179 ? raw.fov : 35;
    if (!name || !position || !target || !pivot) continue;
    out.push({ name, position: position as Vec3, target: target as Vec3, zoom, ortho: raw.ortho === true, fov, pivot: pivot as SavedView["pivot"] });
    if (out.length >= VIEW_LIMIT) break;
  }
  return out;
}

/** Adds a view, replacing one of the same name (in its place). */
export function withView(views: SavedView[], view: SavedView): SavedView[] {
  const at = views.findIndex((old) => old.name === view.name);
  return at < 0 ? [...views, view].slice(-VIEW_LIMIT) : views.map((old, i) => (i === at ? view : old));
}

/** Whether a view has the model turned (free rotate must be on to keep it). */
export const isTurned = (view: SavedView) => Math.abs(Math.abs(view.pivot[3]) - 1) > 1e-6;
