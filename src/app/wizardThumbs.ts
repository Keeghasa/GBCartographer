/**
 * Thumbnails for the Wizards gallery (2026-10-10): a 160 × 96 picture for each wizard, drawn with the wireframe
 * pen and worn in library palettes (SpicyGame's, Chorbi's, the Overworld set), so each shows what its wizard does.
 * Since 2026-10-14 (the author: "reimagine wizards with new gifs") each is a short loop of frames: the wizard at work.
 */
import library from "../palettes/library.json";
import { Pen, canvas } from "../graphics/pen";
import { drawCave, drawWorld, type Generated } from "./generators";

export type WizardThumb = "picture" | "dns" | "paletteSet" | "budget" | "cave" | "world" | "checkup";

const W = 160, H = 96, TILES_WIDE = W / 8;
const palette = (name: string) => {
  for (const collection of library.collections) for (const item of collection.palettes) if (item.name === name) return { name, colors: [...item.colors] };
  return { name, colors: ["#E0F8CF", "#86C06C", "#306850", "#071821"] };
};

/** A blank thumbnail; `wear` gives every tile one palette. */
function blank(names: string[], wear = 1): Generated {
  const out: Generated = { ...canvas(W, H), cells: new Uint8Array(TILES_WIDE * (H / 8)).fill(wear), palettes: names.map(palette) };
  return out;
}
/** Tiles in the box (x, y, w, h), in pixels on 8-pixel edges, wear palette `wear`. */
function wearBox(out: Generated, x: number, y: number, w: number, h: number, wear: number) {
  for (let ty = y / 8; ty < (y + h) / 8; ty += 1) for (let tx = x / 8; tx < (x + w) / 8; tx += 1) out.cells![ty * TILES_WIDE + tx] = wear;
}
/** The top-left 160 × 96 of a bigger picture, `step` pixels apart (2: half size), cells following. */
function crop(source: Generated, step = 1, from = 0): Generated {
  const out: Generated = { ...canvas(W, H), cells: new Uint8Array(TILES_WIDE * (H / 8)), palettes: source.palettes };
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) out.pixels[y * W + x] = source.pixels[(from + y * step) * source.width + x * step] ?? 0;
  if (source.cells) for (let ty = 0; ty < H / 8; ty += 1) for (let tx = 0; tx < TILES_WIDE; tx += 1) out.cells![ty * TILES_WIDE + tx] = source.cells[Math.floor((from + ty * 8 * step) / 8) * Math.ceil(source.width / 8) + Math.floor(tx * 8 * step / 8)] ?? 0;
  return out;
}
/** A small landscape: sky, a sun, hills, a house. */
function landscape(p: Pen, x: number) {
  p.oval(x + 34, 10, 16, 16, 1, 2);
  p.peak(x - 6, 30, 50, 34, 2); p.peak(x + 30, 38, 44, 26, 2);
  p.rect(x, 64, 80, 32, 3);
  p.panel(x + 46, 52, 18, 14, 1); p.peak(x + 44, 42, 22, 11, 2); p.rect(x + 53, 58, 4, 8, 3);
}

export function wizardThumb(id: WizardThumb, frame = 0): Generated {
  if (id === "picture") {
    // A "photo" (dithered) on the left turning into flat pixels on the right.
    const out = blank(["V20-2-Fire"]), p = new Pen(out);
    landscape(p.at(0, 0, 80, 96), 0); landscape(p.at(80, 0, 80, 96), 0);
    // The photo (dithered) right of the wipe, fitted pixels left of it; the wipe sweeps across frame by frame.
    const wipe = 8 + frame * 24;
    for (let y = 0; y < H; y += 1) for (let x = wipe; x < W; x += 1) if ((x + y) % 3 === 0 && out.pixels[y * W + x] < 3) out.pixels[y * W + x] += 1;
    if (wipe < W) { p.rect(wipe - 1, 0, 2, H, 3); p.peak(wipe - 6, 40, 12, 8, 0); }
    return out;
  }
  if (id === "dns") {
    // The day going round (the author, 2026-10-14: a smooth loop): dawn → day → sunset → night → dawn, each frame's
    // palette a blend of the two versions it lies between (the wizard itself makes only the four).
    const [day, dawn, sunset, night] = ["DWC-1-Cliffs", "DWC-1-Cliffs D", "DWC-1-Cliffs S", "DWC-1-Cliffs N"].map(palette);
    const stops = [dawn, day, sunset, night], per = WIZARD_FRAMES.dns.count / stops.length;
    const at = frame / per, from = stops[Math.floor(at) % stops.length], to = stops[(Math.floor(at) + 1) % stops.length];
    const mix = (a: string, b: string, t: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
    const ease = (t: number) => t * t * (3 - 2 * t);
    const out = blank([]), p = new Pen(out);
    out.palettes = [{ name: "Time of day", colors: from.colors.map((color, i) => mix(color, to.colors[i], ease(at % 1))) }];
    landscape(p.at(0, 0, 80, 96), 0); landscape(p.at(80, 0, 80, 96), 0);
    for (let y = 0; y < 12; y += 4) p.dot(10 + y * 10, 6 + y, 1);
    return out;
  }
  if (id === "paletteSet") {
    // VIBE-20's eight palettes, each a column of its four colors.
    const names = ["V20-1-Skin", "V20-2-Fire", "V20-3-Foliage", "V20-4-Water", "V20-5-Stone", "V20-6-Rose", "V20-7-Wood", "V20-8-UI"];
    const out = blank(["V20-8-UI", ...names]), p = new Pen(out);
    p.fill(3);
    names.forEach((_, at) => { if (at >= frame) return; const x = 16 + at * 16; for (let shade = 0; shade < 4; shade += 1) p.rect(x, 16 + shade * 16, 16, 16, shade); p.box(x, 16, 16, 64, 3); wearBox(out, x, 16, 16, 64, at + 2); });
    return out;
  }
  if (id === "budget") {
    // GB Studio's tile meter over the limit, three near-twin tiles merged into one, the meter back under.
    const out = blank(["Vibrant14-5-Stone"]), p = new Pen(out);
    p.fill(0);
    const brick = (x: number, y: number, chip: number) => {
      const q = p.at(x, y, 16);
      q.panel(0, 0, 16, 16, 1, 3); q.rect(0, 7, 16, 2, 3); q.rect(7, 0, 2, 7, 3); q.rect(3, 9, 2, 7, 3); q.rect(11, 9, 2, 7, 3);
      if (chip >= 0) q.rect(2 + chip * 4, 2, 2, 2, 2);
    };
    // Frame by frame the near twins become one tile, and the meter drops under the limit.
    const merged = Math.min(frame, 3);
    [0, 1, 2].forEach((at) => brick(14 + at * 22, 18, at < merged ? -1 : at));
    p.line(82, 26, 100, 26, 3); p.line(96, 22, 100, 26, 3); p.line(96, 30, 100, 26, 3);
    brick(114, 18, -1);
    const meter = (y: number, full: number, over: boolean) => {
      p.panel(14, y, 116, 10, 0, 3); p.rect(16, y + 2, full, 6, over ? 3 : 2); p.rect(110, y - 2, 2, 14, 3);
    };
    const count = [412, 401, 390, 380][merged];
    p.text(14, 46, `${count}/384`, count > 384 ? 3 : 2); meter(56, Math.round(count / 412 * 112), count > 384);
    if (merged === 3) p.text(14, 72, "UNDER THE LIMIT", 2);
    return out;
  }
  if (id === "cave") return crop(drawCave({ style: "cave", columns: 1, rows: 1, cell: 16, seed: 11 + frame, fill: 45, smooth: 4, rooms: 6, roomSize: 4, connected: true, stairs: true, theme: "V20-5-Stone" }), 1, 24);
  if (id === "world") return crop(drawWorld({ columns: 2, rows: 2, seed: 5 + frame, water: 38, mountains: 18, forest: 35, towns: 2, scale: 4, island: true, roads: true, theme: "vibe20" }), 2, 24);
  // checkup: a health report, ticked off one by one.
  const out = blank(["V20-8-UI"]), p = new Pen(out);
  p.fill(0);
  p.round(8, 6, 144, 84, 0, 2);
  [96, 72, 104, 64].map((width, row) => [row < frame, width] as const).forEach(([done, width], row) => {
    const y = 16 + row * 18;
    p.panel(18, y, 10, 10, done ? 1 : 0, 3);
    if (done) { p.line(20, y + 5, 22, y + 7, 3); p.line(22, y + 7, 26, y + 2, 3); }
    p.rect(36, y + 3, width as number, 4, done ? 1 : 2);
  });
  return out;
}

/** How many frames each wizard's loop has, and how long each shows (ms). */
export const WIZARD_FRAMES: Record<WizardThumb, { count: number; ms: number }> = {
  picture: { count: 12, ms: 220 }, dns: { count: 64, ms: 90 }, paletteSet: { count: 10, ms: 260 }, budget: { count: 6, ms: 700 },
  cave: { count: 4, ms: 1100 }, world: { count: 4, ms: 1100 }, checkup: { count: 6, ms: 600 },
};

/**
 * Picture to background's loop (the author, 2026-10-14: their dog Sammie): the photo, and a wipe sweeping across it
 * that leaves the fitted version behind, each 8 × 8 tile in the nearer of two four-color palettes, as the wizard does.
 */
const FIT_PALETTES = [["#F4DCCB", "#D9938C", "#7B4A36", "#24140E"], ["#E6C690", "#AE7D4C", "#5E3E26", "#1C120C"]]
  .map((colors) => colors.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))));
export function photoFrames(photo: ImageData, count = WIZARD_FRAMES.picture.count): ImageData[] {
  const { width, height, data } = photo, fitted = new Uint8ClampedArray(data);
  const distance = (i: number, c: number[]) => (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2;
  const nearest = (i: number, palette: number[][]) => palette.reduce((best, color) => distance(i, color) < distance(i, best) ? color : best);
  for (let ty = 0; ty < height; ty += 8) for (let tx = 0; tx < width; tx += 8) {
    const pixels: number[] = [];
    for (let y = ty; y < Math.min(height, ty + 8); y += 1) for (let x = tx; x < Math.min(width, tx + 8); x += 1) pixels.push((y * width + x) * 4);
    const palette = FIT_PALETTES.reduce((best, palette) => pixels.reduce((sum, i) => sum + distance(i, nearest(i, palette)), 0) < pixels.reduce((sum, i) => sum + distance(i, nearest(i, best)), 0) ? palette : best);
    for (const i of pixels) fitted.set(nearest(i, palette), i);
  }
  return Array.from({ length: count }, (_, frame) => {
    const wipe = Math.round((frame / (count - 1)) * width), out = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < wipe; x += 1) out.set(fitted.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), (y * width + x) * 4);
    if (wipe > 0 && wipe < width) for (let y = 0; y < height; y += 1) out.set([224, 248, 207, 255], (y * width + wipe) * 4);
    return new ImageData(out, width, height);
  });
}
