/**
 * Keeping each open picture's copy of the project palettes straight (the author's bug, 2026-10-23: a palette edited
 * in the Palettes window came back with its old colors a second later).
 *
 * Every picture holds its own copy of the palettes, so a palette recolored in the sidebar changes that picture alone
 * until Save writes it into the project. The trap: a copy can also go stale through no edit of the user's (an undo
 * step restoring an older list, an unsaved snapshot from another session, GB Studio rewriting a palette file), and
 * a stale copy that merely *differs* from the project must never be written back as if it were an edit. So a copy
 * carries `edited` only when the user recolored it here; only those are written, and every other copy follows the
 * project whenever the project is reread.
 */
import type { Palette } from "../paint";

export interface ProjectPaletteLike { id: string; name: string; colors: readonly string[] }
/** The part of a picture these helpers touch. */
export interface PalettedDoc { palettes: Palette[] }

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((color, at) => color.toUpperCase() === b[at].toUpperCase());

/**
 * The palettes to write into the project when a picture is saved: copies the user recolored here (`edited`) whose
 * colors or name differ from the project's. The active picture's copy wins when several pictures edited the same one.
 */
export function editedPalettes(docs: readonly PalettedDoc[], project: readonly ProjectPaletteLike[], active?: PalettedDoc): { id: string; name: string; colors: string[] }[] {
  const byId = new Map(project.map((item) => [item.id, item]));
  const out = new Map<string, { id: string; name: string; colors: string[] }>();
  for (const doc of [...docs].sort((a, b) => (a === active ? -1 : b === active ? 1 : 0))) {
    for (const own of doc.palettes) {
      const base = own.id ? byId.get(own.id) : undefined;
      if (!own.id || !base || !own.edited || out.has(own.id)) continue;
      if (!same(base.colors, own.colors) || base.name !== own.name) out.set(own.id, { id: own.id, name: own.name, colors: [...own.colors] });
    }
  }
  return [...out.values()];
}

/**
 * After the project was reread: every copy the user didn't recolor here takes the project's colors and name (a
 * palette GB Studio changed, or one written from another picture, shows up everywhere); an edited copy that now
 * matches the project is no longer an edit. Returns how many copies changed.
 */
export function followProject(docs: readonly PalettedDoc[], project: readonly ProjectPaletteLike[]): number {
  const byId = new Map(project.map((item) => [item.id, item]));
  let changed = 0;
  for (const doc of docs) {
    for (const own of doc.palettes) {
      const base = own.id ? byId.get(own.id) : undefined;
      if (!base) continue;
      if (own.edited) { if (same(base.colors, own.colors) && base.name === own.name) delete own.edited; continue; }
      if (same(base.colors, own.colors) && base.name === own.name) continue;
      own.colors = [...base.colors];
      own.name = base.name;
      changed += 1;
    }
  }
  return changed;
}

/**
 * Undo or redo of a recolor: the snapshot's palettes come back by id (by name for palettes without one), never by
 * position (the list may have grown or been reordered since), and a copy that now differs from the project counts
 * as edited again, so the undo can be saved like the recolor could.
 */
export function restorePalettes(doc: PalettedDoc, snapshot: readonly Palette[], project: readonly ProjectPaletteLike[]): void {
  const byId = new Map(project.map((item) => [item.id, item]));
  for (const was of snapshot) {
    const own = doc.palettes.find((item) => (was.id ? item.id === was.id : !item.id && item.name === was.name));
    if (!own) continue;
    own.colors = [...was.colors];
    if (!was.id) { own.name = was.name; continue; }
    const base = byId.get(was.id);
    if (base && !same(base.colors, own.colors)) own.edited = true;
    else delete own.edited;
  }
}
