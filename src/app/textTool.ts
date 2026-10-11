/**
 * The text tool (W5, the author's pick 2026-10-10): types with one of the project's GB Studio font sheets straight
 * onto a picture, reading the sheet, its .json map and the text exactly as GB Studio 4.3 does (src/gb/font.ts), so
 * a sheet drawn in the Game Boy greens keeps its lightest green as paper and mapped characters pick their glyphs.
 * The text becomes a floating piece of the picture: see-through around the letters, so it can be moved before it is
 * stamped down.
 */
import { CLEAR, type Floating } from "../paint";
import { CLEAR_PIXEL, encodeText, glyphOf, paperShade, readFont, type FontMap, type GbFont } from "../gb/font";

/** A font sheet read for typing (GB Studio's reading of it). */
export type FontSheet = GbFont;

/** Reads a font sheet's RGBA (and its .json map) for typing. */
export const readFontSheet = (rgba: ArrayLike<number>, width: number, height: number, map: FontMap | null = null): FontSheet => readFont(rgba, width, height, map);

export interface TextOptions {
  /** The shade the letters are drawn in (0 lightest … 3 darkest). */
  ink: number;
  /** Swap: the letters see-through in a box of the ink shade (light text on dark, or the other way round). */
  invert: boolean;
  /** A box of the opposite shade behind the letters, one pixel bigger all round. */
  box: boolean;
  /** Pixels between lines (GB Studio's dialogue uses 0). */
  leading: number;
}

/** Lays the text out (one line per newline) and draws it as a floating piece at (x, y): CLEAR where nothing is drawn. */
export function renderText(font: FontSheet, text: string, options: TextOptions, x = 0, y = 0): Floating {
  const lines = text.split("\n").map((line) => encodeText(font, line).map((code) => glyphOf(font, code)).filter((glyph) => glyph !== null));
  const widthOf = (line: typeof lines[number]) => line.reduce((sum, glyph) => sum + glyph.width, 0);
  const pad = options.box || options.invert ? 1 : 0;
  const w = Math.max(1, ...lines.map(widthOf)) + pad * 2;
  const h = lines.length * 8 + (lines.length - 1) * options.leading + pad * 2;
  const paper = 3 - options.ink;
  const pixels = new Uint8Array(w * h).fill(options.invert ? options.ink : options.box ? paper : CLEAR);
  const letter = options.invert ? (options.box ? paper : CLEAR) : options.ink;
  const fontPaper = paperShade(font);
  lines.forEach((line, row) => {
    let pen = pad;
    const top = pad + row * (8 + options.leading);
    for (const glyph of line) {
      // The letters: every pixel that isn't see-through or the font's paper (light letters on dark paper type too).
      for (let gy = 0; gy < 8; gy += 1) for (let gx = 0; gx < glyph.width; gx += 1) {
        const shade = font.shades[(glyph.sy + gy) * font.width + glyph.sx + gx];
        if (shade !== CLEAR_PIXEL && shade !== fontPaper) pixels[(top + gy) * w + pen + gx] = letter;
      }
      pen += glyph.width;
    }
  });
  return { pixels, w, h, x, y };
}
