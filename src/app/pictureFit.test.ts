import { describe, expect, it } from "vitest";
import { clampCrop, fitPicture, fitPictures, fitWithLocks, lockCell, reduceColors, rotatedSize } from "./pictureFit";
import { posterize } from "../paint";

/** A width × height gradient picture with some colour in it. */
function gradient(width: number, height: number, tint = 0): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) rgba.set([(x * 255 / width + tint) & 255, y * 255 / height, (x + y + tint) & 255, 255], (y * width + x) * 4);
  return rgba;
}

describe("reduceColors", () => {
  it("keeps today's results for none and full-strength ordered", () => {
    const rgba = gradient(32, 16);
    expect(reduceColors(rgba, 32, 16, 8, "none")).toEqual(posterize(rgba, 32, 16, 8));
    expect(reduceColors(rgba, 32, 16, 8, "ordered", 100)).toEqual(posterize(rgba, 32, 16, 8, true));
    expect(reduceColors(rgba, 32, 16, 64, "none")).toBe(rgba);
  });
  it("Floyd-Steinberg only uses the kept colors, and strength 0 is no dither", () => {
    const rgba = gradient(32, 16);
    const flat = posterize(rgba, 32, 16, 6);
    const colors = new Set<number>();
    for (let p = 0; p < flat.length; p += 4) colors.add((flat[p] << 16) | (flat[p + 1] << 8) | flat[p + 2]);
    const fs = reduceColors(rgba, 32, 16, 6, "floyd", 100);
    for (let p = 0; p < fs.length; p += 4) expect(colors.has((fs[p] << 16) | (fs[p + 1] << 8) | fs[p + 2])).toBe(true);
    expect(fs).not.toEqual(flat);
    expect(reduceColors(rgba, 32, 16, 6, "floyd", 0)).toEqual(flat);
  });
});

describe("locks", () => {
  it("locked tiles wear their slot, its palette fitted to them alone", () => {
    const width = 32, height = 16, rgba = gradient(width, height);
    const locks = new Uint8Array(8);
    locks[0] = 3; locks[5] = 3;
    const fit = fitWithLocks(rgba, width, height, 8, locks);
    expect(fit.cells[0]).toBe(3);
    expect(fit.cells[5]).toBe(3);
    for (let cell = 0; cell < 8; cell += 1) if (cell !== 0 && cell !== 5) expect(fit.cells[cell]).not.toBe(3);
    expect(fit.palettes.length).toBeGreaterThanOrEqual(3);
    expect(fit.palettes.every((palette) => palette.length === 4)).toBe(true);
    expect(fitPicture(rgba, width, height, { keep: 16, dither: false, max: 8, budget: true, locks }).cells[5]).toBe(3);
  });
  it("finds a pixel's tile", () => {
    expect(lockCell(160, 0, 0)).toBe(0);
    expect(lockCell(160, 159, 8)).toBe(39);
  });
});

describe("fitPictures", () => {
  it("fits several pictures with one shared palette set", () => {
    const results = fitPictures([gradient(16, 16), gradient(16, 16, 90), gradient(16, 16, 180)], 16, 16, { keep: 32, dither: false, max: 8, budget: true }, "Town");
    expect(results).toHaveLength(3);
    expect(results[1].palettes).toBe(results[0].palettes);
    expect(results[0].names?.[0]).toBe("Town 1");
    expect(results.every((result) => result.pixels.length === 256 && result.cells.length === 4)).toBe(true);
    expect(results[0].palettes.length).toBeLessThanOrEqual(8);
  });
});

describe("crop and rotate", () => {
  it("turns sizes and orders crop corners", () => {
    expect(rotatedSize(100, 50, 90)).toEqual([50, 100]);
    expect(rotatedSize(100, 100, 45)[0]).toBe(141);
    const box = clampCrop(0.8, 0.9, -0.2, 0.1)!;
    expect(box.x).toBe(0); expect(box.y).toBeCloseTo(0.1); expect(box.w).toBeCloseTo(0.8); expect(box.h).toBeCloseTo(0.8);
    expect(clampCrop(0.5, 0.5, 0.505, 0.9)).toBeNull();
  });
});
