import { describe, expect, it } from "vitest";
import { ROOM_DEFAULTS, drawRoom, roomLayout, type DoorSide } from "./room";

describe("interior rooms", () => {
  it("is at least a screen, the room in its middle, the same from the same seed", () => {
    const small = drawRoom({ ...ROOM_DEFAULTS, width: 4, height: 3 });
    expect([small.width, small.height]).toEqual([160, 144]);
    const big = roomLayout({ ...ROOM_DEFAULTS, width: 20, height: 12 });
    expect([big.columns, big.rows]).toEqual([22, 16]);
    expect(drawRoom(ROOM_DEFAULTS).pixels).toEqual(drawRoom(ROOM_DEFAULTS).pixels);
  });
  it("puts the door in the wall picked, with its way in clear", () => {
    for (const door of ["top", "bottom", "left", "right"] as DoorSide[]) for (const doorAt of [0, 50, 100]) for (let seed = 1; seed < 6; seed += 1) {
      const room = roomLayout({ ...ROOM_DEFAULTS, width: 6, height: 3, door, doorAt, furniture: 12, seed });
      const at = (x: number, y: number) => room.cells[y * room.columns + x];
      const { x, y } = room.door;
      expect(at(x, y)).toBe(door === "top" ? "doorway" : ROOM_DEFAULTS.floor);
      const [dx, dy] = door === "top" ? [0, 1] : door === "bottom" ? [0, -1] : door === "left" ? [1, 0] : [-1, 0];
      expect(at(x + dx, y + dy)).toBe(ROOM_DEFAULTS.floor);
      // Outside the door, beyond the wall: nothing (bottom, left, right).
      if (door !== "top") expect(at(x - dx, y - dy)).toBeNull();
    }
  });
  it("places as many pieces as asked when there's room, none side by side", () => {
    const furniture = new Set(["bookshelf", "counter", "fireplace", "pottedPlant", "barrel", "table", "chair", "bed", "crate", "jar"]);
    const room = roomLayout({ ...ROOM_DEFAULTS, width: 12, height: 8, furniture: 6, rug: false });
    const at = (x: number, y: number) => room.cells[y * room.columns + x];
    let count = 0;
    for (let y = 0; y < room.rows; y += 1) for (let x = 0; x < room.columns; x += 1) if (furniture.has(at(x, y) ?? "")) {
      count += 1;
      expect(furniture.has(at(x + 1, y) ?? "")).toBe(false);
      expect(furniture.has(at(x, y + 1) ?? "")).toBe(false);
    }
    expect(count).toBe(6);
    expect(roomLayout({ ...ROOM_DEFAULTS, furniture: 0, windows: false, rug: false }).cells.some((id) => furniture.has(id ?? "") || id === "windowIn" || id === "rug")).toBe(false);
  });
});
