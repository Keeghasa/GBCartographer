/**
 * Wireframe tiles: 16 × 16 background pieces (2 × 2 GB tiles) in the four shades, for building scenes and tile
 * sheets. Each draws into a 16 × 16 pen (a tall one 16 × 32). Placeholders to paint over: plain shapes, light ground
 * (shade 0), dark outlines (shade 3). Grouped by where they go: outdoors, indoors, side-view levels.
 */
import type { Canvas, Pen } from "./pen";
import { catalogVersion, pieceOf, sheet } from "./areas";

export interface Tile { name: string; /** Two tiles tall (16 × 32): drawn over the cell below it too. */ tall?: boolean; draw: (p: Pen) => void }

/**
 * A tile copied from a piece of the library's sheets (the author, 2026-10-13: the tile sheets drawn from what we made,
 * the XP grounds and floors, Water XP, Cliff XP), so a scene built from tiles matches one painted with the stamps.
 */
const from = (piece: () => Canvas) => (p: Pen) => { const art = piece(); for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) p.dot(x, y, art.pixels[y * 16 + x]); };
/** An XP block's middle (columns 2–3, rows 4–5): the fill that repeats inside an area. */
const middle = (id: Parameters<typeof sheet>[0]) => from(() => pieceOf(sheet(id), 2, 4));

// ---- shared bits ----------------------------------------------------------------------------------------------------

const bricks = (p: Pen, mortar: number) => {
  for (let y = 3; y < 16; y += 4) p.rect(0, y, 16, 1, mortar);
  for (let row = 0; row < 4; row += 1) for (const x of row % 2 ? [3, 11] : [7, 15]) p.rect(x, row * 4, 1, 3, mortar);
};
const steps = (p: Pen, light: number, line: number) => { p.fill(light); for (let y = 0; y < 16; y += 4) { p.rect(0, y, 16, 1, line); p.rect(0, y + 3, 16, 1, 2); } p.side(1, line); p.side(3, line); };
const flame = (p: Pen, x: number, y: number) => { p.rect(x + 1, y, 1, 1, 3); p.rect(x, y + 1, 3, 3, 1); p.box(x, y + 1, 3, 3, 3); p.dot(x + 1, y + 2, 0); };

// ---- outdoors ---------------------------------------------------------------------------------------------------------

export const OUTDOOR: Record<string, Tile> = {
  grass: { name: "Grass", draw: middle("xp-grass") },
  tallGrass: { name: "Tall grass", draw: (p) => { p.fill(0); for (const [x, y] of [[2, 3], [9, 2], [5, 9], [12, 10]]) { p.line(x, y + 3, x + 1, y, 2); p.line(x + 2, y + 3, x + 1, y, 2); p.line(x + 3, y + 3, x + 4, y + 1, 2); } } },
  flowers: { name: "Flowers", draw: (p) => { p.fill(0); for (const [x, y] of [[3, 3], [11, 5], [6, 11]]) { p.dot(x, y - 1, 2); p.dot(x - 1, y, 2); p.dot(x + 1, y, 2); p.dot(x, y + 1, 2); p.dot(x, y, 3); } } },
  path: { name: "Path", draw: middle("xp-dirt") },
  sand: { name: "Sand", draw: middle("xp-sand") },
  water: { name: "Water", draw: middle("water") },
  waterEdge: { name: "Water edge", draw: from(() => pieceOf(sheet("water"), 2, 2)) },
  bridge: { name: "Bridge", draw: (p) => { p.fill(1); for (let x = 3; x < 16; x += 4) p.rect(x, 0, 1, 16, 2); p.side(0, 3); p.side(2, 3); p.rect(0, 1, 16, 1, 2); } },
  tree: { name: "Tree", draw: (p) => { p.fill(0); p.oval(2, 0, 12, 11, 1); p.dot(5, 3, 2); p.dot(9, 6, 2); p.rect(7, 11, 2, 4, 3); p.rect(5, 15, 6, 1, 2); } },
  pine: { name: "Pine", draw: (p) => { p.fill(0); p.peak(3, 0, 10, 7, 2); p.peak(2, 5, 12, 8, 2); p.rect(7, 13, 2, 3, 3); } },
  bush: { name: "Bush", draw: (p) => { p.fill(0); p.oval(1, 4, 14, 11, 1); p.dot(5, 8, 2); p.dot(10, 7, 2); p.dot(8, 11, 2); } },
  rock: { name: "Rock", draw: (p) => { p.fill(0); p.oval(2, 4, 12, 10, 1); p.rect(8, 9, 4, 3, 2); p.line(5, 7, 7, 9, 3); } },
  stump: { name: "Stump", draw: (p) => { p.fill(0); p.panel(3, 7, 10, 7, 2); p.oval(3, 4, 10, 6, 1); p.oval(6, 6, 4, 2, null, 2); } },
  fence: { name: "Fence", draw: (p) => { p.fill(0); p.rect(0, 6, 16, 1, 3); p.rect(0, 10, 16, 1, 3); p.panel(2, 3, 3, 11, 1); p.panel(11, 3, 3, 11, 1); } },
  sign: { name: "Sign", draw: (p) => { p.fill(0); p.rect(7, 9, 2, 6, 3); p.panel(2, 2, 12, 8, 1); p.rect(4, 4, 8, 1, 2); p.rect(4, 6, 6, 1, 2); } },
  mountain: { name: "Mountain", draw: (p) => { p.fill(0); p.peak(1, 2, 14, 13, 1); for (let row = 0; row < 12; row += 1) p.rect(8, 3 + row, Math.round(row * 6 / 12), 1, 2); } },
  cliff: { name: "Cliff", draw: from(() => pieceOf(sheet("cliff"), 2, 4)) },
  stoneStairs: { name: "Stone stairs", draw: (p) => steps(p, 1, 3) },
  caveMouth: { name: "Cave mouth", draw: (p) => { p.fill(2); p.rect(0, 0, 16, 2, 1); p.oval(2, 4, 12, 16, 3); p.rect(3, 12, 10, 4, 3); } },
  well: { name: "Well", draw: (p) => { p.fill(0); p.oval(2, 3, 12, 12, 1); p.oval(5, 6, 6, 6, 3); p.rect(1, 1, 14, 1, 3); p.rect(2, 1, 1, 4, 3); p.rect(13, 1, 1, 4, 3); } },
  houseWall: { name: "House wall", draw: (p) => { p.fill(1); bricks(p, 2); } },
  roof: { name: "Roof", draw: (p) => { p.fill(2); for (let y = 3; y < 16; y += 4) for (let x = (y % 8 === 3 ? 0 : 4); x < 16; x += 8) { p.rect(x, y, 4, 1, 3); p.dot(x + 4, y - 1, 3); } } },
  roofEdge: { name: "Roof edge", draw: (p) => { p.fill(2); p.rect(0, 12, 16, 2, 3); p.rect(0, 14, 16, 2, 1); for (let x = 0; x < 16; x += 4) p.rect(x, 4, 1, 8, 3); } },
  oakTall: { name: "Tall oak", tall: true, draw: (p) => { p.fill(0); p.oval(0, 0, 16, 21, 1); p.dot(5, 5, 2); p.dot(10, 9, 2); p.dot(6, 14, 2); p.panel(6, 20, 4, 10, 2); p.rect(4, 30, 8, 1, 3); p.oval(3, 29, 10, 3, null, 1); } },
  oakTall2: { name: "Tall oak (round)", tall: true, draw: (p) => { p.fill(0); p.oval(2, 8, 12, 12, 1); p.oval(0, 2, 10, 12, 1); p.oval(6, 0, 10, 13, 1); p.rect(2, 9, 12, 6, 1); p.dot(4, 6, 2); p.dot(11, 5, 2); p.dot(8, 13, 2); p.panel(7, 19, 3, 11, 2); p.line(8, 22, 12, 18, 3); p.rect(4, 30, 8, 1, 3); } },
  pineTall: { name: "Tall pine", tall: true, draw: (p) => { p.fill(0); p.peak(3, 0, 10, 9, 2); p.peak(2, 6, 12, 10, 2); p.peak(1, 12, 14, 12, 2); p.panel(6, 24, 4, 7, 2); p.rect(4, 31, 8, 1, 3); } },
  pineTall2: { name: "Tall pine (narrow)", tall: true, draw: (p) => { p.fill(0); p.peak(4, 0, 8, 12, 2); p.peak(3, 8, 10, 10, 2); p.peak(2, 15, 12, 10, 2); p.rect(7, 25, 2, 6, 3); p.rect(5, 31, 6, 1, 3); } },
  chimney: { name: "Chimney", draw: (p) => { p.fill(2); p.panel(4, 2, 8, 14, 1); p.rect(3, 2, 10, 2, 3); bricks(p.at(5, 5, 6, 10), 2); } },
};

// ---- indoors ------------------------------------------------------------------------------------------------------------

export const INDOOR: Record<string, Tile> = {
  woodFloor: { name: "Wood floor", draw: middle("xp-wood-floor") },
  tileFloor: { name: "Tile floor", draw: middle("xp-tile-floor") },
  carpet: { name: "Carpet", draw: middle("xp-carpet") },
  wall: { name: "Wall", draw: (p) => { p.fill(1); for (let x = 1; x < 16; x += 4) p.rect(x, 0, 1, 16, 2); } },
  wallBase: { name: "Wall base", draw: (p) => { p.fill(1); for (let x = 1; x < 16; x += 4) p.rect(x, 0, 1, 11, 2); p.rect(0, 11, 16, 1, 3); p.rect(0, 12, 16, 4, 2); } },
  wallTopIn: { name: "Wall top", draw: (p) => { p.fill(3); p.rect(0, 13, 16, 3, 2); } },
  windowIn: { name: "Window", draw: (p) => { p.fill(1); p.panel(3, 2, 10, 10, 0); p.rect(8, 2, 1, 10, 3); p.rect(3, 6, 10, 1, 3); p.rect(1, 1, 3, 12, 2); p.rect(12, 1, 3, 12, 2); p.rect(1, 0, 14, 1, 3); } },
  doorway: { name: "Doorway", draw: (p) => { p.fill(1); p.panel(2, 1, 12, 15, 3); p.rect(3, 2, 10, 14, 3); p.rect(2, 1, 12, 1, 2); } },
  stairsUp: { name: "Stairs up", draw: (p) => steps(p, 0, 3) },
  stairsDown: { name: "Stairs down", draw: (p) => { p.fill(3); for (let y = 2; y < 16; y += 4) p.rect(2 + y / 4, y, 12 - y / 2, 2, 2); } },
  table: { name: "Table", draw: (p) => { p.fill(1); p.panel(1, 2, 14, 10, 0); p.rect(1, 12, 14, 2, 2); p.rect(2, 14, 2, 2, 3); p.rect(12, 14, 2, 2, 3); } },
  chair: { name: "Chair", draw: (p) => { p.fill(1); p.panel(4, 1, 8, 5, 2); p.panel(3, 6, 10, 6, 0); p.rect(4, 12, 1, 3, 3); p.rect(11, 12, 1, 3, 3); } },
  bed: { name: "Bed", draw: (p) => { p.fill(1); p.panel(2, 0, 12, 16, 0); p.round(4, 1, 8, 4, 0, 2); p.rect(3, 6, 10, 9, 2); p.rect(3, 6, 10, 1, 3); } },
  bookshelf: { name: "Bookshelf", draw: (p) => { p.panel(0, 0, 16, 16, 2); for (const y of [1, 8]) { p.rect(1, y + 6, 14, 1, 3); for (let x = 2; x < 14; x += 3) p.rect(x, y + 1, 2, 5, x % 2 ? 0 : 1); } } },
  counter: { name: "Counter", draw: (p) => { p.fill(1); p.panel(0, 0, 16, 5, 0); p.panel(0, 4, 16, 12, 2); p.rect(4, 7, 1, 7, 3); p.rect(11, 7, 1, 7, 3); } },
  pottedPlant: { name: "Potted plant", draw: (p) => { p.fill(1); p.oval(2, 0, 12, 10, 0, 3); p.dot(6, 4, 2); p.dot(9, 3, 2); p.panel(4, 9, 8, 6, 2); p.rect(3, 9, 10, 1, 3); } },
  fireplace: { name: "Fireplace", draw: (p) => { p.fill(2); bricks(p, 3); p.panel(3, 6, 10, 10, 3); flame(p, 6, 10); p.rect(1, 4, 14, 2, 1); p.box(1, 4, 14, 2, 3); } },
  clock: { name: "Clock", draw: (p) => { p.fill(1); for (let x = 1; x < 16; x += 4) p.rect(x, 0, 1, 16, 2); p.oval(3, 3, 10, 10, 0); p.rect(8, 5, 1, 4, 3); p.rect(8, 8, 3, 1, 3); } },
  rug: { name: "Rug", draw: (p) => { p.fill(1); p.oval(0, 2, 16, 12, 2); p.oval(3, 5, 10, 6, null, 1); } },
  computer: { name: "Computer", draw: (p) => { p.fill(1); p.panel(2, 1, 12, 9, 3); p.rect(3, 2, 10, 7, 0); p.rect(4, 4, 5, 1, 2); p.rect(4, 6, 3, 1, 2); p.rect(7, 10, 2, 2, 3); p.panel(3, 12, 10, 3, 2); } },
  barrel: { name: "Barrel", draw: (p) => { p.fill(1); p.panel(3, 2, 10, 13, 2); p.oval(3, 0, 10, 4, 0); p.rect(3, 6, 10, 1, 3); p.rect(3, 11, 10, 1, 3); } },
  crate: { name: "Crate", draw: (p) => { p.fill(1); p.panel(1, 1, 14, 14, 2); p.box(3, 3, 10, 10, 3); p.line(3, 3, 12, 12, 3); p.line(12, 3, 3, 12, 3); } },
  jar: { name: "Jar", draw: (p) => { p.fill(1); p.oval(2, 4, 12, 11, 0); p.panel(5, 1, 6, 4, 2); p.rect(4, 8, 8, 1, 2); } },
};

// ---- side-view levels -------------------------------------------------------------------------------------------------------

export const SIDE: Record<string, Tile> = {
  sky: { name: "Sky", draw: (p) => p.fill(0) },
  groundTop: { name: "Ground top", draw: from(() => pieceOf(sheet("cliff"), 2, 0)) },
  ground: { name: "Ground", draw: from(() => pieceOf(sheet("cliff"), 2, 4)) },
  brick: { name: "Brick", draw: (p) => { p.fill(1); bricks(p, 3); } },
  platform: { name: "Platform", draw: (p) => { p.fill(0); p.panel(0, 0, 16, 6, 1); p.rect(4, 6, 1, 3, 3); p.rect(11, 6, 1, 3, 3); } },
  ladder: { name: "Ladder", draw: (p) => { p.fill(0); p.rect(3, 0, 1, 16, 3); p.rect(12, 0, 1, 16, 3); for (let y = 2; y < 16; y += 5) p.rect(4, y, 8, 1, 2); } },
  questionBlock: { name: "? block", draw: (p) => { p.panel(0, 0, 16, 16, 1); p.text(6, 5, "?", 3); p.dot(2, 2, 3); p.dot(13, 2, 3); p.dot(2, 13, 3); p.dot(13, 13, 3); } },
  spikesUp: { name: "Spikes", draw: (p) => { p.fill(0); for (let x = 0; x < 16; x += 4) p.peak(x, 9, 5, 7, 2); } },
  cloud: { name: "Cloud", draw: (p) => { p.fill(0); p.oval(1, 5, 9, 8, 0, 1); p.oval(6, 3, 9, 9, 0, 1); p.rect(2, 11, 12, 1, 1); } },
  waterSide: { name: "Water (side)", draw: (p) => { p.fill(1); p.rect(0, 0, 16, 3, 0); for (let x = 0; x < 16; x += 4) { p.dot(x, 3, 3); p.dot(x + 1, 2, 3); p.dot(x + 2, 3, 3); } p.rect(3, 9, 4, 1, 2); } },
  stars: { name: "Stars", draw: (p) => { p.fill(3); p.dot(3, 4, 0); p.dot(11, 2, 1); p.dot(8, 10, 0); p.dot(13, 13, 1); p.dot(1, 12, 2); } },
  pipe: { name: "Column", draw: (p) => { p.fill(0); p.panel(3, 0, 10, 16, 1); p.rect(5, 0, 1, 16, 0); p.rect(10, 0, 1, 16, 2); } },
};

/** Pieces only the scenes use (not in a tile sheet): a house door filling its whole tile. */
export const SCENERY: Record<string, Tile> = {
  door: { name: "Door", draw: (p) => { p.panel(0, 0, 16, 16, 2); p.rect(0, 0, 16, 2, 3); for (const x of [5, 10]) p.rect(x, 2, 1, 14, 3); p.dot(12, 9, 0); p.dot(12, 10, 0); } },
};

/** Every tile by id, for building scenes. */
export const TILES: Record<string, Tile> = { ...OUTDOOR, ...INDOOR, ...SIDE, ...SCENERY };

/**
 * An outdoor tile as the author drew it (the Outdoor tiles sheet's catalog version, 2026-10-13: "with new tiles"):
 * copied from its place on the sheet (laid out as tileSheet lays it out), see-through pixels left as they are.
 * False when there is no such tile, and the code draws it.
 */
export function outdoorTile(out: Canvas, id: string, x: number, y: number): boolean {
  const art = catalogVersion("tiles-outdoor"), ids = Object.keys(OUTDOOR);
  if (!art || !(id in OUTDOOR)) return false;
  const small = ids.filter((key) => !OUTDOOR[key].tall), tall = ids.filter((key) => OUTDOOR[key].tall), rows = Math.ceil(small.length / 8);
  const at = OUTDOOR[id].tall ? tall.indexOf(id) : small.indexOf(id), h = OUTDOOR[id].tall ? 32 : 16;
  const sx = (at % 8) * 16, sy = OUTDOOR[id].tall ? rows * 16 + Math.floor(at / 8) * 32 : Math.floor(at / 8) * 16;
  if (sy + h > art.height) return false;
  for (let py = 0; py < h; py += 1) for (let px = 0; px < 16; px += 1) {
    const value = art.pixels[(sy + py) * art.width + sx + px], tx = x + px, ty = y + py;
    if (value > 3 || tx >= out.width || ty >= out.height) continue;
    out.pixels[ty * out.width + tx] = value;
  }
  return true;
}

