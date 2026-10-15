/**
 * Map Room layout (the author, 2026-10-15: "mosaic maps any way I want"): a map is pieces on a grid of 160 × 144
 * squares. A piece is a background of any size, drawn at its true size from the corner of its square (x, y), moved
 * by (dx, dy) whole 8 px tiles when it was dropped with tile snapping; it takes every square its picture reaches
 * into. Pieces never share a square: dropping one where others are bumps them right, just far enough.
 */
export const W = 160, H = 144, TILE = 8;

export interface MapCell { x: number; y: number; file: string; dx?: number; dy?: number }
export interface Size { width: number; height: number }
export interface Footprint { x: number; y: number; w: number; h: number }

/** The squares a piece takes: from its square, as far as its picture (and tile offset) reaches. */
export function footprint(cell: MapCell, size: Size | undefined): Footprint {
  const width = (cell.dx ?? 0) * TILE + (size?.width ?? W), height = (cell.dy ?? 0) * TILE + (size?.height ?? H);
  return { x: cell.x, y: cell.y, w: Math.max(1, Math.ceil(width / W)), h: Math.max(1, Math.ceil(height / H)) };
}

const overlaps = (a: Footprint, b: Footprint) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The piece taking square (x, y), if any. */
export function occupant(cells: MapCell[], sizeOf: (file: string) => Size | undefined, x: number, y: number): MapCell | undefined {
  return cells.find((cell) => { const f = footprint(cell, sizeOf(cell.file)); return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h; });
}

/**
 * Puts `moving` (a piece already on the map, by reference, or a new one) at its new place, and bumps every piece
 * it lands on to the right, just past it; pieces those land on are bumped in turn. Returns the new list.
 */
export function place(cells: MapCell[], moving: MapCell, at: MapCell, sizeOf: (file: string) => Size | undefined): MapCell[] {
  const placed: MapCell = { ...at, file: moving.file };
  if (!placed.dx) delete placed.dx;
  if (!placed.dy) delete placed.dy;
  const rest = cells.filter((cell) => cell !== moving).map((cell) => ({ ...cell }));
  const settled: MapCell[] = [placed];
  // Left to right, so a bumped piece only ever pushes pieces further right.
  const queue = [...rest].sort((a, b) => a.x - b.x || a.y - b.y);
  for (const cell of queue) {
    const size = sizeOf(cell.file);
    for (let guard = 0; guard < 10000; guard += 1) {
      const mine = footprint(cell, size);
      const hit = settled.map((other) => footprint(other, sizeOf(other.file))).filter((other) => overlaps(mine, other));
      if (!hit.length) break;
      cell.x = Math.max(...hit.map((other) => other.x + other.w));
    }
    settled.push(cell);
  }
  return settled;
}

/** The pieces' bounds in squares (an empty map is the one square 0, 0). */
export function bounds(cells: MapCell[], sizeOf: (file: string) => Size | undefined): Footprint {
  if (!cells.length) return { x: 0, y: 0, w: 1, h: 1 };
  const prints = cells.map((cell) => footprint(cell, sizeOf(cell.file)));
  const x = Math.min(...prints.map((f) => f.x)), y = Math.min(...prints.map((f) => f.y));
  return { x, y, w: Math.max(...prints.map((f) => f.x + f.w)) - x, h: Math.max(...prints.map((f) => f.y + f.h)) - y };
}

/** A piece's top-left in map pixels. */
export const pixelOf = (cell: MapCell) => ({ x: cell.x * W + (cell.dx ?? 0) * TILE, y: cell.y * H + (cell.dy ?? 0) * TILE });

/** Map pixels to a square and a tile offset: whole squares, or (tiles) the nearest 8 px tile inside the square. */
export function snap(px: number, py: number, tiles: boolean): Pick<MapCell, "x" | "y" | "dx" | "dy"> {
  if (!tiles) return { x: Math.round(px / W), y: Math.round(py / H) };
  const tx = Math.round(px / TILE), ty = Math.round(py / TILE);
  const x = Math.floor(tx * TILE / W), y = Math.floor(ty * TILE / H);
  return { x, y, dx: tx - x * (W / TILE), dy: ty - y * (H / TILE) };
}
