/**
 * Temp assets for review (the author, 2026-10-13: "a comprehensive array of temp assets like this, patterns and
 * such"): placeholder art drawn in code (CC0, ours), in the XP sheets' style. Two families:
 * - XP area auto-tiles (48 × 64, read by autopaint.ts xpCell; animated ones three frames side by side, 144 × 64):
 *   grounds and floors that join up at their edges and inner corners;
 * - seamless patterns (32 × 32 stamps): fills that tile in any direction.
 * Each may name the existing library piece it would replace (`before`). They join the catalog only once reviewed.
 */
import { xpBlock, type Shader } from "./autotiles";
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

const XP: TempAsset[] = [
  { id: "xp-grass", name: "Grass XP", family: "xp", autotile: "xp", about: "A grass patch: tufts on light ground, a soft mid edge.", before: { name: "Grass tile", make: () => tileNow(OUTDOOR.grass) },
    make: () => xp(edged((x, y) => at([[1, 2], [2, 1], [3, 2], [5, 6], [6, 5], [7, 6]], x, y) ? 2 : 0, 1, 2)) },
  { id: "xp-dirt", name: "Dirt XP", family: "xp", autotile: "xp", about: "Bare earth with pebbles, outlined dark.", before: { name: "Path tile", make: () => tileNow(OUTDOOR.path) },
    make: () => xp(edged((x, y) => at([[2, 2], [6, 5]], x, y) ? 3 : at([[3, 2], [5, 6], [1, 6]], x, y) ? 2 : 1)) },
  { id: "xp-sand", name: "Sand XP", family: "xp", autotile: "xp", about: "Pale sand with ripple lines; the edge a mid band.", before: { name: "Sand tile", make: () => tileNow(OUTDOOR.sand) },
    make: () => xp(edged((x, y) => (y === 3 && x < 4) || (y === 7 && x >= 4) ? 1 : 0, 1, 2)) },
  { id: "xp-snow", name: "Snow XP", family: "xp", autotile: "xp", about: "Snow banks: white with blue-ish shadow dots, a thick soft edge.",
    make: () => xp((depth, x, y) => depth === 0 ? 2 : depth <= 2 ? 1 : at([[2, 5], [6, 1]], x, y) ? 1 : 0) },
  { id: "xp-ice", name: "Ice XP", family: "xp", autotile: "xp", about: "Ice sheet: light with diagonal glints and cracks.",
    make: () => xp(edged((x, y) => (x + y) % 8 === 0 ? 0 : (x - y + 16) % 8 === 3 && y < 4 ? 2 : 1, 0)) },
  { id: "xp-lava", name: "Lava XP", family: "xp", autotile: "xpAnim", about: "Three frames: dark crust edge, bright bubbles that pop and move.",
    make: () => xpAnim((f) => edged((x, y) => { const bx = (2 + f * 2) % 8, by = (5 + f * 3) % 8; return (Math.abs(x - bx) + Math.abs(y - by) <= 1) ? 0 : ((x + y * 3 + f) % 7 === 0 ? 2 : 1); }, 2)) },
  { id: "xp-swamp", name: "Swamp XP", family: "xp", autotile: "xpAnim", about: "Three frames: murky water, lily pads, slow ripples.",
    make: () => xpAnim((f) => edged((x, y) => { if (at([[2, 2], [3, 2], [2, 3]], x, y)) return 1; const ripple = (x + f * 2) % 8; return y === 6 && ripple < 3 ? 1 : 2; }, 1)) },
  { id: "xp-stone-floor", name: "Stone floor XP", family: "xp", autotile: "xp", about: "Flagstones in a dungeon: big slabs with dark joints.",
    make: () => xp(edged((x, y) => (y === 7 || (x === 7 && y < 7) || (x === 3 && y === 7)) ? 2 : at([[2, 2], [5, 4]], x, y) ? 2 : 1)) },
  { id: "xp-wood-floor", name: "Wood floor XP", family: "xp", autotile: "xp", about: "Plank floor with a dark rim, boards end to end.", before: { name: "Wood floor tile", make: () => tileNow(INDOOR.woodFloor) },
    make: () => xp(edged((x, y) => (y % 4 === 3) ? 2 : (x === (y < 4 ? 5 : 1)) ? 2 : 1)) },
  { id: "xp-carpet", name: "Carpet XP", family: "xp", autotile: "xp", about: "A rug: a light border band inside the outline, a diamond weave in the middle.",
    make: () => xp((depth, x, y) => depth === 0 ? 3 : depth === 1 ? 0 : depth === 2 ? 2 : (Math.abs(x - 3.5) + Math.abs(y - 3.5) === 3) ? 0 : 1) },
  { id: "xp-hedge", name: "Hedge XP", family: "xp", autotile: "xp", about: "A clipped hedge mass: leafy clumps, dark outline.",
    make: () => xp(edged((x, y) => at([[1, 1], [2, 1], [5, 4], [6, 4], [1, 6]], x, y) ? 1 : at([[2, 2], [6, 5], [3, 6]], x, y) ? 3 : 2, 2)) },
  { id: "xp-farmland", name: "Farmland XP", family: "xp", autotile: "xp", about: "Tilled soil: furrows running across, a raised edge.",
    make: () => xp(edged((x, y) => (y % 4 === 1) ? 3 : (y % 4 === 2) ? 2 : (y % 4 === 0 && x % 4 === 1) ? 0 : 1, 1)) },
  { id: "xp-flowers", name: "Flower bed XP", family: "xp", autotile: "xp", about: "A bed of flowers on grass, edged with a dark border.", before: { name: "Flowers tile", make: () => tileNow(OUTDOOR.flowers) },
    make: () => xp(edged((x, y) => { const f = at([[2, 1], [1, 2], [3, 2], [2, 3], [6, 5], [5, 6], [7, 6], [6, 7]], x, y), c = at([[2, 2], [6, 6]], x, y); return c ? 3 : f ? 2 : 0; }, 1)) },
  { id: "xp-cobble", name: "Cobble path XP", family: "xp", autotile: "xp", about: "Round cobbles with dark gaps, for town paths.",
    make: () => xp(edged((x, y) => { const cx = x < 4 ? 1.5 : 5.5, cy = y < 4 ? (x < 4 ? 1.5 : 2.5) : (x < 4 ? 5.5 : 6.5); return Math.hypot(x - cx, y - cy) > 2 ? 2 : at([[1, 1], [5, 2], [1, 5], [5, 6]], x, y) ? 0 : 1; })) },
  { id: "xp-tile-floor", name: "Tiled floor XP", family: "xp", autotile: "xp", about: "Checkered tiles, a shop or diner floor, with a dark rim.",
    make: () => xp(edged((x, y) => ((x >> 2) + (y >> 2)) % 2 ? 2 : 0, 3)) },
  { id: "xp-deep-water", name: "Deep water XP", family: "xp", autotile: "xpAnim", about: "Three frames: dark open water with a lighter shelf at the edge.",
    make: () => xpAnim((f) => (depth, x, y) => depth === 0 ? 3 : depth <= 2 ? 1 : ((x + f * 3) % 8 < 2 && y % 4 === 1) ? 1 : 2) },
];

// ---- seamless patterns (32 × 32) ------------------------------------------------------------------------------------

const PATTERNS: TempAsset[] = [
  { id: "pat-brick", name: "Brick wall", family: "pattern", about: "Running-bond bricks, 8 × 4, dark mortar.", before: { name: "House wall tile", make: () => tileNow(OUTDOOR.houseWall) },
    make: () => pattern((x, y) => (y % 4 === 3) || ((x + ((y >> 2) % 2) * 4) % 8 === 7) ? 3 : (y % 4 === 0 && x % 8 === 1) ? 2 : 1) },
  { id: "pat-stone-wall", name: "Stone wall", family: "pattern", about: "Rough stone blocks of mixed sizes with light tops.",
    make: () => pattern((x, y) => { const row = y >> 3, off = [0, 5, 10, 3][row], w = [16, 8, 16, 8][row], bx = (x + off) % w; return y % 8 === 7 || bx === w - 1 ? 3 : y % 8 === 0 ? 1 : 2; }) },
  { id: "pat-cobble", name: "Cobblestones", family: "pattern", about: "Rounded cobbles in offset rows.",
    make: () => pattern((x, y) => { const row = y >> 2, ox = (x + (row % 2) * 4) % 8, oy = y % 4; return ox === 7 || oy === 3 ? 3 : (ox === 1 && oy === 0) ? 0 : 1; }) },
  { id: "pat-planks", name: "Wood planks", family: "pattern", about: "Horizontal boards with staggered ends and nail dots.", before: { name: "Wood floor tile", make: () => tileNow(INDOOR.woodFloor) },
    make: () => pattern((x, y) => { const board = y >> 3, end = (x + board * 11) % 32; return y % 8 === 7 || end === 0 ? 3 : (y % 8 === 3 && end === 2) ? 2 : 1; }) },
  { id: "pat-shingles", name: "Roof shingles", family: "pattern", about: "Overlapping rounded shingles.", before: { name: "Roof tile", make: () => tileNow(OUTDOOR.roof) },
    make: () => pattern((x, y) => { const row = y >> 2, ox = (x + (row % 2) * 2) % 4, oy = y % 4; return oy === 3 ? 3 : ox === 3 && oy > 0 ? 3 : oy === 0 ? 1 : 2; }) },
  { id: "pat-checker", name: "Checker floor", family: "pattern", about: "4 × 4 checks, light and dark.",
    make: () => pattern((x, y) => ((x >> 2) + (y >> 2)) % 2 ? 2 : 0) },
  { id: "pat-diamond", name: "Diamond tiles", family: "pattern", about: "Diamond floor tiles with a grout line.",
    make: () => pattern((x, y) => { const d = Math.abs((x % 8) - 3.5) + Math.abs((y % 8) - 3.5); return d > 3.5 && d < 4.6 ? 3 : d < 1.6 ? 0 : 1; }) },
  { id: "pat-grass", name: "Grass field", family: "pattern", about: "Scattered tufts on light ground, irregular so it doesn't read as a grid.", before: { name: "Grass tile", make: () => tileNow(OUTDOOR.grass) },
    make: () => pattern((x, y) => { const h = hash(x >> 2, y >> 2), cx = ((x >> 2) << 2) + 1 + Math.floor(h * 2), cy = ((y >> 2) << 2) + 2; return h > .55 && ((x === cx && y === cy - 1) || (Math.abs(x - cx) === 1 && y === cy)) ? 2 : 0; }) },
  { id: "pat-tall-grass", name: "Tall grass", family: "pattern", about: "Dense blades, for encounter patches.",
    make: () => pattern((x, y) => { const blade = (x + (y >> 3) * 3) % 4; return y % 8 < 5 && blade === 1 ? 2 : y % 8 < 3 && blade === 2 ? 2 : y % 8 === 7 ? 1 : 0; }) },
  { id: "pat-sand", name: "Sand dunes", family: "pattern", about: "Wavy ripple lines across pale sand.", before: { name: "Sand tile", make: () => tileNow(OUTDOOR.sand) },
    make: () => pattern((x, y) => (y + Math.round(Math.sin(x * Math.PI / 8) * 1.5) + 32) % 8 === 0 ? 1 : 0) },
  { id: "pat-water", name: "Water ripples", family: "pattern", about: "Open water with staggered wave crests.", before: { name: "Water tile", make: () => tileNow(OUTDOOR.water) },
    make: () => pattern((x, y) => { const row = y >> 3, ox = (x + row * 5) % 16; return y % 8 === 3 && ox < 4 ? 0 : y % 8 === 4 && ox < 4 ? 2 : 1; }) },
  { id: "pat-dirt", name: "Dirt", family: "pattern", about: "Soil with scattered pebbles and dark specks.", before: { name: "Path tile", make: () => tileNow(OUTDOOR.path) },
    make: () => pattern((x, y) => { const h = hash(x, y); return h > .94 ? 3 : h > .86 ? 2 : h < .04 ? 0 : 1; }) },
  { id: "pat-gravel", name: "Gravel", family: "pattern", about: "Fine gravel, light and dark grains.",
    make: () => pattern((x, y) => { const h = hash(x * 3, y * 7); return h > .8 ? 2 : h > .65 ? 0 : h < .05 ? 3 : 1; }) },
  { id: "pat-leaves", name: "Leaf canopy", family: "pattern", about: "A dense treetop seen from above, clumps of leaves.",
    make: () => pattern((x, y) => { const cx = (x % 8) - 3.5, cy = ((y + (x >> 3) * 4) % 8) - 3.5, d = Math.hypot(cx, cy); return d > 3.6 ? 3 : d < 1.5 ? 1 : cx < -1 && cy < -1 ? 1 : 2; }) },
  { id: "pat-bark", name: "Tree bark", family: "pattern", about: "Vertical bark grooves.",
    make: () => pattern((x, y) => { const g = (x + Math.round(Math.sin(y * Math.PI / 16) * 1.5) + 32) % 4; return g === 0 ? 3 : g === 1 ? 1 : 2; }) },
  { id: "pat-carpet", name: "Carpet weave", family: "pattern", about: "A patterned carpet: crosses on a woven ground.",
    make: () => pattern((x, y) => { const cx = x % 8, cy = y % 8; return (cx === 3 && cy > 1 && cy < 6) || (cy === 3 && cx > 1 && cx < 6) ? 0 : (x + y) % 2 ? 1 : 2; }) },
  { id: "pat-grate", name: "Metal grate", family: "pattern", about: "A floor grate: bars with dark holes.",
    make: () => pattern((x, y) => (x % 4 === 3 || y % 4 === 3) ? 1 : (x % 4 === 0 && y % 4 === 0) ? 0 : 3) },
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
