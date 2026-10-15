import { describe, expect, it } from "vitest";
import { bounds, footprint, occupant, place, snap, type MapCell, type Size } from "./mapLayout";

const sizes: Record<string, Size> = { "one.png": { width: 160, height: 144 }, "big.png": { width: 320, height: 288 }, "house.png": { width: 214, height: 182 } };
const sizeOf = (file: string) => sizes[file];

describe("map layout", () => {
  it("takes as many squares as the picture reaches", () => {
    expect(footprint({ x: 0, y: 0, file: "big.png" }, sizes["big.png"])).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(footprint({ x: 3, y: 1, file: "house.png" }, sizes["house.png"])).toEqual({ x: 3, y: 1, w: 2, h: 2 });
    // A tile offset can push a screen into the next square.
    expect(footprint({ x: 0, y: 0, dx: 1, file: "one.png" }, sizes["one.png"])).toEqual({ x: 0, y: 0, w: 2, h: 1 });
  });

  it("finds the piece on a square", () => {
    const cells: MapCell[] = [{ x: 0, y: 0, file: "big.png" }];
    expect(occupant(cells, sizeOf, 1, 1)?.file).toBe("big.png");
    expect(occupant(cells, sizeOf, 2, 0)).toBeUndefined();
  });

  it("bumps pieces it lands on to the right, in a chain", () => {
    const a: MapCell = { x: 0, y: 0, file: "one.png" }, b: MapCell = { x: 1, y: 0, file: "one.png" }, c: MapCell = { x: 3, y: 0, file: "one.png" };
    const moving: MapCell = { x: 5, y: 5, file: "big.png" };
    const next = place([a, b, c, moving], moving, { x: 0, y: 0, file: "big.png" }, sizeOf);
    const at = (file: string, y = 0) => next.filter((cell) => cell.file === file && cell.y === y).map((cell) => cell.x).sort((p, q) => p - q);
    expect(next.find((cell) => cell.file === "big.png")).toMatchObject({ x: 0, y: 0 });
    // a (at 0) goes past the big piece to 2; b (at 1) then lands on a and goes to 3; c (at 3) goes to 4.
    expect(at("one.png")).toEqual([2, 3, 4]);
  });

  it("leaves pieces it doesn't touch alone", () => {
    const a: MapCell = { x: 0, y: 2, file: "one.png" };
    const moving: MapCell = { x: 9, y: 9, file: "one.png" };
    const next = place([a, moving], moving, { x: 0, y: 0, file: "one.png" }, sizeOf);
    expect(next.find((cell) => cell.y === 2)).toMatchObject({ x: 0, y: 2 });
  });

  it("snaps to squares or to tiles", () => {
    expect(snap(170, 150, false)).toEqual({ x: 1, y: 1 });
    expect(snap(170, 150, true)).toEqual({ x: 1, y: 1, dx: 1, dy: 1 });
    expect(snap(40, 0, true)).toEqual({ x: 0, y: 0, dx: 5, dy: 0 });
  });

  it("measures the whole map", () => {
    expect(bounds([{ x: 0, y: 0, file: "one.png" }, { x: 1, y: 0, file: "big.png" }], sizeOf)).toEqual({ x: 0, y: 0, w: 3, h: 2 });
  });
});
