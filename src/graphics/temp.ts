/**
 * Temp assets for review (the author, 2026-10-13: "a comprehensive array of temp assets like this, patterns and
 * such"): placeholder art drawn in code (CC0, ours), in the XP sheets' style. Two families:
 * - XP area auto-tiles (48 × 64, read by autopaint.ts xpCell; animated ones three frames side by side, 144 × 64):
 *   grounds and floors that join up at their edges and inner corners;
 * - seamless patterns (32 × 32 stamps): fills that tile in any direction.
 * Each may name the existing library piece it would replace (`before`). They join the catalog only once reviewed.
 */
import { xpBlock, xpWaterTemplate, type Shader } from "./autotiles";
import { canvas, CLEAR, Pen, type Canvas } from "./pen";
import { INDOOR, OUTDOOR, type Tile } from "./tiles";

export interface TempAsset {
  id: string; name: string; family: "xp" | "pattern"; about: string;
  /** "xp" or "xpAnim" for the auto-tiles; patterns are plain stamps. */
  autotile?: "xp" | "xpAnim";
  make: () => Canvas;
  /** The library piece it would replace, drawn as it is now. */
  before?: { name: string; make: () => Canvas };
}

// ---- helpers -------------------------------------------------------------------------------------------------------

/** A shader with the usual edge: a dark outline (depth 0), a band (depth 1), then `fill(x, y)` (x, y modulo 8). */
const edged = (fill: (x: number, y: number) => number, band = 2, line = 3): Shader => (depth, x, y) => depth === 0 ? line : depth === 1 ? band : fill(x, y);
const xp = (shade: Shader): Canvas => { const out = canvas(48, 64, CLEAR); xpBlock(out, 0, shade); return out; };
const xpAnim = (frame: (f: number) => Shader): Canvas => { const out = canvas(144, 64, CLEAR); for (let f = 0; f < 3; f += 1) xpBlock(out, f * 48, frame(f)); return out; };
/** A 32 × 32 seamless pattern from a shade-by-position rule (x, y in 0–31). */
const pattern = (rule: (x: number, y: number) => number): Canvas => { const out = canvas(32, 32, 0); for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) out.pixels[y * 32 + x] = rule(x, y); return out; };
/** A library tile (16 × 16, or 16 × 32 when tall) drawn as it is now, for the "before". */
const tileNow = (tile: Tile): Canvas => { const out = canvas(16, tile.tall ? 32 : 16, 0); tile.draw(new Pen(out, 0, 0, 16, tile.tall ? 32 : 16)); return out; };
const at = (list: [number, number][], x: number, y: number) => list.some(([px, py]) => px === x && py === y);
/** A cheap repeatable hash: the same (x, y) always gives the same 0–1. */
const hash = (x: number, y: number) => { let h = Math.imul(x * 374761393 + y * 668265263, 1274126177); h ^= h >>> 13; return ((Math.imul(h, 1103515245) >>> 0) % 1000) / 1000; };

// ---- XP area auto-tiles --------------------------------------------------------------------------------------------

/** A library tile's design as a fill: its pixel at (gx, gy) on the sheet, repeating every 16 px (turned a quarter when `turn`). */
const tileFill = (tile: Tile, turn = false) => { const art = tileNow(tile); return (gx: number, gy: number) => { const x = gx % 16, y = gy % 16; return turn ? art.pixels[(15 - x) * 16 + y] : art.pixels[y * 16 + x]; }; };
/** A floor or wall in the XP layout with square corners: it fills a room edge to edge (the "unrounded variant"). */
const xpSquare = (shade: Shader): Canvas => { const out = canvas(48, 64, CLEAR); xpBlock(out, 0, shade, undefined, 0); return out; };
const woodFloor: Shader = edged((x, y) => (y % 4 === 3) ? 2 : (x === (y < 4 ? 5 : 1)) ? 2 : 1);
const carpet: Shader = (depth, x, y) => depth === 0 ? 3 : depth === 1 ? 0 : depth === 2 ? 2 : (Math.abs(x - 3.5) + Math.abs(y - 3.5) === 3) ? 0 : 1;
const tiledFloor: Shader = edged((x, y) => ((x >> 2) + (y >> 2)) % 2 ? 2 : 0, 3);
/** The old path tile's design (the path tile is now drawn from Dirt XP itself, so this keeps its own copy). */
const oldPath = (p: Pen) => { p.fill(1); for (const [x, y] of [[3, 4], [10, 2], [12, 11], [5, 12]]) p.rect(x, y, 2, 1, 2); };
/** The old grass and wood floor tiles' designs (the author preferred them; the tiles now draw from the XP sheets). */
const oldGrass: Tile = { name: "Grass", draw: (p) => { p.fill(0); for (const [x, y] of [[3, 3], [11, 10]]) { p.dot(x, y + 1, 1); p.dot(x + 1, y, 1); p.dot(x + 2, y + 1, 1); } } };
const oldWoodFloor: Tile = { name: "Wood floor", draw: (p) => { p.fill(1); for (let y = 3; y < 16; y += 4) p.rect(0, y, 16, 1, 2); for (const [x, y] of [[5, 0], [12, 4], [3, 8], [10, 12]]) p.rect(x, y, 1, 3, 2); } };
/** Made on first use, so this module can load before the tiles do (tiles.ts draws some tiles from these sheets). */
const lazyFill = (tile: () => Tile) => { let fill: ((gx: number, gy: number) => number) | null = null; return (gx: number, gy: number) => (fill ??= tileFill(tile()))(gx, gy); };
const brickFill = lazyFill(() => OUTDOOR.houseWall), plankFill = lazyFill(() => oldWoodFloor), wallpaperFill = lazyFill(() => oldGrass);
/** The flower bed, inverted (the author's note): a dark bed with light flowers, the outline kept dark. */
// The author's round-2 note: the bed dark gray (not black), its border black, light flowers with a dark gray heart.
const flowerBed: Shader = (depth, x, y) => { if (depth <= 1) return 3; const f = at([[2, 1], [1, 2], [3, 2], [2, 3], [6, 5], [5, 6], [7, 6], [6, 7]], x, y), c = at([[2, 2], [6, 6]], x, y); return c ? 1 : f ? 0 : 2; };

const XP: TempAsset[] = [
  { id: "xp-grass", name: "Grass XP", family: "xp", autotile: "xp", about: "A grass patch: tufts on light ground, a soft mid edge.", before: { name: "Grass tile", make: () => tileNow(OUTDOOR.grass) },
    make: () => xp(edged((x, y) => at([[1, 2], [2, 1], [3, 2], [5, 6], [6, 5], [7, 6]], x, y) ? 2 : 0, 1, 2)) },
  { id: "xp-dirt", name: "Dirt XP", family: "xp", autotile: "xp", about: "The path tile's design turned a quarter, with a dark border around the area.", before: { name: "Path tile", make: () => tileNow(OUTDOOR.path) },
    make: () => { const fill = tileFill({ name: "Path", draw: oldPath }, true); return xp((depth, _x, _y, gx, gy) => depth === 0 ? 3 : depth === 1 ? 2 : fill(gx, gy)); } },
  { id: "xp-sand", name: "Sand XP", family: "xp", autotile: "xp", about: "Pale sand, just dots; the edge a mid band.", before: { name: "Sand tile", make: () => tileNow(OUTDOOR.sand) },
    make: () => xp(edged((x, y) => at([[1, 2], [5, 1], [3, 5], [7, 6]], x, y) ? 1 : 0, 1, 2)) },
  { id: "xp-snow", name: "Snow XP", family: "xp", autotile: "xp", about: "Snow banks: white with blue-ish shadow dots, a thick soft edge.",
    make: () => xp((depth, x, y) => depth === 0 ? 2 : depth <= 2 ? 1 : at([[2, 5], [6, 1]], x, y) ? 1 : 0) },
  { id: "xp-ice", name: "Floor tiles XP", family: "xp", autotile: "xp", about: "The ice sheet a shade darker all over, for a floorboard or tiled floor: diagonal glints and fine cracks.",
    make: () => xp(edged((x, y) => (x + y) % 8 === 0 ? 1 : (x - y + 16) % 8 === 7 && y >= 4 ? 3 : 2, 1)) },
  { id: "xp-lava", name: "Lava XP", family: "xp", autotile: "xpAnim", about: "Three frames: dark crust edge, bright bubbles that pop and move.",
    make: () => xpAnim((f) => edged((x, y) => { const bx = (2 + f * 2) % 8, by = (5 + f * 3) % 8; return (Math.abs(x - bx) + Math.abs(y - by) <= 1) ? 0 : ((x + y * 3 + f) % 7 === 0 ? 2 : 1); }, 2)) },
  { id: "xp-swamp", name: "Swamp XP", family: "xp", autotile: "xpAnim", about: "Three frames: murky water, lily pads, slow ripples.",
    make: () => xpAnim((f) => edged((x, y) => { if (at([[2, 2], [3, 2], [2, 3]], x, y)) return 1; const ripple = (x + f * 2) % 8; return y === 6 && ripple < 3 ? 1 : 2; }, 1)) },
  { id: "xp-stone-floor", name: "Stone floor XP", family: "xp", autotile: "xp", about: "Flagstones in a dungeon: big slabs with dark joints.",
    make: () => xp(edged((x, y) => (y === 7 || (x === 7 && y < 7) || (x === 3 && y === 7)) ? 2 : at([[2, 2], [5, 4]], x, y) ? 2 : 1)) },
  { id: "xp-water-calm", name: "Calm water XP", family: "xp", autotile: "xp", about: "Water XP's first frame on its own: still water, no animation, a third of the tiles.", before: { name: "Water XP (3 frames)", make: () => xpWaterTemplate() },
    make: () => { const sheet = xpWaterTemplate(), out = canvas(48, 64, CLEAR); for (let y = 0; y < 64; y += 1) out.pixels.set(sheet.pixels.subarray(y * 144, y * 144 + 48), y * 48); return out; } },
  { id: "xp-water-2", name: "Water XP (2 frames)", family: "xp", autotile: "xpAnim", about: "Water XP in two frames: the waves and the shore ripple half a step apart, two thirds of the tiles of the 3-frame one.", before: { name: "Water XP (3 frames)", make: () => xpWaterTemplate() },
    make: () => xpWaterTemplate(2) },
  { id: "xp-wood-floor", name: "Wood floor XP", family: "xp", autotile: "xp", about: "Plank floor with a dark rim, boards end to end.", before: { name: "Wood floor tile", make: () => tileNow(INDOOR.woodFloor) }, make: () => xp(woodFloor) },
  { id: "xp-wood-floor-square", name: "Wood floor XP (square)", family: "xp", autotile: "xp", about: "The wood floor with square corners, to fill a room edge to edge.", make: () => xpSquare(woodFloor) },
  { id: "xp-carpet", name: "Carpet XP", family: "xp", autotile: "xp", about: "A rug: a light border band inside the outline, a diamond weave in the middle.", make: () => xp(carpet) },
  { id: "xp-carpet-square", name: "Carpet XP (square)", family: "xp", autotile: "xp", about: "The carpet with square corners: wall-to-wall.", make: () => xpSquare(carpet) },
  { id: "xp-flowers", name: "Flower bed XP", family: "xp", autotile: "xp", about: "A dark gray bed with light flowers, bordered in black.", before: { name: "Flowers tile", make: () => tileNow(OUTDOOR.flowers) }, make: () => xp(flowerBed) },
  { id: "xp-tile-floor", name: "Tiled floor XP", family: "xp", autotile: "xp", about: "Checkered tiles, a shop or diner floor, with a dark rim.", make: () => xp(tiledFloor) },
  { id: "xp-tile-floor-square", name: "Tiled floor XP (square)", family: "xp", autotile: "xp", about: "The checkered floor with square corners, to fill a room.", make: () => xpSquare(tiledFloor) },
  { id: "xp-brick-square", name: "Brick wall XP (square)", family: "xp", autotile: "xp", about: "The house wall's bricks as an area with a dark rim and square corners.", before: { name: "House wall tile", make: () => tileNow(OUTDOOR.houseWall) }, make: () => xpSquare((depth, _x, _y, gx, gy) => depth === 0 ? 3 : brickFill(gx, gy)) },
  { id: "xp-planks-square", name: "Wood planks XP (square)", family: "xp", autotile: "xp", about: "The wood floor tile's planks as an area with a dark rim and square corners.", before: { name: "Wood floor tile", make: () => tileNow(INDOOR.woodFloor) }, make: () => xpSquare((depth, _x, _y, gx, gy) => depth === 0 ? 3 : plankFill(gx, gy)) },
  { id: "xp-grandmas-wallpaper-square", name: "Grandmas-Wallpaper XP (square)", family: "xp", autotile: "xp", about: "The old grass tile's tufts as a wallpaper area with a dark gray rim and square corners.", before: { name: "Grass tile", make: () => tileNow(OUTDOOR.grass) }, make: () => xpSquare((depth, _x, _y, gx, gy) => depth === 0 ? 2 : wallpaperFill(gx, gy)) },
];

// ---- seamless patterns (32 × 32) ------------------------------------------------------------------------------------

/** A 16 × 16 library tile repeated into a 32 × 32 pattern. */
const fromTile = (tile: Tile): Canvas => { const art = tileNow(tile); return pattern((x, y) => art.pixels[(y % 16) * 16 + (x % 16)]); };

const PATTERNS: TempAsset[] = [
  { id: "pat-brick", name: "Brick wall", family: "pattern", about: "The house wall tile's bricks (the author preferred them), repeated.", make: () => fromTile(OUTDOOR.houseWall) },
  { id: "pat-stone-wall", name: "Stone wall", family: "pattern", about: "Rough stone blocks of mixed sizes with light tops.",
    make: () => pattern((x, y) => { const row = y >> 3, off = [0, 5, 10, 3][row], w = [16, 8, 16, 8][row], bx = (x + off) % w; return y % 8 === 7 || bx === w - 1 ? 3 : y % 8 === 0 ? 1 : 2; }) },
  { id: "pat-planks", name: "Wood planks", family: "pattern", about: "The wood floor tile's planks (the author preferred them), repeated.", make: () => fromTile(oldWoodFloor) },
  { id: "pat-shingles", name: "Roof shingles", family: "pattern", about: "Overlapping rounded shingles.", before: { name: "Roof tile", make: () => tileNow(OUTDOOR.roof) },
    make: () => pattern((x, y) => { const row = y >> 2, ox = (x + (row % 2) * 2) % 4, oy = y % 4; return oy === 3 ? 3 : ox === 3 && oy > 0 ? 3 : oy === 0 ? 1 : 2; }) },
  { id: "pat-checker", name: "Checker floor", family: "pattern", about: "4 × 4 checks, light and dark.",
    make: () => pattern((x, y) => ((x >> 2) + (y >> 2)) % 2 ? 2 : 0) },
  { id: "pat-diamond", name: "Diamond tiles", family: "pattern", about: "Diamond floor tiles with a grout line.",
    make: () => pattern((x, y) => { const d = Math.abs((x % 8) - 3.5) + Math.abs((y % 8) - 3.5); return d > 3.5 && d < 4.6 ? 3 : d < 1.6 ? 0 : 1; }) },
  { id: "pat-grandmas-wallpaper", name: "Grandmas-Wallpaper", family: "pattern", about: "The old grass tile's tufts, repeated: a quaint wallpaper.", make: () => fromTile(oldGrass) },
  { id: "pat-sand", name: "Sand dunes", family: "pattern", about: "Soft ripple lines across pale sand: gentle curves, broken into dashes.", before: { name: "Sand tile", make: () => tileNow(OUTDOOR.sand) },
    make: () => pattern((x, y) => { const line = (y + Math.round(Math.sin(x * Math.PI / 16) * 1.2) + 32) % 8; return line === 0 && (x % 8) < 6 ? 1 : 0; }) },
  { id: "pat-water", name: "Water ripples", family: "pattern", about: "Open water with staggered wave crests.", before: { name: "Water tile", make: () => tileNow(OUTDOOR.water) },
    make: () => pattern((x, y) => { const row = y >> 3, ox = (x + row * 5) % 16; return y % 8 === 3 && ox < 4 ? 0 : y % 8 === 4 && ox < 4 ? 2 : 1; }) },
  { id: "pat-dirt", name: "High-res dirt", family: "pattern", about: "Soil with scattered pebbles and dark specks.", make: () => pattern((x, y) => { const h = hash(x, y); return h > .94 ? 3 : h > .86 ? 2 : h < .04 ? 0 : 1; }) },
  { id: "pat-leaves", name: "Leaf canopy", family: "pattern", about: "A dense treetop seen from above, clumps of leaves.",
    make: () => pattern((x, y) => { const cx = (x % 8) - 3.5, cy = ((y + (x >> 3) * 4) % 8) - 3.5, d = Math.hypot(cx, cy); return d > 3.6 ? 3 : d < 1.5 ? 1 : cx < -1 && cy < -1 ? 1 : 2; }) },
  { id: "pat-chainlink", name: "Chain-link fence", family: "pattern", about: "Diagonal wire mesh on see-through.",
    make: () => pattern((x, y) => ((x + y) % 6 === 0 || (x - y + 36) % 6 === 0) ? 3 : CLEAR) },
  { id: "pat-stripes", name: "Diagonal stripes", family: "pattern", about: "Hazard-style stripes, for signs and floors.",
    make: () => pattern((x, y) => ((x + y) >> 2) % 2 ? 3 : 1) },
  { id: "pat-dots", name: "Polka dots", family: "pattern", about: "Offset dots, for wallpaper and cloth.",
    make: () => pattern((x, y) => { const ox = (x + ((y >> 3) % 2) * 4) % 8, oy = y % 8; return Math.hypot(ox - 3.5, oy - 3.5) < 1.6 ? 2 : 0; }) },
  { id: "pat-wallpaper", name: "Wallpaper", family: "pattern", about: "Vertical stripes with a small motif, for indoor walls.",
    make: () => pattern((x, y) => x % 8 === 0 ? 2 : (x % 8 === 4 && y % 8 === 3) || (x % 8 === 4 && (y % 8 === 2 || y % 8 === 4)) || ((x % 8 === 3 || x % 8 === 5) && y % 8 === 3) ? 2 : 1) },
  { id: "pat-crosshatch", name: "Crosshatch shadow", family: "pattern", about: "Hatching for shade under roofs and trees.",
    make: () => pattern((x, y) => ((x + y) % 4 === 0 || (x - y + 32) % 4 === 0) ? 2 : 1) },
  { id: "pat-stars", name: "Night sky", family: "pattern", about: "Dark sky with scattered stars, some twinkly crosses.",
    make: () => pattern((x, y) => { const h = hash(x >> 3, y >> 3), sx = ((x >> 3) << 3) + 1 + Math.floor(h * 6), sy = ((y >> 3) << 3) + 1 + Math.floor(hash(y >> 3, x >> 3) * 6); if (x === sx && y === sy) return 0; return h > .7 && Math.abs(x - sx) + Math.abs(y - sy) === 1 ? 1 : 3; }) },
  { id: "pat-clouds", name: "Clouds", family: "pattern", about: "Puffy cloud bands on a light sky.",
    make: () => pattern((x, y) => { const top = Math.round(Math.sin(x * Math.PI / 16) * 3 + 10); return y >= top && y < top + 6 ? (y === top ? 0 : x % 8 === 2 && y === top + 2 ? 1 : 0) : y === top + 6 ? 2 : 1; }) },
  { id: "pat-scales", name: "Scales", family: "pattern", about: "Overlapping scales, for dragons, fish or ornate roofs.",
    make: () => pattern((x, y) => { const row = y >> 2, ox = ((x + (row % 2) * 4) % 8) - 3.5, oy = (y % 4) + 0.5; const d = Math.hypot(ox, oy); return d > 3.4 && d < 4.4 ? 3 : d < 2 ? 1 : 2; }) },
];

export const TEMP_ASSETS: TempAsset[] = [...XP, ...PATTERNS];

/** Approved in the author's swipe review (round 1, 2026-10-13): these are in the catalog; the rest await round 2. */
export const APPROVED = new Set([
  // Round 2 (2026-10-13).
  "xp-dirt", "xp-sand", "xp-ice", "xp-flowers", "xp-wood-floor-square", "xp-carpet-square", "xp-tile-floor-square", "xp-brick-square", "xp-planks-square", "xp-grandmas-wallpaper-square",
  "pat-brick", "pat-planks", "pat-grandmas-wallpaper", "pat-sand", "xp-water-calm", "xp-water-2",
  "xp-grass", "xp-snow", "xp-lava", "xp-swamp", "xp-stone-floor", "xp-wood-floor", "xp-carpet", "xp-tile-floor",
  "pat-stone-wall", "pat-shingles", "pat-checker", "pat-diamond", "pat-water", "pat-dirt", "pat-leaves", "pat-chainlink", "pat-stripes", "pat-dots",
  "pat-wallpaper", "pat-crosshatch", "pat-stars", "pat-clouds", "pat-scales"]);
