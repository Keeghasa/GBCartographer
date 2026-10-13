/**
 * A project picture's unsaved changes as a file in the project (Cartographer/unsaved, server/own.ts; the author's
 * pick, 2026-10-12), so "Save to GB Cartographer only" travels with the project to another computer. The picture's
 * pixels, tile palettes, priority flags, collisions and draft layer, typed arrays as base64. Undo history and which
 * tabs were open stay per computer (the browser's session).
 */
import type { Palette } from "../paint";
import type { Doc } from "./model";

export interface UnsavedPicture {
  format: 1;
  name: string; width: number; height: number; resized?: boolean;
  pixels: string; cells: string; priority?: string;
  palettes: Palette[];
  /** Each scene's collisions, by scene file (a background in scenes). */
  collisions?: { file: string; values: string }[];
  draft?: { pixels: string; cells: string };
  /** The picture file's time when it was opened: a newer file means it changed since (Save asks first). */
  assetMtime: number;
  savedAt: number;
}

export function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
}

export function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let at = 0; at < raw.length; at += 1) bytes[at] = raw.charCodeAt(at);
  return bytes;
}

/** The picture as it is now (a floating piece already dropped by the caller). */
export function unsavedOf(doc: Doc): UnsavedPicture {
  return {
    format: 1, name: doc.name, width: doc.width, height: doc.height, ...(doc.resized ? { resized: true } : {}),
    pixels: toBase64(doc.pixels), cells: toBase64(doc.cells), ...(doc.priority ? { priority: toBase64(doc.priority) } : {}),
    palettes: doc.palettes.map((palette) => ({ ...palette, colors: [...palette.colors] })),
    ...(doc.collision ? { collisions: doc.collision.scenes.map((scene) => ({ file: scene.file, values: toBase64(scene.values) })) } : {}),
    ...(doc.draft ? { draft: { pixels: toBase64(doc.draft.pixels), cells: toBase64(doc.draft.cells) } } : {}),
    assetMtime: doc.asset?.mtime ?? 0, savedAt: Date.now(),
  };
}

/** Puts kept changes on a picture just opened from its file; false when they don't fit it (another size, damaged). */
export function applyUnsaved(doc: Doc, kept: UnsavedPicture): boolean {
  try {
    const pixels = fromBase64(kept.pixels), cells = fromBase64(kept.cells);
    if (pixels.length !== kept.width * kept.height) return false;
    Object.assign(doc, { width: kept.width, height: kept.height, pixels, cells, palettes: kept.palettes.map((palette) => ({ ...palette, colors: [...palette.colors] })), dirty: true, sel: null, float: null, undo: [], redo: [], ...(kept.resized ? { resized: true } : {}) });
    if (kept.priority) doc.priority = fromBase64(kept.priority);
    if (kept.collisions && doc.collision) for (const scene of doc.collision.scenes) {
      const values = kept.collisions.find((item) => item.file === scene.file)?.values;
      if (values) scene.values = fromBase64(values);
    }
    if (kept.draft) doc.draft = { pixels: fromBase64(kept.draft.pixels), cells: fromBase64(kept.draft.cells) };
    return true;
  } catch {
    return false;
  }
}

/** A quick fingerprint of what would be written, so an unchanged picture isn't written again. */
export function fingerprint(doc: Doc): string {
  let hash = 2166136261;
  const mix = (bytes: Uint8Array) => { for (let at = 0; at < bytes.length; at += 1) hash = Math.imul(hash ^ bytes[at], 16777619); };
  mix(doc.pixels); mix(doc.cells);
  if (doc.priority) mix(doc.priority);
  if (doc.draft) { mix(doc.draft.pixels); mix(doc.draft.cells); }
  for (const scene of doc.collision?.scenes ?? []) mix(scene.values);
  return `${doc.width}x${doc.height}:${hash >>> 0}:${JSON.stringify(doc.palettes.map((palette) => palette.colors))}`;
}
