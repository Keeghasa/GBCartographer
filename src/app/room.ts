/**
 * The Interior wizard's rooms (the author, 2026-11-02): a room seen from above in the catalog's indoor tiles
 * (src/graphics/tiles.ts INDOOR, 16 × 16): a dark wall top all round, the back wall's face two cells tall along the
 * top, a floor, a door in the wall you pick, and, if you like, windows in the back wall, a rug in the middle and
 * furniture, placed by the seed so the door's way in stays clear. A room smaller than a screen sits in the middle of
 * one, dark around it. `roomLayout` (pure, tested) decides which tile goes where; `drawRoom` paints it.
 */
import { canvas, Pen } from "../graphics/pen";
import { TILES } from "../graphics/tiles";
import { seeded, type Generated } from "./generators";

export type DoorSide = "top" | "bottom" | "left" | "right";
export type RoomFloor = "woodFloor" | "tileFloor" | "carpet";

export interface RoomSettings {
  /** Inside the walls, in 16-px cells. */
  width: number; height: number;
  door: DoorSide;
  /** Along its wall, 0 (left / top) to 100 (right / bottom). */
  doorAt: number;
  floor: RoomFloor;
  windows: boolean; rug: boolean;
  /** How many pieces of furniture, 0–12. */
  furniture: number;
  seed: number;
}

export const ROOM_DEFAULTS: RoomSettings = { width: 8, height: 5, door: "bottom", doorAt: 50, floor: "woodFloor", windows: true, rug: true, furniture: 5, seed: 1 };
export const ROOM_FLOORS: { value: RoomFloor; label: string }[] = [{ value: "woodFloor", label: "Wood" }, { value: "tileFloor", label: "Tiles" }, { value: "carpet", label: "Carpet" }];

/** Against the back wall (they stand in its face's lower row's shadow), and anywhere on the floor. */
const BACK = ["bookshelf", "counter", "fireplace", "pottedPlant", "bookshelf", "barrel"];
const LOOSE = ["table", "chair", "bed", "pottedPlant", "barrel", "crate", "jar", "chair", "crate"];

/** The room as a grid of INDOOR tile ids (null: outside, dark), 16-px cells, with where its door is. */
export interface RoomLayout { columns: number; rows: number; cells: (string | null)[]; door: { x: number; y: number } }

const SCREEN_COLUMNS = 10, SCREEN_ROWS = 9;

export function roomLayout(settings: RoomSettings): RoomLayout {
  const width = Math.max(2, Math.round(settings.width)), height = Math.max(2, Math.round(settings.height));
  // The room: a wall top ring of one cell, two rows of wall face under the top one, then the floor.
  const roomW = width + 2, roomH = height + 4;
  const columns = Math.max(SCREEN_COLUMNS, roomW), rows = Math.max(SCREEN_ROWS, roomH);
  const left = Math.floor((columns - roomW) / 2), top = Math.floor((rows - roomH) / 2);
  const cells: (string | null)[] = new Array(columns * rows).fill(null);
  const set = (x: number, y: number, id: string | null) => { cells[(top + y) * columns + left + x] = id; };
  const get = (x: number, y: number) => cells[(top + y) * columns + left + x];
  for (let y = 0; y < roomH; y += 1) for (let x = 0; x < roomW; x += 1) {
    const edge = x === 0 || x === roomW - 1 || y === 0 || y === roomH - 1;
    set(x, y, edge ? "wallTopIn" : y === 1 ? "wall" : y === 2 ? "wallBase" : settings.floor);
  }
  // The door: in the back wall a doorway in the face; elsewhere a gap in the wall top with floor through it.
  const along = (count: number) => Math.min(count - 1, Math.max(0, Math.round((settings.doorAt / 100) * (count - 1))));
  let door: { x: number; y: number };
  if (settings.door === "top") { const x = 1 + along(width); set(x, 2, "doorway"); set(x, 1, "wall"); door = { x, y: 2 }; }
  else if (settings.door === "bottom") { const x = 1 + along(width); set(x, roomH - 1, settings.floor); door = { x, y: roomH - 1 }; }
  else { const y = 3 + along(height), x = settings.door === "left" ? 0 : roomW - 1; set(x, y, settings.floor); door = { x, y }; }
  // The way in: the door's cell and the floor in front of it stay clear.
  const step = settings.door === "top" ? [0, 1] : settings.door === "bottom" ? [0, -1] : settings.door === "left" ? [1, 0] : [-1, 0];
  const clear = new Set<string>();
  for (let n = 0; n <= 2; n += 1) clear.add(`${door.x + step[0] * n},${door.y + step[1] * n}`);
  const random = seeded(settings.seed);
  // Windows in the back wall's face, every third cell or so, never on the door.
  if (settings.windows) for (let x = 2; x < roomW - 2; x += 3) if (get(x, 2) === "wallBase" && x !== door.x) set(x, 1, "windowIn");
  // A rug in the middle of the floor (one cell per 4 × 3 of floor, at least one).
  const floorTop = 3, floorRows = height;
  if (settings.rug && floorRows >= 1) {
    const rugW = Math.max(1, Math.floor(width / 4)), rugH = Math.max(1, Math.floor(floorRows / 3));
    const rx = 1 + Math.floor((width - rugW) / 2), ry = floorTop + Math.floor((floorRows - rugH) / 2);
    for (let y = ry; y < ry + rugH; y += 1) for (let x = rx; x < rx + rugW; x += 1) if (!clear.has(`${x},${y}`)) set(x, y, "rug");
  }
  // Furniture: back pieces along the first floor row, loose ones anywhere else; never on the way in, never touching
  // another piece side by side so the room can be walked through.
  const free = (x: number, y: number) => get(x, y) === settings.floor && !clear.has(`${x},${y}`);
  const spots: [number, number][] = [];
  for (let y = floorTop; y < roomH - 1; y += 1) for (let x = 1; x < roomW - 1; x += 1) spots.push([x, y]);
  for (let i = spots.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  const isFurniture = (x: number, y: number) => { const id = get(x, y); return id !== null && (BACK.includes(id) || LOOSE.includes(id)); };
  let placed = 0;
  for (const [x, y] of spots) {
    if (placed >= Math.max(0, Math.round(settings.furniture))) break;
    if (!free(x, y) || isFurniture(x - 1, y) || isFurniture(x + 1, y) || isFurniture(x, y - 1) || isFurniture(x, y + 1)) continue;
    const list = y === floorTop ? BACK : LOOSE;
    set(x, y, list[Math.floor(random() * list.length)]);
    placed += 1;
  }
  return { columns, rows, cells, door: { x: left + door.x, y: top + door.y } };
}

/** The room painted with the catalog's indoor tiles, in the greens (Make background takes it as it is). */
export function drawRoom(settings: RoomSettings): Generated {
  const layout = roomLayout(settings);
  const out = canvas(layout.columns * 16, layout.rows * 16, 3);
  layout.cells.forEach((id, at) => {
    if (!id) return;
    TILES[id].draw(new Pen(out, (at % layout.columns) * 16, Math.floor(at / layout.columns) * 16, 16));
  });
  return out;
}
