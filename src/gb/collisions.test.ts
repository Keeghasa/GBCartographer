import { describe, expect, it } from "vitest";
import { collisionBrush, collisionLook, collisionMatches, iconPixels, paintCollision, SCENE_TYPE_COLLISIONS } from "./collisions";

const PLATFORM = SCENE_TYPE_COLLISIONS.PLATFORM, ADVENTURE = SCENE_TYPE_COLLISIONS.ADVENTURE;
const def = (defs: typeof PLATFORM, key: string) => defs.find((item) => item.key === key)!;

describe("collisions", () => {
  it("matches values as GB Studio does: solid alone, one-way sides together, props apart", () => {
    expect(collisionLook(15, PLATFORM).shown.map((item) => item.key)).toEqual(["solid"]);
    expect(collisionLook(5, PLATFORM).shown.map((item) => item.key)).toEqual(["top", "left"]);
    expect(collisionLook(16, PLATFORM).shown.map((item) => item.key)).toEqual(["ladder"]);
    expect(collisionLook(16 | 1, PLATFORM).shown.map((item) => item.key)).toEqual(["top", "ladder"]);
    expect(collisionMatches(21, def(ADVENTURE, "slope_tl"), ADVENTURE)).toBe(true);
    expect(collisionMatches(21, def(ADVENTURE, "top"), ADVENTURE)).toBe(false);
    expect(collisionLook(0x0a, SCENE_TYPE_COLLISIONS.TOPDOWN).unknown).toBe(false);
    expect(collisionLook(0x80, SCENE_TYPE_COLLISIONS.TOPDOWN)).toEqual({ shown: [], unknown: true });
  });

  it("paints like GB Studio's brush: inside the mask only, and erasing clears everything", () => {
    const ladder = collisionBrush([def(PLATFORM, "ladder")]);
    expect(paintCollision(15, ladder.value, ladder.mask)).toBe(31);
    const topLeft = collisionBrush([def(PLATFORM, "top"), def(PLATFORM, "left")]);
    expect(topLeft).toEqual({ value: 5, mask: 15 });
    expect(paintCollision(16 | 15, topLeft.value, topLeft.mask)).toBe(21);
    const eraser = collisionBrush([]);
    expect(paintCollision(31, eraser.value, eraser.mask)).toBe(0);
    expect(iconPixels("FF00000000000000").filter(Boolean).length).toBe(8);
  });
});
