/**
 * The UI frame wizard's frames (the author, 2026-11-02): GB Studio's window frame, assets/ui/frame.png, is 24 × 24,
 * nine 8 × 8 tiles (corners, edges, middle) that the engine stretches around a dialogue box or menu. A frame starts
 * from one of the catalog's Frame pieces (the author's hand edit when there is one), then takes the chosen corners,
 * border shade and fill shade. Pure: no DOM, so the tests can read it.
 */
import { catalogVersion } from "../graphics/areas";
import { canvas, Pen, type Canvas } from "../graphics/pen";
import { ui } from "../graphics/scenes";

export const FRAME_SIZE = 24;

export type FrameStyle = "thin" | "double" | "rounded" | "thick" | "dark";
export type FrameCorners = "drawn" | "square" | "rounded" | "cut";

export interface FrameSettings { style: FrameStyle; corners: FrameCorners; /** The outer line's shade, 0–3. */ border: number; /** The middle's shade, 0–3. */ fill: number }

export const FRAME_STYLES: { value: FrameStyle; label: string; title: string }[] = [
  { value: "thin", label: "Thin", title: "One line, square" },
  { value: "double", label: "Double line", title: "The catalog's Frame (double line)" },
  { value: "rounded", label: "Rounded", title: "The catalog's Frame (rounded)" },
  { value: "thick", label: "Thick", title: "The catalog's Frame (thick)" },
  { value: "dark", label: "Dark", title: "The catalog's Frame (dark): a light line on dark" },
];
export const FRAME_CORNERS: { value: FrameCorners; label: string; title: string }[] = [
  { value: "drawn", label: "As drawn", title: "The corners as the piece has them" },
  { value: "square", label: "Square", title: "Lines meet at a right angle" },
  { value: "rounded", label: "Round", title: "A 3-pixel curve" },
  { value: "cut", label: "Cut", title: "The corner clipped at 45°" },
];

/** Each style's own border and fill, so picking a style starts from how the piece looks. */
export const STYLE_SHADES: Record<FrameStyle, { border: number; fill: number }> = {
  thin: { border: 3, fill: 0 }, double: { border: 3, fill: 0 }, rounded: { border: 3, fill: 0 }, thick: { border: 3, fill: 0 }, dark: { border: 0, fill: 3 },
};

/** The style's piece, as the catalog has it. */
function piece(style: FrameStyle): Canvas {
  if (style === "thin") { const out = canvas(FRAME_SIZE, FRAME_SIZE), p = new Pen(out); p.fill(0); p.box(0, 0, FRAME_SIZE, FRAME_SIZE, 3); return out; }
  const id = { double: "ui-frame-double", rounded: "ui-frame-round", thick: "ui-frame-thick", dark: "ui-frame-dark" }[style];
  const made = { double: ui.frameDouble, rounded: ui.frameRound, thick: ui.frameThick, dark: ui.frameDark }[style];
  const authored = catalogVersion(id);
  const out = authored && authored.width === FRAME_SIZE && authored.height === FRAME_SIZE ? authored : made();
  return { width: out.width, height: out.height, pixels: out.pixels.slice() };
}

/**
 * The frame: the piece's shades swapped so its middle is `fill` and its outer line `border` (a shade the swap would
 * hide takes the one it gave up), then its corners redrawn from the top edge's cross-section (each depth into the
 * frame keeps its shade), mirrored into all four.
 */
export function drawFrame({ style, corners, border, fill }: FrameSettings): Canvas {
  const out = piece(style);
  const at = (x: number, y: number) => out.pixels[y * FRAME_SIZE + x];
  // The border: the first shade down the top edge that isn't the fill (the dark frame starts with a ring of fill).
  const oldFill = at(12, 12), oldBorder = Array.from({ length: 8 }, (_, depth) => at(12, depth)).find((shade) => shade !== oldFill) ?? oldFill;
  // A shade swap: old fill → fill, old border → border, and whatever was `fill` / `border` before takes their places.
  const map = [0, 1, 2, 3];
  map[oldFill] = fill;
  if (oldBorder !== oldFill) map[oldBorder] = border;
  const given = new Set([fill, border]), spare = [0, 1, 2, 3].filter((shade) => !given.has(shade) && shade !== oldFill && shade !== oldBorder).concat([oldFill, oldBorder].filter((shade) => !given.has(shade)));
  for (let shade = 0; shade < 4; shade += 1) if (shade !== oldFill && shade !== oldBorder && given.has(map[shade])) map[shade] = spare.shift() ?? map[shade];
  for (let i = 0; i < out.pixels.length; i += 1) if (out.pixels[i] < 4) out.pixels[i] = map[out.pixels[i]];
  if (corners === "drawn") return out;
  // The cross-section: shade by depth, read down the middle of the top edge.
  const profile = Array.from({ length: 8 }, (_, depth) => at(12, depth));
  const corner = (x: number, y: number): number => {
    let depth = Math.min(x, y);
    if (corners === "cut") depth = Math.min(depth, x + y - 2);
    if (corners === "rounded" && x < 4 && y < 4) depth = Math.min(depth, Math.floor(3.5 - Math.hypot(3.5 - x, 3.5 - y) + 0.5));
    return depth < 0 ? profile[7] : profile[Math.min(7, depth)];
  };
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
    const shade = corner(x, y);
    for (const [cx, cy] of [[x, y], [23 - x, y], [x, 23 - y], [23 - x, 23 - y]]) out.pixels[cy * FRAME_SIZE + cx] = shade;
  }
  return out;
}

/** The frame nine-sliced into a box `columns` × `rows` tiles (at least 2 × 2), as GB Studio stretches it. */
export function sliceFrame(frame: Canvas, columns: number, rows: number): Canvas {
  const out = canvas(columns * 8, rows * 8);
  for (let ty = 0; ty < rows; ty += 1) for (let tx = 0; tx < columns; tx += 1) {
    const fx = tx === 0 ? 0 : tx === columns - 1 ? 16 : 8, fy = ty === 0 ? 0 : ty === rows - 1 ? 16 : 8;
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) out.pixels[(ty * 8 + y) * out.width + tx * 8 + x] = frame.pixels[(fy + y) * FRAME_SIZE + fx + x];
  }
  return out;
}

/** A name for the new PNG that isn't taken: frame.png when the project has none (GB Studio reads that one), else frame-<style>, -2, -3… */
export function frameFileName(style: FrameStyle, taken: Iterable<string>): string {
  const used = new Set([...taken].map((file) => file.toLowerCase().replace(/\.png$/, "")));
  if (!used.has("frame")) return "frame";
  let name = `frame-${style}`;
  for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `frame-${style}-${n}`;
  return name;
}
