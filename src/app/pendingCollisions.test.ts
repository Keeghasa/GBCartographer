import { describe, expect, it } from "vitest";
import { SOLID, sliceTiles, withPending } from "./pendingCollisions";

describe("a generator's pending collisions", () => {
  it("cuts one screen's tiles out of the whole map's", () => {
    const whole = Uint8Array.from({ length: 4 * 3 }, (_, at) => at);
    expect(Array.from(sliceTiles(whole, 4, 1, 1, 2, 2))).toEqual([5, 6, 9, 10]);
    // Past the map's edge counts as open.
    expect(Array.from(sliceTiles(whole, 4, 3, 2, 2, 2))).toEqual([11, 0, 0, 0]);
  });

  it("goes only into a scene with no collisions of its own, of the same size", () => {
    const pending = [SOLID, 0, 0, SOLID];
    expect(Array.from(withPending(new Uint8Array(4), pending)!)).toEqual(pending);
    expect(withPending(Uint8Array.from([0, 0, 1, 0]), pending)).toBeNull();
    expect(withPending(new Uint8Array(6), pending)).toBeNull();
    expect(withPending(new Uint8Array(4), [0, 0, 0, 0])).toBeNull();
    expect(withPending(new Uint8Array(4), undefined)).toBeNull();
  });
});
