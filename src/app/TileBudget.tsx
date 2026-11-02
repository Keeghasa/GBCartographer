/**
 * The tile count and palette slots a wizard's background uses, live (the author, 2026-11-02): one small pair of
 * meters for every wizard that makes a background, red over the limit (192 unique tiles, 384 in a Color Only scene;
 * eight background palette slots), amber within a tenth of it.
 */
import { Meter } from "../ui/kit";

export const PALETTE_SLOTS = 8;

/** How many different palette slots a picture's 8 × 8 cells use (no cells: one). */
export function slotsUsed(cells: ArrayLike<number> | null | undefined): number {
  if (!cells || !cells.length) return 1;
  return new Set(Array.from(cells)).size;
}

export const budgetTone = (value: number, of: number): "bad" | "warn" | undefined => value > of ? "bad" : value > of * 0.9 ? "warn" : undefined;

export function TileBudget({ tiles, limit, slots, label = "Tiles", title }: {
  tiles: number; limit: number;
  /** Palette slots used; left out where the wizard's picture has no palettes. */
  slots?: number;
  label?: string; title?: string;
}) {
  return (
    <>
      <Meter label={label} value={tiles} of={limit} tone={budgetTone(tiles, limit)} title={title ?? `Unique 8 × 8 tiles; GB Studio's limit for one background is ${limit}`} />
      {slots !== undefined && <Meter label="Palettes" value={slots} of={PALETTE_SLOTS} tone={slots > PALETTE_SLOTS ? "bad" : undefined} title="Background palette slots used (a scene has eight)" />}
    </>
  );
}
