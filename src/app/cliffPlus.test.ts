import { describe, expect, it } from "vitest";
import { paintCliffs } from "../graphics/areas";
import { xpCliffTemplate } from "../graphics/autotiles";
import { CLEAR, type Canvas } from "../graphics/pen";
import { isPlusSheet, plusToRect, rectToPlus, stretchTall } from "./cliffPlus";

/** A hilly map: plateaus of every shape, strips one cell thin, a lone mound. */
const W = 14, H = 12;
const rows = ["..............", ".####.....###.", ".####..#..###.", ".#######..###.", "..######......", "..##..##..#...", "......##..#...", ".###..........", ".###...####...", ".#.#...####...", "...........#..", ".............."];
const hills = (x: number, y: number) => rows[y]?.[x] === "#";
const paint = (art: Canvas, tall: boolean) => { const out: Canvas = { width: W * 16, height: H * 16, pixels: new Uint8Array(W * H * 256).fill(CLEAR) }; paintCliffs(out, hills, W, H, 0, 0, tall, false, art); return out.pixels; };

describe("cliff +", () => {
  it("knows a + by its size", () => { expect(isPlusSheet(112, 112)).toBe(true); expect(isPlusSheet(48, 80)).toBe(false); });

  it("paints the same map from the + as from the packed sheet", () => {
    const rect = xpCliffTemplate();
    expect(paint(plusToRect(rectToPlus(rect, false), false), false)).toEqual(paint(rect, false));
  });

  it("paints the same 32 px walls from the tall + as from the stretched sheet", () => {
    const tall = stretchTall(xpCliffTemplate());
    expect(paint(plusToRect(rectToPlus(xpCliffTemplate(), true), true), true)).toEqual(paint(tall, true));
  });
});
