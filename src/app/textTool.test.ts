import { describe, expect, it } from "vitest";
import { CLEAR } from "../paint";
import { encodeText } from "../gb/font";
import { readFontSheet, renderText } from "./textTool";

/** A 128 × 16 sheet (two rows of 16 glyphs from character 32) in the Game Boy greens: "!" (index 1) is a 2-wide bar
 * on paper, "0" (index 16) a full 8 × 8 block. Variable width: magenta fills the bar's glyph past column 3. */
function sheet(variable: boolean, paper = [224, 248, 207]) {
  const width = 128, height = 16, rgba = new Uint8ClampedArray(width * height * 4);
  const set = (x: number, y: number, [r, g, b]: number[]) => rgba.set([r, g, b, 255], (y * width + x) * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) set(x, y, paper);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 8; x < 10; x += 1) set(x, y, [7, 24, 33]);
    if (variable) for (let x = 11; x < 16; x += 1) set(x, y, [255, 0, 255]);
  }
  for (let y = 8; y < 16; y += 1) for (let x = 0; x < 8; x += 1) set(x, y, [7, 24, 33]);
  return readFontSheet(rgba, width, height);
}

describe("text tool", () => {
  it("reads glyph widths as GB Studio does: magenta and white columns trim, the lightest green is paper", () => {
    expect(sheet(true).glyphs[1].width).toBe(3);
    expect(sheet(false).glyphs[1].width).toBe(8);
    expect(sheet(true).glyphs[16].width).toBe(8);
    expect(sheet(false, [255, 255, 255]).glyphs[1].width).toBe(2);
    expect(sheet(false).shades[2]).toBe(0);
  });

  it("maps characters through the font's .json (GB Studio 4.3) and starts a full 16-row sheet at code 0", () => {
    const width = 128, height = 16, rgba = new Uint8ClampedArray(width * height * 4);
    for (let at = 0; at < width * height; at += 1) rgba.set([224, 248, 207, 255], at * 4);
    for (let y = 0; y < 8; y += 1) for (let x = 8; x < 10; x += 1) rgba.set([7, 24, 33, 255], (y * width + x) * 4);
    const mapped = readFontSheet(rgba, width, height, { mapping: { "♥": 33 } });
    expect(renderText(mapped, "♥", { ink: 3, invert: false, box: false, leading: 0 }).pixels[1]).toBe(3);
    expect(encodeText(mapped, "\\041")).toEqual([33]);
  });

  it("draws letters in the ink shade on see-through, one line per newline", () => {
    const text = renderText(sheet(true), "!0\n!", { ink: 3, invert: false, box: false, leading: 0 }, 5, 6);
    expect([text.w, text.h, text.x, text.y]).toEqual([11, 16, 5, 6]);
    expect(text.pixels[0]).toBe(3);
    expect(text.pixels[2]).toBe(CLEAR);
    expect(text.pixels[3]).toBe(3);
    expect(text.pixels[8 * 11 + 1]).toBe(3);
    expect(text.pixels[8 * 11 + 5]).toBe(CLEAR);
  });

  it("inverts: a box of the ink shade with see-through letters, or paper letters in a box", () => {
    const font = sheet(true);
    const inverted = renderText(font, "!", { ink: 3, invert: true, box: false, leading: 0 });
    // No margin: the box is the glyph's own 3 × 8 (2026-10-13), on the 8 × 8 grid like GB Studio's text.
    expect([inverted.w, inverted.h]).toEqual([3, 8]);
    expect(inverted.pixels[2]).toBe(3);
    expect(inverted.pixels[0]).toBe(CLEAR);
    const boxed = renderText(font, "!", { ink: 3, invert: false, box: true, leading: 0 });
    expect(boxed.pixels[2]).toBe(0);
    expect(boxed.pixels[0]).toBe(3);
  });
});
