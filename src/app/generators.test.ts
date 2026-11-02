import { describe, expect, it } from "vitest";
import { countUniqueTiles } from "../paint";
import { OVERWORLD_PALETTES, TOWN, CAVE_DEFAULTS, MOUNTAIN, ROAD, WATER, WORLD_DEFAULTS, caveGrid, drawCave, drawWorld, worldGrid, STAIRS, DOOR_ACROSS, DOOR_DOWN, TREASURE, ENEMY } from "./generators";
import { SOLID } from "./pendingCollisions";

/** Floor cells reachable from the first one, by sides. */
function reachable(grid: Uint8Array, w: number, open: (cell: number) => boolean) {
  const start = grid.findIndex(open), seen = new Set([start]), stack = [start];
  while (stack.length) {
    const at = stack.pop()!;
    for (const next of [at - w, at + w, at % w ? at - 1 : -1, (at + 1) % w ? at + 1 : -1]) if (next >= 0 && next < grid.length && open(grid[next]) && !seen.has(next)) { seen.add(next); stack.push(next); }
  }
  return seen.size;
}

describe("map generators", () => {
  it("makes the same cave from the same settings, sized in screens", () => {
    const a = drawCave(CAVE_DEFAULTS), b = drawCave(CAVE_DEFAULTS);
    expect([a.width, a.height]).toEqual([320, 288]);
    expect(a.pixels).toEqual(b.pixels);
    expect(drawCave({ ...CAVE_DEFAULTS, seed: 2 }).pixels).not.toEqual(a.pixels);
  });

  it("keeps a connected cave's floor in one piece, rock all round, with two stairs", () => {
    const { w, h, grid } = caveGrid({ ...CAVE_DEFAULTS, cell: 16, seed: 5 });
    const floor = grid.filter((cell) => cell !== 1).length;
    expect(floor).toBeGreaterThan(0);
    expect(reachable(grid, w, (cell) => cell !== 1)).toBe(floor);
    for (let x = 0; x < w; x += 1) expect([grid[x], grid[(h - 1) * w + x]]).toEqual([1, 1]);
    expect(grid.filter((cell) => cell === 2).length).toBe(2);
  });

  it("draws 32-pixel cells cut to whole screens (144 isn't a multiple of 32)", () => {
    for (const [columns, rows] of [[1, 1], [2, 3], [3, 2]]) {
      const cave = drawCave({ ...CAVE_DEFAULTS, cell: 32, columns, rows, seed: 4 });
      expect([cave.width, cave.height]).toEqual([columns * 160, rows * 144]);
      expect(cave.pixels.length).toBe(cave.width * cave.height);
      expect(countUniqueTiles(cave.pixels, cave.width, cave.height, false)).toBeLessThan(192);
    }
    const themed = drawCave({ ...CAVE_DEFAULTS, cell: 32, rows: 1, theme: "V20-5-Stone" });
    expect(themed.cells?.length).toBe(Math.ceil(themed.width / 8) * Math.ceil(themed.height / 8));
  });

  it("leaves no cave rock one cell thin (a spur or a ledge would be a sliver of wall)", () => {
    for (let seed = 1; seed <= 20; seed += 1) for (const [columns, rows] of [[1, 1], [2, 2], [3, 2]]) {
      const { w, h, grid } = caveGrid({ ...CAVE_DEFAULTS, seed, columns, rows });
      for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
        const at = y * w + x;
        const open = (i: number) => grid[i] !== 1;
        expect(grid[at] === 1 && ((open(at - 1) && open(at + 1)) || (open(at - w) && open(at + w))), `seed ${seed} at ${x}, ${y}`).toBe(false);
      }
    }
  });

  it("builds dungeon walls at least two cells tall, so each shows its top and its face", () => {
    for (let seed = 1; seed <= 20; seed += 1) for (const [columns, rows] of [[1, 1], [2, 2], [3, 2]]) {
      const { w, h, grid } = caveGrid({ ...CAVE_DEFAULTS, style: "dungeon", seed, columns, rows });
      for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) expect(grid[y * w + x] === 1 && grid[(y + 1) * w + x] !== 1 && grid[(y - 1) * w + x] !== 1, `seed ${seed} at ${x}, ${y}`).toBe(false);
    }
  });

  it("joins every dungeon room", () => {
    const { w, grid } = caveGrid({ ...CAVE_DEFAULTS, style: "dungeon", columns: 3, seed: 9 });
    const floor = grid.filter((cell) => cell !== 1).length;
    expect(reachable(grid, w, (cell) => cell !== 1)).toBe(floor);
  });

  it("stays well under a background's tile budget", () => {
    const cave = drawCave(CAVE_DEFAULTS), world = drawWorld(WORLD_DEFAULTS);
    expect(countUniqueTiles(cave.pixels, cave.width, cave.height, false)).toBeLessThan(192);
    expect(countUniqueTiles(world.pixels, world.width, world.height, false)).toBeLessThan(192);
  });

  it("gives an overworld about as much water as asked, its towns, and roads between them", () => {
    const { w, h, grid } = worldGrid(WORLD_DEFAULTS);
    expect([w, h]).toEqual([30, 27]);
    const water = grid.filter((cell) => cell === WATER).length / grid.length;
    expect(water).toBeGreaterThan(0.25);
    expect(water).toBeLessThan(0.5);
    expect(grid.filter((cell) => cell === TOWN).length).toBe(3);
    expect(grid.some((cell) => cell === ROAD)).toBe(true);
    expect(grid.some((cell) => cell === MOUNTAIN)).toBe(true);
    const none = worldGrid({ ...WORLD_DEFAULTS, water: 0, mountains: 0, island: false, towns: 0 }).grid;
    expect(none.some((cell) => cell === WATER || cell === MOUNTAIN || cell === TOWN)).toBe(false);
  });

  it("colors each overworld cell's four tiles in its terrain's Overworld palette", () => {
    expect(OVERWORLD_PALETTES.map((palette) => palette.name)).toEqual(["OW-1-Grass", "OW-2-Forest", "OW-3-Mountain", "OW-4-Water", "OW-5-Shore", "OW-6-Road", "OW-7-Town"]);
    const { w, grid } = worldGrid(WORLD_DEFAULTS);
    const world = drawWorld(WORLD_DEFAULTS);
    expect(world.palettes?.length).toBe(7);
    const water = grid.indexOf(WATER), town = grid.indexOf(TOWN), tilesWide = w * 2;
    const tileOf = (cell: number) => Math.floor(cell / w) * 2 * tilesWide + (cell % w) * 2;
    for (const offset of [0, 1, tilesWide, tilesWide + 1]) {
      expect(world.cells?.[tileOf(water) + offset]).toBe(4);
      expect(world.cells?.[tileOf(town) + offset]).toBe(7);
    }
    expect(drawWorld({ ...WORLD_DEFAULTS, theme: "" }).cells).toBeUndefined();
  });
});

describe("cave doorways, marks and collisions (2026-11-02)", () => {
  const SIDE = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  it("puts a doorway on every edge where two screens meet, and start and end stairs", () => {
    for (const style of ["cave", "dungeon"] as const) for (let seed = 1; seed <= 12; seed += 1) for (const cell of [16, 32] as const) {
      const { grid, start, end } = caveGrid({ ...CAVE_DEFAULTS, style, cell, seed, columns: 3, rows: 2 });
      expect(grid.filter((value) => value === DOOR_ACROSS).length, `${style} ${seed} ${cell}`).toBe(2 * 2);
      expect(grid.filter((value) => value === DOOR_DOWN).length, `${style} ${seed} ${cell}`).toBe(3);
      expect([grid[start], grid[end]]).toEqual([STAIRS, STAIRS]);
    }
    expect(caveGrid({ ...CAVE_DEFAULTS, doors: false }).grid.some((value) => value === DOOR_ACROSS || value === DOOR_DOWN)).toBe(false);
  });

  it("marks treasure and enemy spots only when asked, without moving the cave", () => {
    const plain = caveGrid({ ...CAVE_DEFAULTS, seed: 3 }), marked = caveGrid({ ...CAVE_DEFAULTS, seed: 3, marks: true });
    expect(plain.grid.some((value) => value === TREASURE || value === ENEMY)).toBe(false);
    expect(marked.grid.some((value) => value === ENEMY)).toBe(true);
    expect(Array.from(marked.grid, (value) => value === 1)).toEqual(Array.from(plain.grid, (value) => value === 1));
    // Treasure sits in dead ends.
    const { w, grid } = marked;
    grid.forEach((value, at) => { if (value === TREASURE) expect(SIDE.filter(([dx, dy]) => grid[at + dy * w + dx] !== 1).length).toBe(1); });
    expect(drawCave({ ...CAVE_DEFAULTS, seed: 3, marks: true }).pixels).not.toEqual(drawCave({ ...CAVE_DEFAULTS, seed: 3 }).pixels);
  });

  it("makes the rock solid and the floor open, one value per tile", () => {
    for (const cell of [16, 32] as const) {
      const settings = { ...CAVE_DEFAULTS, cell, seed: 6 }, cave = drawCave(settings), { w, grid } = caveGrid(settings);
      expect(cave.collisions?.length).toBe((cave.width / 8) * (cave.height / 8));
      const per = cell / 8, tw = cave.width / 8;
      cave.collisions!.forEach((value, at) => expect(value).toBe(grid[Math.floor(Math.floor(at / tw) / per) * w + Math.floor((at % tw) / per)] === 1 ? SOLID : 0));
    }
  });
});
