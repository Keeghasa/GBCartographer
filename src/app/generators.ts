/**
 * Map generators (the author's ask, 2026-10-10): a cave or dungeon, and an RPG-style overworld (water, shore,
 * grass, forest, mountains, towns and roads). Each makes a grid of map cells from its settings and a seed (the same
 * settings always give the same map), then draws every cell with simple wireframe primitives in the four GB shades
 * (0 lightest … 3 darkest): placeholder art to paint over. Few distinct cells, so the tile count stays low.
 */

import { CORNER_NE, CORNER_NW, CORNER_SE, CORNER_SW, edgeMask, maskAt, slot16, wangSlot } from "./autotile";
import { Pen } from "../graphics/pen";
import { paintCliffs, paintForest, paintSliced, paintXp, sheet } from "../graphics/areas";
import { OUTDOOR, outdoorTile } from "../graphics/tiles";
import { CAVE_THEMES, WORLD_THEMES, themeOf } from "./mapThemes";
import { SOLID } from "./pendingCollisions";

export { OVERWORLD_PALETTES } from "./mapThemes";

/** A small seeded random generator (mulberry32): numbers in [0, 1). */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A picture in GB shades, one byte per pixel; with colors, each 8 × 8 tile's palette (1-based, 0 the greens) and those palettes. */
export interface Generated {
  width: number; height: number; pixels: Uint8Array; cells?: Uint16Array; palettes?: { name: string; colors: string[] }[];
  /** A GB Studio collision value per 8 × 8 tile (the author, 2026-11-02), kept for the background's scene by src/app/pendingCollisions.ts. */
  collisions?: Uint8Array;
}

const SCREEN_W = 160, SCREEN_H = 144;
const SIDES: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** A stable per-cell number, for picking a cell's variant without moving every other cell when a setting changes. */
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// ---- cave and dungeon -------------------------------------------------------------------------------------------------

export interface CaveSettings {
  style: "cave" | "dungeon";
  /** Size in GB screens (160 × 144 each). */
  columns: number; rows: number;
  /** Pixels per map cell: 32 (4 × 4 tiles, the default and first choice since the author, 2026-11-02) or 16 (2 × 2 tiles); 8 went (the author, 2026-10-13: the catalog walls need 16). */
  cell: 16 | 32;
  seed: number;
  /** Cave: how much starts as rock (percent). */
  fill: number;
  /** Cave: smoothing passes (more: rounder, fewer specks). */
  smooth: number;
  /** Dungeon: rooms to try for, and their typical size in cells. */
  rooms: number; roomSize: number;
  /** Cave: keep only the biggest open area, so every floor cell can be reached. */
  connected: boolean;
  /** Stairs at two far-apart floor cells (a way in and a way on), marked start (an up arrow) and end (a down arrow). */
  stairs: boolean;
  /** A doorway wherever two screens meet (the author, 2026-11-02): a passage across the edge, its posts drawn. */
  doors?: boolean;
  /** Opt-in (the author, 2026-11-02: "Mark it in with a T or a E. then make sure its an opt-in checkbox"): a T on treasure spots (dead ends) and an E on enemy spots (open floor). */
  marks?: boolean;
  /** The palette it wears: a CAVE_THEMES id ("" or unknown: the GB greens). */
  theme?: string;
  /** The catalog's walls (16 px cells and up; unset: cliff32 for a cave, stone for a dungeon). */
  walls?: CaveWalls;
  /** The catalog's floor over the open cells (unset: a dungeon's tiled floor, grass under a forest, else the stone floor). */
  floor?: CaveFloor;
}

/**
 * The catalog walls a cave or dungeon can wear (the author, 2026-10-13): caves the Cliff ridges with a face two
 * cells (32 px) tall, dungeons the author's Room Border (2026-10-14; Stone wall 9-sliced before); any can take another.
 */
export type CaveWalls = "cliff32" | "cliff16" | "room" | "stone" | "brick" | "pines" | "oaks";
export const CAVE_WALLS: { value: CaveWalls; label: string }[] = [
  { value: "cliff32", label: "Cliff · 32 px walls" }, { value: "cliff16", label: "Cliff · 16 px walls" },
  { value: "room", label: "Room Border" }, { value: "stone", label: "Stone wall" }, { value: "brick", label: "Brick wall" },
  { value: "pines", label: "Pine forest" }, { value: "oaks", label: "Round forest" },
];
export const wallsOf = (settings: CaveSettings): CaveWalls => settings.walls ?? (settings.style === "dungeon" ? "room" : "cliff32");

/**
 * The catalog floors (the author, 2026-10-17: "why can't I choose a floor?"): an XP area sheet painted over the open
 * cells, its edges fitted where it meets the walls; "plain" is the flat light shade, as the 8 px cave had.
 */
export type CaveFloor = "stone" | "tile" | "tiles" | "wood" | "carpet" | "grass" | "dirt" | "sand" | "snow" | "flowers" | "plain";
export const CAVE_FLOORS: { value: CaveFloor; label: string }[] = [
  { value: "stone", label: "Stone floor" }, { value: "tile", label: "Tiled floor" }, { value: "tiles", label: "Floor tiles" },
  { value: "wood", label: "Wood floor" }, { value: "carpet", label: "Carpet" }, { value: "grass", label: "Grass" }, { value: "dirt", label: "Dirt" },
  { value: "sand", label: "Sand" }, { value: "snow", label: "Snow" }, { value: "flowers", label: "Flower bed" }, { value: "plain", label: "Plain" },
];
const FLOOR_SHEETS: Record<Exclude<CaveFloor, "plain">, Parameters<typeof sheet>[0]> = { stone: "xp-stone-floor", tile: "xp-tile-floor", tiles: "xp-ice", wood: "xp-wood-floor", carpet: "xp-carpet", grass: "xp-grass", dirt: "xp-dirt", sand: "xp-sand", snow: "xp-snow", flowers: "xp-flowers" };
/** The floor it wears: the one picked, else grass under a forest (`forest`: a forest stamp's), a dungeon's tiled floor, or a cave's stone floor. */
export const floorOf = (settings: CaveSettings, forest = false): CaveFloor => settings.floor ?? (forest || settings.walls === "pines" || settings.walls === "oaks" ? "grass" : settings.style === "dungeon" ? "tile" : "stone");

export const CAVE_DEFAULTS: CaveSettings = { style: "cave", columns: 2, rows: 2, cell: 32, seed: 1, fill: 46, smooth: 4, rooms: 8, roomSize: 3, connected: true, stairs: true };

/** The cave grid's cells besides rock (1) and plain floor (0): every one of them is floor. */
export const STAIRS = 2, DOOR_ACROSS = 3, DOOR_DOWN = 4, TREASURE = 5, ENEMY = 6;

/** The cave's grid: 1 rock, 0 floor (2 stairs, 3 / 4 doorways, 5 treasure, 6 enemy), the edge always rock; `start` and `end` the stairs (-1 none). */
export function caveGrid(settings: CaveSettings, topRows?: number): { w: number; h: number; grid: Uint8Array; start: number; end: number } {
  // 32-pixel cells don't divide a 144-pixel screen: the grid runs one row past it and the picture is cut to the screens.
  const w = Math.max(3, Math.ceil(settings.columns * SCREEN_W / settings.cell)), h = Math.max(3, Math.ceil(settings.rows * SCREEN_H / settings.cell));
  const random = seeded(settings.seed);
  // The rock along the top is thick enough to show cliff top above its face (the author, 2026-10-14: the top row was
  // all wall): a cliff face is one cell (16 px walls) or two (32 px) tall, plus a row of top above it.
  // `topRows`: the rows a project's own cliff stamp needs (the wizard knows which it is; this grid only knows the catalog's).
  const walls = wallsOf(settings), top = settings.cell !== 16 ? 1 : topRows ?? (walls === "cliff32" ? 3 : walls === "cliff16" ? 2 : 1);
  const edge = (x: number, y: number) => x === 0 || y < top || x === w - 1 || y === h - 1;
  let grid = new Uint8Array(w * h).fill(1);
  if (settings.style === "cave") {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) grid[y * w + x] = edge(x, y) || random() * 100 < settings.fill ? 1 : 0;
    // A pocket of floor near the middle of every screen, so no screen ends up solid rock (joined up below).
    const perX = SCREEN_W / settings.cell, perY = SCREEN_H / settings.cell, radius = Math.max(1.5, Math.min(perX, perY) / 4);
    for (let sy = 0; sy < settings.rows; sy += 1) for (let sx = 0; sx < settings.columns; sx += 1) {
      const cx = (sx + 0.5) * perX + (random() - 0.5) * perX / 3, cy = (sy + 0.5) * perY + (random() - 0.5) * perY / 3;
      for (let y = top; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) if (Math.hypot(x - cx, y - cy) <= radius) grid[y * w + x] = 0;
    }
    for (let pass = 0; pass < settings.smooth; pass += 1) {
      const next = new Uint8Array(w * h);
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
        if (edge(x, y)) { next[y * w + x] = 1; continue; }
        let rock = 0;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if ((dx || dy) && grid[(y + dy) * w + x + dx]) rock += 1;
        next[y * w + x] = rock > 4 ? 1 : rock < 4 ? 0 : grid[y * w + x];
      }
      grid = next;
    }
    // No rock one cell thin (the author, 2026-10-13): a spur with floor on both sides, or a ledge with floor above and
    // below, can only be drawn as a sliver of wall, so it wears away into floor (again, until none is left).
    wearThinRock(grid, w, h);
    if (settings.connected) { joinAreas(grid, w, h); wearThinRock(grid, w, h); }
  } else {
    carveRooms(grid, w, h, settings, random);
    // Thickening can cut a corridor and the tunnel that rejoins it can leave a new thin wall: a few rounds settle it.
    for (let round = 0; round < 4 && thickenWalls(grid, w, h); round += 1) joinAreas(grid, w, h);
    // A thin wall that keeps coming back (the rejoining tunnel needs it) is opened instead: the two spaces become one.
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) if (grid[y * w + x] === 1 && grid[(y + 1) * w + x] !== 1 && grid[(y - 1) * w + x] !== 1) grid[y * w + x] = 0;
  }
  const doors = settings.doors ?? true;
  if (doors) { carveDoorways(grid, w, h, settings, top); markDoorways(grid, w, h, settings, top); }
  const [start, end] = settings.stairs ? placeStairs(grid, w, h) : [-1, -1];
  if (settings.marks) placeMarks(grid, w, h, settings, start);
  return { w, h, grid, start, end };
}

/** Where screens meet, in cells: each inner vertical edge (`at`: the cell right of it) and horizontal edge (the cell below it), with each screen's span of cells along it. */
function screenEdges(w: number, h: number, settings: CaveSettings, top: number) {
  const span = (from: number, to: number, low: number, high: number) => [Math.max(low, Math.ceil(from / settings.cell)), Math.min(high, Math.ceil(to / settings.cell) - 1)] as const;
  const edges: { across: boolean; at: number; from: number; to: number }[] = [];
  for (let sx = 1; sx < settings.columns; sx += 1) for (let sy = 0; sy < settings.rows; sy += 1) {
    const [from, to] = span(sy * SCREEN_H, (sy + 1) * SCREEN_H, top, h - 2);
    edges.push({ across: true, at: Math.round(sx * SCREEN_W / settings.cell), from, to });
  }
  for (let sy = 1; sy < settings.rows; sy += 1) for (let sx = 0; sx < settings.columns; sx += 1) {
    const [from, to] = span(sx * SCREEN_W, (sx + 1) * SCREEN_W, 1, w - 2);
    edges.push({ across: false, at: Math.max(top + 1, Math.round(sy * SCREEN_H / settings.cell)), from, to });
  }
  return edges;
}

/**
 * A way through every edge where two screens meet: when no floor already crosses it, a passage is carved across it
 * (in the middle of the screen's span, out both ways to the nearest floor), and the areas are joined again.
 */
function carveDoorways(grid: Uint8Array, w: number, h: number, settings: CaveSettings, top: number) {
  let carved = false;
  for (const { across, at, from, to } of screenEdges(w, h, settings, top)) {
    if (from > to) continue;
    const cell = (along: number, step: number) => across ? along * w + at + step : (at + step) * w + along;
    let open = false;
    for (let along = from; along <= to && !open; along += 1) open = grid[cell(along, -1)] !== 1 && grid[cell(along, 0)] !== 1;
    if (open) continue;
    const along = Math.floor((from + to) / 2), low = across ? 1 : top, high = (across ? w : h) - 2;
    grid[cell(along, -1)] = 0; grid[cell(along, 0)] = 0;
    for (let step = -2; at + step >= low && grid[cell(along, step)] === 1; step -= 1) grid[cell(along, step)] = 0;
    for (let step = 1; at + step <= high && grid[cell(along, step)] === 1; step += 1) grid[cell(along, step)] = 0;
    carved = true;
  }
  if (!carved) return;
  joinAreas(grid, w, h);
  // A passage can leave rock one cell thin beside it, which the walls can't draw: as after the cave's own tunnels.
  if (settings.style === "cave") wearThinRock(grid, w, h);
  else for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) if (grid[y * w + x] === 1 && grid[(y + 1) * w + x] !== 1 && grid[(y - 1) * w + x] !== 1) grid[y * w + x] = 0;
}

/** One doorway on each screen edge: the floor cell just past the edge nearest the middle of the screen's span (3 walked across, 4 walked down). */
function markDoorways(grid: Uint8Array, w: number, h: number, settings: CaveSettings, top: number) {
  for (const { across, at, from, to } of screenEdges(w, h, settings, top)) {
    const middle = (from + to) / 2;
    const cell = (along: number, step: number) => across ? along * w + at + step : (at + step) * w + along;
    // A crossing: floor on both sides, one of them plain (a corner where two edges meet can hold the other's doorway).
    let best = -1;
    for (let along = from; along <= to; along += 1) if (grid[cell(along, -1)] !== 1 && grid[cell(along, 0)] !== 1 && (grid[cell(along, -1)] === 0 || grid[cell(along, 0)] === 0) && (best < 0 || Math.abs(along - middle) < Math.abs(best - middle))) best = along;
    if (best >= 0) grid[cell(best, grid[cell(best, 0)] === 0 ? 0 : -1)] = across ? DOOR_ACROSS : DOOR_DOWN;
  }
}

/**
 * Treasure and enemy spots (opt-in): a T on the dead ends farthest from the start (one a screen), an E on open floor
 * (three or four open sides) well apart from each other, the stairs and the treasure (two a screen). Its own random
 * numbers, so ticking it never moves the cave.
 */
function placeMarks(grid: Uint8Array, w: number, h: number, settings: CaveSettings, start: number) {
  const random = seeded(settings.seed ^ 0x7e57);
  const plain = Array.from(grid.keys()).filter((at) => grid[at] === 0);
  if (!plain.length) return;
  const openSides = (at: number) => [at - w, at + w, at - 1, at + 1].filter((next) => grid[next] !== 1).length;
  const from = start >= 0 ? distances(grid, w, h, start, (cell) => cell !== 1) : null;
  const screens = settings.columns * settings.rows;
  const spaced = (at: number, others: number[], gap: number) => others.every((other) => Math.hypot(other % w - at % w, Math.floor(other / w) - Math.floor(at / w)) >= gap);
  const taken = Array.from(grid.keys()).filter((at) => grid[at] === STAIRS);
  const ends = plain.filter((at) => openSides(at) === 1).sort((a, b) => (from ? from[b] - from[a] : 0) || a - b);
  let treasure = 0;
  for (const at of ends) {
    if (treasure >= screens) break;
    if (spaced(at, taken, 3)) { grid[at] = TREASURE; taken.push(at); treasure += 1; }
  }
  const gap = Math.max(3, Math.min(SCREEN_W, SCREEN_H) / settings.cell / 2);
  const open = plain.filter((at) => grid[at] === 0 && openSides(at) >= 3);
  for (let count = 0, tries = 0; count < screens * 2 && tries < open.length * 2; tries += 1) {
    const at = open[Math.floor(random() * open.length)];
    if (grid[at] !== 0 || !spaced(at, taken, gap)) continue;
    grid[at] = ENEMY; taken.push(at); count += 1;
  }
}

/**
 * Walls at least two cells tall: a wall with floor right above and right below (a room under a corridor, say) takes
 * the floor cell above it too, so it is drawn with its top and its face, not a face alone. What that cuts off is
 * joined up again afterwards (joinAreas).
 */
function thickenWalls(grid: Uint8Array, w: number, h: number): boolean {
  const thin: number[] = [];
  for (let y = 1; y < h - 1; y += 1) for (let x = 0; x < w; x += 1) if (grid[y * w + x] === 1 && grid[(y + 1) * w + x] !== 1 && grid[(y - 1) * w + x] !== 1) thin.push((y - 1) * w + x);
  for (const at of thin) grid[at] = 1;
  return thin.length > 0;
}

/** Rock one cell thin (floor on both sides, or above and below) wears away into floor, until none is left. */
function wearThinRock(grid: Uint8Array, w: number, h: number) {
  const open = (at: number) => grid[at] !== 1;
  for (let changed = true, round = 0; changed && round < 16; round += 1) {
    changed = false;
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
      const at = y * w + x;
      if (grid[at] === 1 && ((open(at - 1) && open(at + 1)) || (open(at - w) && open(at + w)))) { grid[at] = 0; changed = true; }
    }
  }
}

/** Rooms that don't touch, each joined to the nearest room already joined by an L-shaped corridor. */
function carveRooms(grid: Uint8Array, w: number, h: number, settings: CaveSettings, random: () => number) {
  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  for (let tries = 0; tries < settings.rooms * 30 && rooms.length < settings.rooms; tries += 1) {
    const rw = Math.max(2, Math.round(settings.roomSize * (0.6 + random() * 0.8))), rh = Math.max(2, Math.round(settings.roomSize * (0.5 + random() * 0.7)));
    if (rw > w - 2 || rh > h - 2) continue;
    const room = { x: 1 + Math.floor(random() * (w - 1 - rw)), y: 1 + Math.floor(random() * (h - 1 - rh)), w: rw, h: rh };
    // At least two cells of wall between rooms (the author, 2026-10-13: one is too thin to show a wall's top and face).
    if (rooms.some((other) => room.x <= other.x + other.w + 1 && other.x <= room.x + room.w + 1 && room.y <= other.y + other.h + 1 && other.y <= room.y + room.h + 1)) continue;
    rooms.push(room);
  }
  for (const room of rooms) for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) grid[y * w + x] = 0;
  const centre = (room: (typeof rooms)[number]) => [Math.floor(room.x + room.w / 2), Math.floor(room.y + room.h / 2)];
  for (let at = 1; at < rooms.length; at += 1) {
    const [x1, y1] = centre(rooms[at]);
    let best = 0, bestDistance = Infinity;
    for (let other = 0; other < at; other += 1) { const [x2, y2] = centre(rooms[other]); const d = Math.abs(x1 - x2) + Math.abs(y1 - y2); if (d < bestDistance) { bestDistance = d; best = other; } }
    const [x2, y2] = centre(rooms[best]);
    const bendFirst = random() < 0.5;
    const cornerX = bendFirst ? x2 : x1, cornerY = bendFirst ? y1 : y2;
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x += 1) grid[(bendFirst ? y1 : y2) * w + x] = 0;
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y += 1) grid[y * w + (bendFirst ? x2 : x1)] = 0;
    grid[cornerY * w + cornerX] = 0;
  }
}

/**
 * Every open area joined to the biggest by a tunnel (an L from the area's middle to the nearest floor of the main
 * cave), so the whole map gets used; pockets of fewer than four cells are filled in instead.
 */
function joinAreas(grid: Uint8Array, w: number, h: number) {
  for (let pass = 0; pass < 64; pass += 1) {
    const { area, sizes } = labelAreas(grid, w, h);
    if (sizes.length <= 1) return;
    const main = sizes.indexOf(Math.max(...sizes));
    // The next area to join: the biggest that isn't the main one (tiny ones are filled).
    let next = -1;
    sizes.forEach((size, id) => { if (id !== main && (next < 0 || size > sizes[next])) next = id; });
    if (sizes[next] < 4) { for (let at = 0; at < w * h; at += 1) if (!grid[at] && area[at] !== main) grid[at] = 1; return; }
    const cells: number[] = [], mainCells: number[] = [];
    for (let at = 0; at < w * h; at += 1) { if (area[at] === next) cells.push(at); else if (area[at] === main) mainCells.push(at); }
    const cx = cells.reduce((sum, at) => sum + (at % w), 0) / cells.length, cy = cells.reduce((sum, at) => sum + Math.floor(at / w), 0) / cells.length;
    const from = cells.reduce((best, at) => Math.hypot(at % w - cx, Math.floor(at / w) - cy) < Math.hypot(best % w - cx, Math.floor(best / w) - cy) ? at : best, cells[0]);
    const to = mainCells.reduce((best, at) => Math.abs(at % w - from % w) + Math.abs(Math.floor(at / w) - Math.floor(from / w)) < Math.abs(best % w - from % w) + Math.abs(Math.floor(best / w) - Math.floor(from / w)) ? at : best, mainCells[0]);
    let x = from % w, y = Math.floor(from / w);
    const tx = to % w, ty = Math.floor(to / w);
    while (x !== tx) { x += Math.sign(tx - x); grid[y * w + x] = 0; }
    while (y !== ty) { y += Math.sign(ty - y); grid[y * w + x] = 0; }
  }
}

/** Floor areas joined by sides: each floor cell's area id, and each area's size. */
function labelAreas(grid: Uint8Array, w: number, h: number): { area: Int32Array; sizes: number[] } {
  const area = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  for (let start = 0; start < w * h; start += 1) {
    if (grid[start] || area[start] >= 0) continue;
    const id = sizes.length, stack = [start];
    area[start] = id; let size = 0;
    while (stack.length) {
      const at = stack.pop()!; size += 1;
      const x = at % w, y = Math.floor(at / w);
      for (const [dx, dy] of SIDES) {
        const nx = x + dx, ny = y + dy, next = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && !grid[next] && area[next] < 0) { area[next] = id; stack.push(next); }
      }
    }
    sizes.push(size);
  }
  return { area, sizes };
}


/** Steps from one floor cell to every other (-1 unreachable). */
function distances(grid: Uint8Array, w: number, h: number, from: number, passable: (cell: number) => boolean): Int32Array {
  const distance = new Int32Array(w * h).fill(-1);
  distance[from] = 0;
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head], x = at % w, y = Math.floor(at / w);
    for (const [dx, dy] of SIDES) {
      const nx = x + dx, ny = y + dy, next = ny * w + nx;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && distance[next] < 0 && passable(grid[next])) { distance[next] = distance[at] + 1; queue.push(next); }
    }
  }
  return distance;
}

/** Stairs at the two floor cells farthest apart (found from any floor cell, then from the farthest one). */
function placeStairs(grid: Uint8Array, w: number, h: number): [number, number] {
  const first = grid.indexOf(0);
  if (first < 0) return [-1, -1];
  // Only plain floor takes stairs, found walking any floor.
  const farthest = (distance: Int32Array) => distance.reduce((best, d, at) => grid[at] === 0 && d > distance[best] ? at : best, first);
  const a = farthest(distances(grid, w, h, first, (cell) => cell !== 1));
  const b = farthest(distances(grid, w, h, a, (cell) => cell !== 1));
  if (a === b) return [-1, -1];
  grid[a] = STAIRS; grid[b] = STAIRS;
  return [a, b];
}

/** A stamp sheet the cave draws with instead of the placeholder art (src/app/autotile.ts layouts). */
export interface CaveTiles { kind: "wallface" | "wang" | "edges" | "corner" | "path" | "forest" | "xpCliff" | "xpCliffTall" | "xp"; pixels: Uint8Array; width: number }

/**
 * The cave drawn in the author's style (2026-10-10), tile by tile: black for nothing (shade 3), light floors (shade 1),
 * and dark walls (shade 2) two tiles tall wherever nothing sits right above a floor, outlined in white (shade 0) on
 * every side that doesn't meet more wall. Stairs are a box of steps on the floor.
 * With `tiles`, the project's own auto-tile stamp draws it instead: a wall-face sheet (F) the floor, walls and
 * nothing; a Wang sheet (W, or E for edges only) the rock around the floor (the floor stays plain).
 */
export function drawCave(settings: CaveSettings, given?: CaveTiles | null, floorGiven?: CaveTiles | null): Generated {
  // The project's own area stamps stand in for the catalog's (the author, 2026-10-17): a forest, a Cliff (its face one
  // cell tall, as it paints) or a tall Cliff (two cells) or an area (X) for the walls, and an area (X) for the floor.
  // They need 16 px cells, like the catalog's art; an F / W / E sheet draws tile by tile below instead.
  const asArt = (t: CaveTiles) => ({ width: t.width, height: t.pixels.length / t.width, pixels: t.pixels });
  const area = given && (given.kind === "forest" || given.kind === "xpCliff" || given.kind === "xpCliffTall" || given.kind === "xp") ? given : null;
  const tiles = area ? null : given;
  const { w, h, grid, ...caveMarks } = caveGrid(settings, area?.kind === "xpCliffTall" ? 3 : area?.kind === "xpCliff" ? 2 : area ? 1 : undefined);
  const size = settings.cell, per = size / 8;
  const out: Generated = { width: w * size, height: h * size, pixels: new Uint8Array(w * size * h * size) };
  const theme = themeOf(CAVE_THEMES, settings.theme ?? "");
  if (theme) { out.cells = new Uint16Array(Math.ceil(out.width / 8) * Math.ceil(out.height / 8)).fill(1); out.palettes = theme.palettes.map(({ name, colors }) => ({ name, colors: [...colors] })); }
  // Tiles: floor where the grid is open; wall in the two tiles above a floor that aren't floor.
  const tw = w * per, th = h * per;
  const floor = (x: number, y: number) => x >= 0 && y >= 0 && x < tw && y < th && grid[Math.floor(y / per) * w + Math.floor(x / per)] !== 1;
  const wall = (x: number, y: number) => x >= 0 && y >= 0 && x < tw && y < th && !floor(x, y) && (floor(x, y + 1) || (floor(x, y + 2) && !floor(x, y + 1)));
  const blit = (x: number, y: number, column: number, row: number) => {
    for (let py = 0; py < 8; py += 1) out.pixels.set(tiles!.pixels.subarray((row * 8 + py) * tiles!.width + column * 8, (row * 8 + py) * tiles!.width + column * 8 + 8), (y * 8 + py) * out.width + x * 8);
  };
  // With no F / W / E sheet and cells of 16 px or more: drawn with the library's pieces (2026-10-13), the rock as the
  // walls picked (or the project's own stamp) and the open cells as the floor picked.
  if (!tiles && size >= 16) {
    const sub = size / 16, cw = w * sub, ch = h * sub, canvasOut = { width: out.width, height: out.height, pixels: out.pixels };
    const open = (x: number, y: number) => grid[Math.floor(y / sub) * w + Math.floor(x / sub)] !== 1;
    out.pixels.fill(3);
    const walls = wallsOf(settings), rock = (x: number, y: number) => !open(x, y);
    const woods = area?.kind === "forest" || (!area && (walls === "pines" || walls === "oaks"));
    const ground = floorOf(settings, area?.kind === "forest"), groundArt = floorGiven?.kind === "xp" ? asArt(floorGiven) : ground === "plain" ? null : sheet(FLOOR_SHEETS[ground]);
    const paintGround = (where: (x: number, y: number) => boolean, beyond: boolean) => {
      if (groundArt) paintXp(canvasOut, groundArt, where, cw, ch, beyond);
      else for (let y = 0; y < ch; y += 1) for (let x = 0; x < cw; x += 1) if (where(x, y)) new Pen(out, x * 16, y * 16, 16).fill(1);
    };
    // A forest stands on its floor: the floor goes down everywhere first, the trees over the rock.
    if (woods) paintGround(() => true, true);
    if (area?.kind === "forest") paintWoods(canvasOut, rock, cw, ch, false, asArt(area));
    else if (area?.kind === "xpCliff" || area?.kind === "xpCliffTall") paintCliffs(canvasOut, rock, cw, ch, 0, 0, area.kind === "xpCliffTall", true, asArt(area));
    else if (area?.kind === "xp") paintXp(canvasOut, asArt(area), rock, cw, ch, true);
    else if (walls === "cliff32" || walls === "cliff16") paintCliffs(canvasOut, rock, cw, ch, 0, 0, walls === "cliff32", true);
    // Room Border (the author's, 2026-10-14): the dungeon's walls by default, an XP area beyond the map's edge too.
    else if (walls === "room") paintXp(canvasOut, sheet("room-border"), rock, cw, ch, true);
    else if (walls === "brick") paintXp(canvasOut, sheet("xp-brick-square"), rock, cw, ch, true);
    else if (walls === "pines" || walls === "oaks") paintWoods(canvasOut, rock, cw, ch, walls === "pines");
    else paintSliced(canvasOut, sheet("pat-stone-wall"), rock, cw, ch);
    if (!woods) paintGround(open, false);
  } else for (let y = 0; y < th; y += 1) for (let x = 0; x < tw; x += 1) {
    const pen = new Pen(out, x * 8, y * 8, 8);
    if (tiles?.kind === "wallface") {
      // As the Wall face stamp paints (usePainting): floor, the face with its ends, nothing.
      const kind = (kx: number, ky: number) => floor(kx, ky) ? "floor" : floor(kx, ky + 1) ? "face" : "none";
      const here = kind(x, y);
      if (here === "floor" || here === "none") { blit(x, y, here === "floor" ? 0 : 1, 0); continue; }
      const left = kind(x - 1, y) !== here, right = kind(x + 1, y) !== here;
      blit(x, y, left && right ? 3 : right ? 2 : left ? 1 : 0, 1);
      continue;
    }
    if (tiles && !floor(x, y)) {
      // Rock as a Wang area: off the map counts as rock.
      const rock = (rx: number, ry: number) => rx < 0 || ry < 0 || rx >= tw || ry >= th || !floor(rx, ry);
      const slot = tiles.kind === "wang" ? wangSlot(maskAt(rock, x, y)) : slot16(edgeMask(rock, x, y));
      blit(x, y, slot.column, slot.row);
      continue;
    }
    if (floor(x, y)) { pen.fill(1); continue; }
    if (!wall(x, y)) { pen.fill(3); continue; }
    pen.fill(2);
    SIDES.forEach(([dx, dy], side) => { if (!wall(x + dx, y + dy)) pen.side(side, 0); });
  }
  const { start } = caveMarks;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const cell = grid[y * w + x], pen = new Pen(out, x * size, y * size, size), inset = size / 8;
    if (cell === STAIRS) {
      // Stairs: a box of steps on their cell, with an arrow on a plate: up at the start (the way in), down at the end.
      pen.rect(inset, inset, size - inset * 2, size - inset * 2, 0);
      pen.box(inset, inset, size - inset * 2, size - inset * 2, 3);
      for (let step = inset + 2; step < size - inset - 1; step += size * 3 / 16) pen.rect(inset, step, size - inset * 2, 1, 2);
      drawGlyph(pen, y * w + x === start ? "up" : "down", size);
    } else if (cell === DOOR_ACROSS || cell === DOOR_DOWN) {
      // A doorway where screens meet: two dark posts either side of the way through, on the edge it crosses.
      const post = Math.max(2, size / 8), length = Math.max(4, size / 4);
      if (cell === DOOR_ACROSS) { pen.rect(0, 0, post, length, 3); pen.rect(0, size - length, post, length, 3); pen.rect(post, 0, 1, length, 0); pen.rect(post, size - length, 1, length, 0); }
      else { pen.rect(0, 0, length, post, 3); pen.rect(size - length, 0, length, post, 3); pen.rect(0, post, length, 1, 0); pen.rect(size - length, post, length, 1, 0); }
    } else if (cell === TREASURE || cell === ENEMY) drawGlyph(pen, cell === TREASURE ? "T" : "E", size);
  }
  const cropped = cropTo(out, Math.min(out.width, settings.columns * SCREEN_W), Math.min(out.height, settings.rows * SCREEN_H));
  // Collisions for GB Studio (the author, 2026-11-02): the rock solid, every floor cell open.
  cropped.collisions = tileCollisions(cropped.width, cropped.height, (tx, ty) => grid[Math.floor(ty / per) * w + Math.floor(tx / per)] === 1);
  return cropped;
}

/** 3 × 5 pixel letters and arrows for the cave's marks, a row a string. */
const GLYPHS: Record<"T" | "E" | "up" | "down", string[]> = {
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  E: ["###", "#..", "##.", "#..", "###"],
  up: [".#.", "###", "#.#", ".#.", ".#."],
  down: [".#.", ".#.", "#.#", "###", ".#."],
};

/** A mark on a light plate in the middle of a cell: dark (shade 3) on the lightest shade, so it reads on any floor. */
function drawGlyph(pen: Pen, glyph: keyof typeof GLYPHS, size: number) {
  const scale = size >= 32 ? 3 : 2, gw = 3 * scale, gh = 5 * scale, x0 = Math.floor((size - gw) / 2), y0 = Math.floor((size - gh) / 2);
  pen.rect(x0 - 1, y0 - 1, gw + 2, gh + 2, 0);
  pen.box(x0 - 2, y0 - 2, gw + 4, gh + 4, 3);
  GLYPHS[glyph].forEach((row, gy) => [...row].forEach((dot, gx) => { if (dot === "#") pen.rect(x0 + gx * scale, y0 + gy * scale, scale, scale, 3); }));
}

/** One GB Studio collision value per 8 × 8 tile of a `width` × `height` picture: Solid where `solid`, else open. */
function tileCollisions(width: number, height: number, solid: (tx: number, ty: number) => boolean): Uint8Array {
  const tw = Math.ceil(width / 8), th = Math.ceil(height / 8), out = new Uint8Array(tw * th);
  for (let ty = 0; ty < th; ty += 1) for (let tx = 0; tx < tw; tx += 1) if (solid(tx, ty)) out[ty * tw + tx] = SOLID;
  return out;
}

/**
 * A forest for walls (the author, 2026-10-13: "a forest style, using the pine or oak"), over the floor already down:
 * the rock as the pine or round forest brush (or `art`, a project's forest stamp) on 32 px units wherever a whole unit
 * is rock, and a lone tree from the author's Outdoor tiles in each rock cell left over, so no rock is left bare.
 */
function paintWoods(out: { width: number; height: number; pixels: Uint8Array }, rock: (x: number, y: number) => boolean, cw: number, ch: number, pines: boolean, art?: { width: number; height: number; pixels: Uint8Array }) {
  const uw = Math.ceil(cw / 2), uh = Math.ceil(ch / 2);
  const unit = (ux: number, uy: number) => [0, 1].every((dy) => [0, 1].every((dx) => { const x = ux * 2 + dx, y = uy * 2 + dy; return x >= cw || y >= ch || rock(x, y); }));
  paintForest(out, art ?? sheet(pines ? "pines" : "round"), unit, uw, uh);
  for (let y = 0; y < ch; y += 1) for (let x = 0; x < cw; x += 1) {
    if (!rock(x, y) || unit(x >> 1, y >> 1)) continue;
    if (!outdoorTile(out, pines ? "pine" : "tree", x * 16, y * 16)) OUTDOOR[pines ? "pine" : "tree"].draw(new Pen(out, x * 16, y * 16, 16));
  }
}

/** The picture cut to `width` × `height` from its top left (its tile palettes too). */
function cropTo(picture: Generated, width: number, height: number): Generated {
  if (width === picture.width && height === picture.height) return picture;
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) pixels.set(picture.pixels.subarray(y * picture.width, y * picture.width + width), y * width);
  const out: Generated = { ...picture, width, height, pixels };
  if (picture.cells) {
    const from = Math.ceil(picture.width / 8), to = Math.ceil(width / 8);
    out.cells = new Uint16Array(to * Math.ceil(height / 8));
    for (let y = 0; y < Math.ceil(height / 8); y += 1) out.cells.set(picture.cells.subarray(y * from, y * from + to), y * to);
  }
  return out;
}

// ---- RPG-style overworld --------------------------------------------------------------------------------------------

export interface WorldSettings {
  columns: number; rows: number;
  seed: number;
  /** Percent of the map under water. */
  water: number;
  /** Percent of the land that is mountains (the highest land). */
  mountains: number;
  /** Percent of the remaining land that is forest (the dampest). */
  forest: number;
  /** Towns to place on open grass, spread apart. */
  towns: number;
  /** Feature size: bigger is broader land and seas. */
  scale: number;
  /** Water all round the edge. */
  island: boolean;
  /** Roads joining the towns (round water and mountains). */
  roads: boolean;
  /** The palettes it wears: a WORLD_THEMES id ("" or unknown: the GB greens). */
  theme: string;
  /** The land it is (the author, 2026-11-02): which trees it grows; the wizard also picks the biome's palettes and sliders. */
  biome?: Biome;
  /**
   * A rough shape painted first (the author, 2026-11-02), SHAPE_W × SHAPE_H stretched over the map: 0 left to the
   * generator, LAND or SEA. Painted land stays land and painted water water; the noise fills in round them.
   */
  shape?: Uint8Array | null;
}

export type Biome = "grassland" | "desert" | "snow" | "swamp";
/** Each biome's palettes (a WORLD_THEMES id) and the sliders it starts from. */
export const BIOMES: { value: Biome; label: string; theme: string; settings: Partial<WorldSettings> }[] = [
  { value: "grassland", label: "Grassland", theme: "overworld", settings: { water: 35, mountains: 18, forest: 35 } },
  { value: "desert", label: "Desert", theme: "biome-desert", settings: { water: 10, mountains: 25, forest: 8 } },
  { value: "snow", label: "Snow", theme: "biome-snow", settings: { water: 30, mountains: 30, forest: 40 } },
  { value: "swamp", label: "Swamp", theme: "biome-swamp", settings: { water: 45, mountains: 5, forest: 55 } },
];

export const SHAPE_W = 16, SHAPE_H = 16, LAND = 1, SEA = 2;

export const WORLD_DEFAULTS: WorldSettings = { columns: 3, rows: 3, seed: 1, water: 35, mountains: 18, forest: 35, towns: 3, scale: 5, island: true, roads: true, theme: "overworld" };

/** BRIDGE (the author, 2026-11-02): a road over water. */
export const WATER = 0, SHORE = 1, GRASS = 2, FOREST = 3, MOUNTAIN = 4, TOWN = 5, ROAD = 6, BRIDGE = 7;

/** Each terrain's palette in a seven-palette theme (1-based): grass 1, forest 2, mountain 3, water 4 (bridges too), shore 5, road 6, town 7. */
const TERRAIN_PALETTE: Record<number, number> = { [GRASS]: 1, [FOREST]: 2, [MOUNTAIN]: 3, [WATER]: 4, [SHORE]: 5, [ROAD]: 6, [TOWN]: 7, [BRIDGE]: 4 };

/** The painted shape over the map's cells: +1 land … -1 water, blended between the shape's squares (0: unpainted). */
function shapeField(shape: Uint8Array, w: number, h: number): Float32Array {
  const value = (sx: number, sy: number) => { const v = shape[Math.min(SHAPE_H - 1, Math.max(0, sy)) * SHAPE_W + Math.min(SHAPE_W - 1, Math.max(0, sx))]; return v === LAND ? 1 : v === SEA ? -1 : 0; };
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const fx = (x + 0.5) / w * SHAPE_W - 0.5, fy = (y + 0.5) / h * SHAPE_H - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const top = value(ix, iy) * (1 - tx) + value(ix + 1, iy) * tx, bottom = value(ix, iy + 1) * (1 - tx) + value(ix + 1, iy + 1) * tx;
    out[y * w + x] = top * (1 - ty) + bottom * ty;
  }
  return out;
}

/** Smooth noise: random values on a lattice, blended (smoothstep) between them, a few octaves summed. */
function valueNoise(w: number, h: number, period: number, random: () => number): Float32Array {
  const out = new Float32Array(w * h);
  let amplitude = 1, total = 0;
  for (let octave = 0, step = period; octave < 4 && step >= 1; octave += 1, step /= 2, amplitude /= 2) {
    const gw = Math.ceil(w / step) + 2, gh = Math.ceil(h / step) + 2;
    const lattice = Float32Array.from({ length: gw * gh }, () => random());
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const fx = x / step, fy = y / step, ix = Math.floor(fx), iy = Math.floor(fy);
      const sx = (fx - ix) * (fx - ix) * (3 - 2 * (fx - ix)), sy = (fy - iy) * (fy - iy) * (3 - 2 * (fy - iy));
      const at = (gx: number, gy: number) => lattice[gy * gw + gx];
      const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx, bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
      out[y * w + x] += (top + (bottom - top) * sy) * amplitude;
    }
    total += amplitude;
  }
  for (let at = 0; at < out.length; at += 1) out[at] /= total;
  return out;
}

/** The value below which `percent` of the given values lie. */
function cut(values: ArrayLike<number>, percent: number): number {
  const sorted = Array.from(values).sort((a, b) => a - b);
  if (!sorted.length || percent <= 0) return -Infinity;
  if (percent >= 100) return Infinity;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percent / 100))];
}

/** The overworld's grid of terrain (WATER … ROAD), 16-pixel cells. */
export function worldGrid(settings: WorldSettings): { w: number; h: number; grid: Uint8Array } {
  const w = settings.columns * SCREEN_W / 16, h = Math.floor(settings.rows * SCREEN_H / 16);
  const random = seeded(settings.seed);
  const height = valueNoise(w, h, Math.max(1, settings.scale), random);
  const damp = valueNoise(w, h, Math.max(1, settings.scale * 0.7), random);
  if (settings.island) {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const dx = (x + 0.5) / w * 2 - 1, dy = (y + 0.5) / h * 2 - 1;
      height[y * w + x] -= Math.max(0, Math.hypot(dx, dy) - 0.35) * 0.9;
    }
  }
  const grid = new Uint8Array(w * h).fill(GRASS);
  // A painted shape decides the cells well inside its land and water; the rest (its edges, the unpainted) go by height,
  // nudged towards the shape, with the Water share of them under water.
  const field = settings.shape?.some((value) => value) ? shapeField(settings.shape, w, h) : null;
  const level = field ? Float32Array.from(height, (value, at) => value + field[at] * 0.5) : height;
  const open = field ? Array.from(level.keys()).filter((at) => Math.abs(field[at]) <= 0.35) : null;
  const sea = cut(open ? open.map((at) => level[at]) : level, settings.water);
  const land: number[] = [];
  for (let at = 0; at < w * h; at += 1) {
    const wet = field && field[at] < -0.35 ? true : field && field[at] > 0.35 ? false : level[at] < sea;
    if (wet || (settings.island && settings.water > 0 && edgeCell(at, w, h))) grid[at] = WATER; else land.push(at);
  }
  const peak = cut(land.map((at) => height[at]), 100 - settings.mountains);
  for (const at of land) if (settings.mountains > 0 && height[at] >= peak) grid[at] = MOUNTAIN;
  const lowland = land.filter((at) => grid[at] === GRASS);
  const wet = cut(lowland.map((at) => damp[at]), 100 - settings.forest);
  for (const at of lowland) if (settings.forest > 0 && damp[at] >= wet) grid[at] = FOREST;
  // Clean-up (the author, 2026-10-14: the overworld looked messy): mountains, forests and lakes only where they make
  // whole 2 × 2 blocks (no one-cell nubs, stray trees or puddles), after smoothing away lone specks.
  for (let pass = 0; pass < 2; pass += 1) smoothTerrain(grid, w, h);
  keepBlocks(grid, w, h, MOUNTAIN, GRASS); keepBlocks(grid, w, h, FOREST, GRASS); keepBlocks(grid, w, h, WATER, GRASS, true);
  // Shore: land (not mountain) beside water.
  for (let at = 0; at < w * h; at += 1) {
    if (grid[at] !== GRASS && grid[at] !== FOREST) continue;
    const x = at % w, y = Math.floor(at / w);
    if (SIDES.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < h && grid[ny * w + nx] === WATER; })) grid[at] = SHORE;
  }
  placeTowns(grid, w, h, settings, random);
  return { w, h, grid };
}

/** A cell with fewer than two neighbours of its kind (of four) takes the kind most of its neighbours have. */
function smoothTerrain(grid: Uint8Array, w: number, h: number) {
  const before = grid.slice();
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const kinds = SIDES.map(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < h ? before[ny * w + nx] : before[y * w + x]; });
    const own = before[y * w + x];
    if (kinds.filter((kind) => kind === own).length >= 2) continue;
    const counts = new Map<number, number>();
    for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
    grid[y * w + x] = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  }
}

/** Keeps `kind` only in cells that are part of a whole 2 × 2 block of it (off the map counts, with `edges`). */
function keepBlocks(grid: Uint8Array, w: number, h: number, kind: number, instead: number, edges = false) {
  const is = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h ? edges : grid[y * w + x] === kind;
  const keep = new Uint8Array(w * h);
  for (let y = -1; y < h; y += 1) for (let x = -1; x < w; x += 1) {
    if (!(is(x, y) && is(x + 1, y) && is(x, y + 1) && is(x + 1, y + 1))) continue;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h) keep[(y + dy) * w + x + dx] = 1;
  }
  for (let at = 0; at < w * h; at += 1) if (grid[at] === kind && !keep[at]) grid[at] = instead;
}

function edgeCell(at: number, w: number, h: number) {
  const x = at % w, y = Math.floor(at / w);
  return x === 0 || y === 0 || x === w - 1 || y === h - 1;
}

/** Towns on grass, each as far as it can be from the others; then roads from each to the nearest town before it. */
function placeTowns(grid: Uint8Array, w: number, h: number, settings: WorldSettings, random: () => number) {
  const open = Array.from(grid.keys()).filter((at) => grid[at] === GRASS && !edgeCell(at, w, h));
  const towns: number[] = [];
  for (let count = 0; count < settings.towns && open.length; count += 1) {
    let best = open[Math.floor(random() * open.length)], bestSpace = -1;
    if (towns.length) for (const at of open) {
      const x = at % w, y = Math.floor(at / w);
      const space = Math.min(...towns.map((town) => Math.hypot(town % w - x, Math.floor(town / w) - y))) + random() * 0.5;
      if (space > bestSpace) { bestSpace = space; best = at; }
    }
    towns.push(best);
    grid[best] = TOWN;
    open.splice(open.indexOf(best), 1);
  }
  if (!settings.roads) return;
  // Roads keep off the sand where they can (inland first, the shore only when a town can't be reached otherwise).
  const inland = (cell: number) => cell === GRASS || cell === FOREST || cell === ROAD || cell === TOWN || cell === BRIDGE;
  const walkable = (cell: number) => inland(cell) || cell === SHORE;
  for (let at = 1; at < towns.length; at += 1) {
    const dry = distances(grid, w, h, towns[at], inland), reaches = (distance: Int32Array) => towns.slice(0, at).some((town) => distance[town] > 0);
    // Over the water last (the author, 2026-11-02: bridges where roads cross water): a town across it is reached by a bridge.
    let distance = reaches(dry) ? dry : distances(grid, w, h, towns[at], walkable);
    if (!reaches(distance)) distance = distances(grid, w, h, towns[at], (cell) => walkable(cell) || cell === WATER || cell === BRIDGE);
    const reachable = towns.slice(0, at).filter((town) => distance[town] > 0);
    if (!reachable.length) continue;
    // Walk back from the nearest town along falling distances, laying road.
    let step = reachable.reduce((best, town) => distance[town] < distance[best] ? town : best);
    while (distance[step] > 1) {
      const x = step % w, y = Math.floor(step / w);
      const next = SIDES.map(([dx, dy]) => (y + dy) * w + x + dx).find((n, side) => { const nx = x + SIDES[side][0], ny = y + SIDES[side][1]; return nx >= 0 && ny >= 0 && nx < w && ny < h && distance[n] === distance[step] - 1; });
      if (next === undefined) break;
      step = next;
      if (grid[step] !== TOWN) grid[step] = grid[step] === WATER || grid[step] === BRIDGE ? BRIDGE : ROAD;
    }
  }
}

/** The project's own stamps the overworld can draw with: a corner-Wang (C) sheet for shores, a path (P) sheet for roads. */
export interface WorldTiles { shore?: Sheet | null; road?: Sheet | null }
/** A stamp sheet's shades, `width` pixels wide. */
export interface Sheet { pixels: Uint8Array; width: number }

/** Copies the sheet's 8 × 8 tile at (column, row) onto tile (tx, ty) of `out`. */
function blitTile(out: Generated, sheet: Sheet, tx: number, ty: number, column: number, row: number) {
  for (let y = 0; y < 8; y += 1) out.pixels.set(sheet.pixels.subarray((row * 8 + y) * sheet.width + column * 8, (row * 8 + y) * sheet.width + column * 8 + 8), (ty * 8 + y) * out.width + tx * 8);
}

/**
 * Shores from a corner-Wang (C) sheet (its second terrain is the water): every water tile takes the tile whose
 * corners are water where all four tiles meeting there are water, so the shore curls inside the water's edge and
 * the land keeps its own tiles.
 */
function drawShores(out: Generated, grid: Uint8Array, w: number, h: number, sheet: Sheet) {
  const tw = w * 2, th = h * 2;
  const water = (tx: number, ty: number) => tx < 0 || ty < 0 || tx >= tw || ty >= th ? true : [WATER, BRIDGE].includes(grid[Math.floor(ty / 2) * w + Math.floor(tx / 2)]);
  const corner = (vx: number, vy: number) => water(vx - 1, vy - 1) && water(vx, vy - 1) && water(vx - 1, vy) && water(vx, vy);
  for (let ty = 0; ty < th; ty += 1) for (let tx = 0; tx < tw; tx += 1) {
    if (!water(tx, ty)) continue;
    const mask = (corner(tx, ty) ? CORNER_NW : 0) | (corner(tx + 1, ty) ? CORNER_NE : 0) | (corner(tx, ty + 1) ? CORNER_SW : 0) | (corner(tx + 1, ty + 1) ? CORNER_SE : 0);
    const { column, row } = slot16(mask);
    blitTile(out, sheet, tx, ty, column, row);
  }
}

/**
 * Roads from a path (P) sheet: one tile wide on the map's two-tile grid, from each road cell's top-left tile to its
 * road (or town) neighbours to the right and below; each road tile joins the road tiles beside it. The rest of a
 * road cell is plain ground.
 */
function drawRoads(out: Generated, grid: Uint8Array, w: number, h: number, sheet: Sheet) {
  const tw = w * 2, th = h * 2;
  const cell = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h ? -1 : grid[y * w + x];
  const linked = (x: number, y: number) => cell(x, y) === ROAD || cell(x, y) === TOWN || cell(x, y) === BRIDGE;
  const road = new Uint8Array(tw * th);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (cell(x, y) !== ROAD) continue;
    road[y * 2 * tw + x * 2] = 1;
    if (linked(x + 1, y)) road[y * 2 * tw + x * 2 + 1] = 1;
    if (linked(x, y + 1)) road[(y * 2 + 1) * tw + x * 2] = 1;
    if (cell(x - 1, y) === TOWN) road[y * 2 * tw + x * 2 - 1] = 1;
    if (cell(x, y - 1) === TOWN) road[(y * 2 - 1) * tw + x * 2] = 1;
    // A road cell's other tiles: plain ground under the road.
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) new Pen(out, (x * 2 + dx) * 8, (y * 2 + dy) * 8, 8).fill(0);
  }
  const filled = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < tw && ty < th && road[ty * tw + tx] === 1;
  for (let ty = 0; ty < th; ty += 1) for (let tx = 0; tx < tw; tx += 1) {
    if (!filled(tx, ty) || cell(Math.floor(tx / 2), Math.floor(ty / 2)) !== ROAD) continue;
    const { column, row } = slot16(edgeMask(filled, tx, ty));
    blitTile(out, sheet, tx, ty, column, row);
  }
}

/**
 * The overworld drawn with the library's pieces (the author, 2026-10-13), as if painted with the stamps: grass with
 * tufts, sand round the water (Sand), the water itself (Sea, frame 1), dirt roads (Dirt), mountains as
 * cliffs (Cliff: plateaus whose bottom row is the rock face) and forests from the pine or round forest brush on
 * 32 px units (a lone tree where a forest is too small for a unit), towns as two houses.
 */
function drawWorldPieces(out: Generated, grid: Uint8Array, w: number, h: number, settings: WorldSettings): Generated {
  const at = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h ? -1 : grid[y * w + x];
  const canvasOut = { width: out.width, height: out.height, pixels: out.pixels };
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const pen = new Pen(out, x * 16, y * 16, 16);
    pen.fill(0);
    if (hash(x, y, settings.seed) % 3 === 0) { pen.dot(4, 3, 1); pen.dot(3, 4, 1); pen.dot(5, 4, 1); pen.dot(11, 10, 1); pen.dot(10, 11, 1); pen.dot(12, 11, 1); }
  }
  // The map's own edge: water runs off it on an island, so no shore shows there.
  const wet = (x: number, y: number) => at(x, y) === WATER || at(x, y) === BRIDGE, sandy = (x: number, y: number) => wet(x, y) || at(x, y) === SHORE;
  paintXp(canvasOut, sheet("xp-sand"), sandy, w, h, settings.island);
  paintXp(canvasOut, sheet("water"), wet, w, h, settings.island);
  paintXp(canvasOut, sheet("xp-dirt"), (x, y) => at(x, y) === ROAD, w, h);
  // Map-scale pieces (the author, 2026-10-14: "an overworld, so don't use big trees or mounds"): the Outdoor sheet's
  // repeating Mountain tile on each mountain cell, a small tree on each forest cell (pines or round trees by seed).
  // Snow grows pines, swamp and desert round trees (the author, 2026-11-02: biomes); grassland either, by seed.
  const tree = settings.biome === "snow" ? "pine" : settings.biome === "swamp" || settings.biome === "desert" ? "tree" : settings.seed % 2 ? "pine" : "tree";
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const cell = at(x, y);
    if (cell !== MOUNTAIN && cell !== FOREST) continue;
    const id = cell === MOUNTAIN ? "mountain" : tree;
    if (!outdoorTile(out, id, x * 16, y * 16)) OUTDOOR[id].draw(new Pen(out, x * 16, y * 16, 16));
  }
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (grid[y * w + x] !== TOWN) continue;
    const pen = new Pen(out, x * 16, y * 16, 16);
    for (const [hx, hy] of [[1, 0], [8, 6]]) {
      for (let row = 0; row < 4; row += 1) { pen.rect(hx + 3 - row, hy + 1 + row, row * 2 + 1, 1, 2); pen.dot(hx + 3 - row, hy + 1 + row, 3); pen.dot(hx + 3 + row, hy + 1 + row, 3); }
      pen.rect(hx, hy + 5, 7, 5, 1); pen.box(hx, hy + 5, 7, 5, 3);
      pen.rect(hx + 3, hy + 7, 1, 3, 3);
    }
  }
  return out;
}

/** Bridges (the author, 2026-11-02): planks across each road cell over water, running the way the road goes, with rails along both sides. */
function drawBridges(out: Generated, grid: Uint8Array, w: number, h: number) {
  const at = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h ? -1 : grid[y * w + x];
  const road = (cell: number) => cell === ROAD || cell === TOWN || cell === BRIDGE;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (at(x, y) !== BRIDGE) continue;
    const pen = new Pen(out, x * 16, y * 16, 16);
    // Across (east-west) unless the road only runs north-south here.
    const across = road(at(x - 1, y)) || road(at(x + 1, y)) || !(road(at(x, y - 1)) || road(at(x, y + 1)));
    if (across) {
      pen.rect(0, 3, 16, 10, 0);
      for (let px = 1; px < 16; px += 3) pen.rect(px, 4, 1, 8, 2);
      pen.rect(0, 2, 16, 1, 3); pen.rect(0, 13, 16, 1, 3);
    } else {
      pen.rect(3, 0, 10, 16, 0);
      for (let py = 1; py < 16; py += 3) pen.rect(4, py, 8, 1, 2);
      pen.rect(2, 0, 1, 16, 3); pen.rect(13, 0, 1, 16, 3);
    }
  }
}

export function drawWorld(settings: WorldSettings, tiles?: WorldTiles | null): Generated {
  const { w, h, grid } = worldGrid(settings);
  const out = drawWorldTerrain(settings, tiles, w, h, grid);
  drawBridges(out, grid, w, h);
  // Collisions for GB Studio (the author, 2026-11-02): water and mountains solid; bridges, roads and the rest open.
  out.collisions = tileCollisions(out.width, out.height, (tx, ty) => { const cell = grid[Math.floor(ty / 2) * w + Math.floor(tx / 2)]; return cell === WATER || cell === MOUNTAIN; });
  return out;
}

function drawWorldTerrain(settings: WorldSettings, tiles: WorldTiles | null | undefined, w: number, h: number, grid: Uint8Array): Generated {
  const out: Generated = { width: w * 16, height: h * 16, pixels: new Uint8Array(w * 16 * h * 16) };
  const theme = themeOf(WORLD_THEMES, settings.theme);
  if (theme) {
    // Each 16-pixel cell is 2 × 2 tiles, all in its terrain's palette (or the theme's one palette).
    const tilesWide = w * 2;
    out.cells = new Uint16Array(tilesWide * h * 2);
    for (let at = 0; at < out.cells.length; at += 1) out.cells[at] = theme.palettes.length === 7 ? TERRAIN_PALETTE[grid[Math.floor(Math.floor(at / tilesWide) / 2) * w + Math.floor((at % tilesWide) / 2)]] : 1;
    out.palettes = theme.palettes.map(({ name, colors }) => ({ name, colors: [...colors] }));
  }
  const at = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h ? -1 : grid[y * w + x];
  if (!tiles?.shore && !tiles?.road) return drawWorldPieces(out, grid, w, h, settings);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const pen = new Pen(out, x * 16, y * 16, 16);
    const cell = grid[y * w + x];
    const variant = hash(x, y, settings.seed);
    if (cell === WATER || cell === BRIDGE) {
      pen.fill(1);
      // Waves: two short dashes, offset on alternate cells.
      const shift = (x + y) % 2 ? 6 : 0;
      pen.rect(2 + shift, 4, 4, 1, 2); pen.rect(8 - shift + 2, 11, 4, 1, 2);
      continue;
    }
    pen.fill(0);
    if (cell === SHORE) {
      pen.dot(3, 3, 1); pen.dot(11, 5, 1); pen.dot(6, 9, 1); pen.dot(13, 12, 1); pen.dot(2, 13, 1);
      SIDES.forEach(([dx, dy], side) => { if (at(x + dx, y + dy) === WATER) pen.side(side, 2); });
    } else if (cell === GRASS || cell === TOWN || cell === ROAD) {
      if (variant % 3 === 0) { pen.dot(4, 3, 1); pen.dot(3, 4, 1); pen.dot(5, 4, 1); pen.dot(11, 10, 1); pen.dot(10, 11, 1); pen.dot(12, 11, 1); }
    }
    if (cell === FOREST) {
      // A tree: a round crown outline on a trunk.
      pen.rect(5, 2, 6, 1, 3); pen.rect(5, 10, 6, 1, 3); pen.rect(3, 4, 1, 5, 3); pen.rect(12, 4, 1, 5, 3);
      pen.dot(4, 3, 3); pen.dot(11, 3, 3); pen.dot(4, 9, 3); pen.dot(11, 9, 3);
      pen.rect(5, 3, 6, 7, 1); pen.rect(4, 4, 8, 5, 1);
      pen.rect(7, 11, 2, 3, 3); pen.rect(5, 14, 6, 1, 2);
    } else if (cell === MOUNTAIN) {
      // A peak: a triangle outline, its lit side in rock (shade 1), its right side in shadow.
      for (let row = 0; row < 12; row += 1) {
        const half = Math.round(row * 7 / 11), y0 = 2 + row;
        pen.rect(8 - half, y0, half, 1, 1); pen.rect(8, y0, half, 1, 2);
        pen.dot(7 - half, y0, 3); pen.dot(8 + half, y0, 3);
      }
      pen.rect(1, 14, 15, 1, 3);
      pen.dot(7, 2, 3); pen.dot(8, 2, 3);
    } else if (cell === ROAD) {
      // A dirt band from the middle towards each neighbouring road or town.
      // With one palette for the whole map, shade 1 is the water's color too: roads take shade 2 there.
      const dirt = theme && theme.palettes.length === 1 ? 2 : 1;
      pen.rect(5, 5, 6, 6, dirt);
      const links = SIDES.map(([dx, dy]) => { const n = at(x + dx, y + dy); return n === ROAD || n === TOWN || n === BRIDGE; });
      if (links[0]) pen.rect(5, 0, 6, 5, dirt);
      if (links[1]) pen.rect(11, 5, 5, 6, dirt);
      if (links[2]) pen.rect(5, 11, 6, 5, dirt);
      if (links[3]) pen.rect(0, 5, 5, 6, dirt);
    } else if (cell === TOWN) {
      // Two houses: a pitched roof over walls with a door, one up on the left, one down on the right.
      for (const [hx, hy] of [[1, 0], [8, 6]]) {
        for (let row = 0; row < 4; row += 1) { pen.rect(hx + 3 - row, hy + 1 + row, row * 2 + 1, 1, 2); pen.dot(hx + 3 - row, hy + 1 + row, 3); pen.dot(hx + 3 + row, hy + 1 + row, 3); }
        pen.rect(hx, hy + 5, 7, 5, 1); pen.box(hx, hy + 5, 7, 5, 3);
        pen.rect(hx + 3, hy + 7, 1, 3, 3);
      }
    }
  }
  if (tiles?.shore) drawShores(out, grid, w, h, tiles.shore);
  if (tiles?.road) drawRoads(out, grid, w, h, tiles.road);
  return out;
}
