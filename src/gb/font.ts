/**
 * GB Studio font sheets, read the way GB Studio 4.3 reads them (readFileToFontData, encodeString):
 * - The sheet is 8 × 8 glyphs, as many to a row as fit. White (green above 249) and magenta are see-through; every
 *   other color is a shade by its green (below 65 dark, 130 mid, 205 light, else the paper).
 * - Each glyph is trimmed to its columns that aren't see-through: that's where it starts and how wide it is.
 * - Character codes: a sheet of fewer than 16 rows starts at code 32 (codes below draw the first glyph); one of 16 rows
 *   or more starts at 0. GB Studio keeps each distinct glyph once; a code points at one of those.
 * - The font's .json beside the PNG may hold a `table` (a character → which distinct glyph) and a `mapping` (text →
 *   one or more codes, the longest match first), and text may carry \NNN (octal) or \xHH codes.
 */

/** The optional .json beside a font PNG. */
export interface FontMap { mapping?: Record<string, number | number[]>; table?: Record<string, number> }

export const CLEAR_PIXEL = 255;

export interface GbFont {
  width: number;
  height: number;
  /** Per pixel: CLEAR_PIXEL (see-through), or the shade 0 (paper) … 3 (dark). */
  shades: Uint8Array;
  /** Per glyph on the sheet: its first used column (x, y on the sheet) and width (0: nothing in it). */
  glyphs: { sx: number; sy: number; width: number }[];
  /** Per character code: the sheet glyph it draws (-1: none). */
  table: number[];
  mapping: Record<string, number | number[]>;
}

const shadeOf = (r: number, g: number, b: number, a: number) =>
  a < 128 || g > 249 || (r > 249 && b > 249) ? CLEAR_PIXEL : g < 65 ? 3 : g < 130 ? 2 : g < 205 ? 1 : 0;

export function readFont(rgba: ArrayLike<number>, width: number, height: number, map: FontMap | null = null): GbFont {
  const shades = new Uint8Array(width * height);
  for (let at = 0; at < width * height; at += 1) shades[at] = shadeOf(rgba[at * 4], rgba[at * 4 + 1], rgba[at * 4 + 2], rgba[at * 4 + 3]);
  const columns = Math.floor(width / 8), rows = Math.floor(height / 8);
  const glyphs: GbFont["glyphs"] = [];
  // GB Studio keeps each distinct glyph once (same width, same pixels): `unique` lists the first sheet glyph of each.
  const unique: number[] = [], seen = new Map<string, number>(), uniqueOf: number[] = [];
  for (let glyph = 0; glyph < columns * rows; glyph += 1) {
    const x0 = (glyph % columns) * 8, y0 = Math.floor(glyph / columns) * 8;
    let first = -1, last = -1;
    for (let x = 0; x < 8; x += 1) for (let y = 0; y < 8; y += 1) if (shades[(y0 + y) * width + x0 + x] !== CLEAR_PIXEL) { if (first < 0 || x < first) first = x; if (x > last) last = x; }
    const glyphWidth = first < 0 ? 0 : last - first + 1;
    glyphs.push({ sx: x0 + Math.max(0, first), sy: y0, width: glyphWidth });
    const key = `${glyphWidth}:${Array.from({ length: 8 * glyphWidth }, (_, at) => shades[(y0 + Math.floor(at / glyphWidth)) * width + x0 + first + (at % glyphWidth)]).join(",")}`;
    if (!seen.has(key)) { seen.set(key, unique.length); unique.push(glyph); }
    uniqueOf.push(seen.get(key)!);
  }
  const codes: number[] = [...(rows < 16 ? new Array<number>(32).fill(0) : []), ...uniqueOf];
  for (const [char, value] of Object.entries(map?.table ?? {})) {
    const code = char.charCodeAt(0);
    if (code >= 256 || typeof value !== "number") continue;
    while (codes.length <= code) codes.push(0);
    codes[code] = value;
  }
  return { width, height, shades, glyphs, table: codes.map((index) => unique[index] ?? -1), mapping: map?.mapping && typeof map.mapping === "object" ? map.mapping : {} };
}

/** The character codes GB Studio would store for this text with this font (its escapes and mapping included). */
export function encodeText(font: GbFont, text: string): number[] {
  const plain = text.replace(/\\([0-7]{3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8))).replace(/\\x([0-9A-Fa-f]+)/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  const keys = Object.keys(font.mapping);
  const codes: number[] = [];
  for (let at = 0; at < plain.length;) {
    const rest = plain.slice(at);
    const key = keys.reduce((best, item) => rest.startsWith(item) && item.length > best.length ? item : best, "");
    if (key) { const value = font.mapping[key]; codes.push(...(Array.isArray(value) ? value : [value])); at += key.length; continue; }
    const code = rest.codePointAt(0) ?? 0;
    codes.push(code);
    at += code > 0xffff ? 2 : 1;
  }
  return codes;
}

/** The sheet glyph a code draws, or null; a space never comes out narrower than 2 pixels. */
export function glyphOf(font: GbFont, code: number): { sx: number; sy: number; width: number } | null {
  const index = font.table[code];
  if (index === undefined || index < 0) return null;
  const glyph = font.glyphs[index];
  return code === 32 && glyph.width < 2 ? { ...glyph, width: 2 } : glyph;
}

/** The font's paper: its most common shade (light on most sheets, dark on sheets of light letters on dark). */
export function paperShade(font: GbFont): number {
  const counts = [0, 0, 0, 0];
  for (const shade of font.shades) if (shade !== CLEAR_PIXEL) counts[shade] += 1;
  return counts.indexOf(Math.max(...counts));
}

/** How wide a run of text is in this font, in pixels. */
export const textWidth = (font: GbFont, text: string) => encodeText(font, text).reduce((sum, code) => sum + (glyphOf(font, code)?.width ?? 0), 0);

/** Fetches a project font's .json map (null when it has none). */
export async function fetchFontMap(file: string): Promise<FontMap | null> {
  const info = await fetch(`./__cartographer/gbstudio-asset-info?${new URLSearchParams({ kind: "fonts", file })}`, { cache: "no-cache" }).then((response) => response.ok ? response.json() as Promise<{ fontMap?: FontMap | null }> : null).catch(() => null);
  return info?.fontMap ?? null;
}
