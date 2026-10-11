import { describe, expect, it } from "vitest";
import { CLEAR, countUniqueTiles } from "../paint";
import { GRAPHICS } from "./library";

describe("graphics library", () => {
  it("has unique ids and makes every asset", () => {
    expect(new Set(GRAPHICS.map((asset) => asset.id)).size).toBe(GRAPHICS.length);
    for (const asset of GRAPHICS) expect(asset.make().pixels.length, asset.id).toBeGreaterThan(0);
  });

  it("draws sprites and emotes 16 tall in 16-wide frames, without shade 0 (see-through on sprites)", () => {
    for (const asset of GRAPHICS.filter((item) => item.kind === "sprites" || item.kind === "emotes")) {
      const art = asset.make();
      expect(art.height, asset.id).toBe(16);
      expect(art.width % 16, asset.id).toBe(0);
      expect(art.pixels.includes(0), `${asset.id} uses shade 0`).toBe(false);
      expect(art.pixels.some((shade) => shade !== CLEAR), asset.id).toBe(true);
    }
  });

  it("makes backgrounds, tiles and UI in whole tiles, all shades, within a scene's tile budget", () => {
    for (const asset of GRAPHICS.filter((item) => item.kind !== "sprites" && item.kind !== "emotes")) {
      const art = asset.make();
      expect([art.width % 8, art.height % 8], asset.id).toEqual([0, 0]);
      expect(art.pixels.includes(CLEAR), asset.id).toBe(false);
      if (asset.kind === "backgrounds") expect(countUniqueTiles(art.pixels, art.width, art.height, false), asset.id).toBeLessThanOrEqual(192);
    }
  });

  it("names every piece so it can be a plain file name (letters, digits, spaces, - _ ( ) .)", () => {
    for (const asset of GRAPHICS) expect(asset.name, asset.id).toMatch(/^[\w ()\-.]+$/);
  });
});
