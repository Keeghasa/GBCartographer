/**
 * Wireframe scenes and UI: whole backgrounds laid out from the wireframe tiles (one letter a 16 × 16 tile), with
 * screen-sized pieces drawn on top (title, menu, dialogue), plus GB Studio's UI pieces: the 24 × 24 window frame
 * (an 8 × 8 nine-slice) and the 8 × 8 menu cursor. Backgrounds in screens of 160 × 144 (10 × 9 tiles).
 */
import { drawCave, drawWorld } from "../app/generators";
import { Pen, canvas, textWidth, type Canvas } from "./pen";
import { TILES } from "./tiles";

/** A background from rows of letters, each letter a tile id in `legend` (space: the first entry). Tall tiles go on
 * after the rest, over the cell below them too. */
export function fromMap(rows: string[], legend: Record<string, string>): Canvas {
  const width = Math.max(...rows.map((row) => row.length)) * 16, out = canvas(width, rows.length * 16);
  const blank = Object.values(legend)[0];
  for (const tall of [false, true]) rows.forEach((row, y) => {
    for (let x = 0; x < width / 16; x += 1) {
      const tile = TILES[legend[row[x] ?? " "] ?? blank];
      if (tile && Boolean(tile.tall) === tall) tile.draw(new Pen(out, x * 16, y * 16, 16, tall ? 32 : 16));
    }
  });
  return out;
}

/** A sheet of tiles, eight to a row (128 pixels wide), for GB Studio's tilesets; tall ones in a row of their own. */
export function tileSheet(ids: string[]): Canvas {
  const small = ids.filter((id) => !TILES[id].tall), tall = ids.filter((id) => TILES[id].tall);
  const rows = Math.ceil(small.length / 8), out = canvas(128, rows * 16 + Math.ceil(tall.length / 8) * 32);
  small.forEach((id, at) => TILES[id].draw(new Pen(out, (at % 8) * 16, Math.floor(at / 8) * 16, 16)));
  tall.forEach((id, at) => TILES[id].draw(new Pen(out, (at % 8) * 16, rows * 16 + Math.floor(at / 8) * 32, 16, 32)));
  return out;
}

/** A window: light inside, a dark rounded border, as GB Studio draws its frame. */
export function frameBox(p: Pen, x: number, y: number, w: number, h: number) {
  p.rect(x, y, w, h, 0);
  p.rect(x + 2, y, w - 4, 1, 3); p.rect(x + 2, y + h - 1, w - 4, 1, 3); p.rect(x, y + 2, 1, h - 4, 3); p.rect(x + w - 1, y + 2, 1, h - 4, 3);
  p.dot(x + 1, y + 1, 3); p.dot(x + w - 2, y + 1, 3); p.dot(x + 1, y + h - 2, 3); p.dot(x + w - 2, y + h - 2, 3);
}

/** Text twice the size (each letter pixel a 2 × 2 block). */
function bigText(p: Pen, x: number, y: number, words: string, shade = 3) {
  const small = canvas(textWidth(words), 5, 255);
  new Pen(small).text(0, 0, words, shade);
  for (let sy = 0; sy < 5; sy += 1) for (let sx = 0; sx < small.width; sx += 1) if (small.pixels[sy * small.width + sx] !== 255) p.rect(x + sx * 2, y + sy * 2, 2, 2, shade);
}
const centred = (words: string, width = 160, scale = 1) => Math.round((width - textWidth(words) * scale) / 2);

// ---- UI pieces ----------------------------------------------------------------------------------------------------------------

export const ui = {
  frameRound: () => { const out = canvas(24, 24); frameBox(new Pen(out), 0, 0, 24, 24); return out; },
  frameDouble: () => { const out = canvas(24, 24), p = new Pen(out); p.fill(0); p.box(0, 0, 24, 24, 3); p.box(2, 2, 20, 20, 2); return out; },
  frameThick: () => { const out = canvas(24, 24), p = new Pen(out); p.fill(0); p.box(0, 0, 24, 24, 3); p.box(1, 1, 22, 22, 3); p.box(2, 2, 20, 20, 1); return out; },
  frameDark: () => { const out = canvas(24, 24), p = new Pen(out); p.fill(3); p.box(1, 1, 22, 22, 0); return out; },
  cursorArrow: () => { const out = canvas(8, 8), p = new Pen(out); for (let row = 0; row < 7; row += 1) p.rect(2, 1 + row, 4 - Math.abs(3 - row), 1, 3); return out; },
  cursorHand: () => { const out = canvas(8, 8), p = new Pen(out); p.rect(0, 3, 4, 2, 3); p.panel(3, 2, 4, 5, 1); return out; },
  cursorDot: () => { const out = canvas(8, 8), p = new Pen(out); p.oval(2, 2, 4, 4, 3); return out; },
};

// ---- scenes -------------------------------------------------------------------------------------------------------------------

const town = [
  "TTTTTTTTTTTTTTTTTTTT",
  "T..RRRR....RRRRR..pT",
  "T..RRRR....RRRRR...T",
  "T..WDWO....WOWDW.f.T",
  "T...,......,,,,,...T",
  "T,,,,,,,,,,,,,,,,,,T",
  "T,..F..,...s.,.FFF.T",
  "T,.....,.....,.....T",
  "T,..b..,..~~~,..b..T",
  "T,.....,..~~~,.....T",
  "T,,,,,,,..~~~,,,,,,T",
  "T..RRR.,.....,.RRR.T",
  "T..RRR.,..w..,.RRR.T",
  "T..WDW.,.....,.ODW.T",
  "T....,,,,,,,,,,,...T",
  "T.f..,.......,..f..T",
  "T..b.,..r....,.b...T",
  "TTTTT,TTTTTTT,TTTTTT",
];
const townLegend = { ".": "grass", T: "tree", R: "roof", W: "houseWall", D: "door", O: "houseWall", ",": "path", F: "fence", f: "flowers", b: "bush", s: "sign", "~": "water", w: "well", r: "rock", p: "pine" };

const house = [
  "##########",
  "VVOVVcVOVV",
  "BBK|||||||",
  "::::::::bb",
  ":TT:::rr::",
  ":hT:::rr::",
  "::::::::P:",
  "::C:::::::",
  "####dd####",
];
const houseLegend = { ":": "woodFloor", "#": "wallTopIn", "|": "wallBase", V: "wall", O: "windowIn", B: "bookshelf", c: "clock", K: "fireplace", b: "bed", T: "table", h: "chair", r: "rug", P: "pottedPlant", C: "computer", d: "doorway" };

const shop = [
  "##########",
  "BBVOVVOVBB",
  "::::::::::",
  "==========",
  "::::::::::",
  ":j:::::x::",
  "::::rr::::",
  ":P::rr::j:",
  "####dd####",
];
const shopLegend = { ":": "tileFloor", "#": "wallTopIn", B: "bookshelf", V: "wallBase", O: "windowIn", "=": "counter", j: "jar", x: "crate", r: "rug", P: "pottedPlant", d: "doorway" };

const level = [
  "..............................",
  "....cc..........cc............",
  "...............?..........cc..",
  "........?.?................L..",
  "..................====.....L..",
  ".............L.............L..",
  "....====.....L.....^^......L..",
  "GGGGGGGGGGGGGGGGGG~~GGGGGGGGGG",
  "dddddddddddddddddd~~dddddddddd",
];
const levelLegend = { ".": "sky", c: "cloud", "?": "questionBlock", "=": "platform", L: "ladder", "^": "spikesUp", G: "groundTop", d: "ground", "~": "waterSide" };

/**
 * A village of 30 × 18 tiles (2 × 2 pixel cells of 16) built in code: tall trees round the edge with four ways out,
 * two crossing paths, houses with their doors on paths, a pond, a well, fences and flowers.
 */
function village(): string[] {
  const W = 30, H = 18, map = Array.from({ length: H }, () => Array.from({ length: W }, () => "."));
  const set = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < W && y < H) map[y][x] = c; };
  const trees = "QPKN";
  for (let x = 0; x < W; x += 1) if (x < 13 || x > 15) { if (x % 2 === 0) set(x, 0, trees[(x / 2) % 4]); }
  for (let x = 0; x < W; x += 1) if (x < 5 || x > 8) { if (x % 2 === 1) set(x, 16, trees[(x + 1) % 4]); }
  // Tall trees cover the row below too, so none stands on row 8 (the way out on row 9).
  for (let y = 2; y < 15; y += 2) if (y !== 8) { set(0, y, trees[y % 4]); set(W - 1, y, trees[(y + 1) % 4]); }
  for (let x = 0; x < W; x += 1) set(x, 9, ",");
  for (let y = 0; y < H; y += 1) set(14, y, ",");
  for (let y = 9; y < H; y += 1) set(6, y, ",");
  const house = (x: number, y: number, w: number) => {
    for (let dx = 0; dx < w; dx += 1) { set(x + dx, y, "R"); set(x + dx, y + 1, "R"); set(x + dx, y + 2, "W"); }
    const door = x + Math.floor(w / 2);
    set(door, y + 2, "D");
    for (let py = y + 3; py < 9; py += 1) set(door, py, ",");
    return door;
  };
  house(2, 3, 4); house(8, 3, 3); house(17, 2, 5); house(24, 3, 3);
  // Two houses below the main path, their doors on a path along row 14 to the north–south paths.
  for (const [x, y, w, to] of [[2, 11, 3, 6], [18, 11, 4, 14]] as const) {
    for (let dx = 0; dx < w; dx += 1) { set(x + dx, y, "R"); set(x + dx, y + 1, "R"); set(x + dx, y + 2, "W"); }
    const door = x + Math.floor(w / 2);
    set(door, y + 2, "D");
    for (let px = Math.min(door, to); px <= Math.max(door, to); px += 1) set(px, y + 3, ",");
  }
  for (let y = 11; y < 14; y += 1) for (let x = 9; x < 12; x += 1) set(x, y, "~");
  set(16, 11, "w"); set(15, 8, "s"); set(23, 11, "Q"); set(25, 14, "P"); set(11, 6, "K");
  for (let x = 23; x < 28; x += 1) set(x, 7, "F");
  for (const [x, y] of [[4, 7], [10, 15], [21, 15], [27, 12], [12, 2], [20, 7], [3, 15], [26, 9]]) set(x, y, "f");
  for (const [x, y] of [[8, 14], [16, 14], [27, 5], [2, 7]]) set(x, y, "b");
  set(12, 14, "r");
  return map.map((row) => row.join(""));
}
const villageLegend = { ".": "grass", Q: "oakTall", K: "oakTall2", P: "pineTall", N: "pineTall2", R: "roof", W: "houseWall", D: "door", ",": "path", F: "fence", f: "flowers", b: "bush", s: "sign", "~": "water", w: "well", r: "rock" };

/** The village as one picture (480 × 288). */
export const villageMap = () => fromMap(village(), villageLegend);

/**
 * The village cut into 3 × 2 screens for the Map Room: neighbours share their edge tiles (one 8-pixel column or row),
 * so screen (x, y) starts at (152x, 136y).
 */
export function villageScreen(column: number, row: number): Canvas {
  const map = villageMap(), out = canvas(160, 144), x0 = column * 152, y0 = row * 136;
  for (let y = 0; y < 144; y += 1) out.pixels.set(map.pixels.subarray((y0 + y) * map.width + x0, (y0 + y) * map.width + x0 + 160), y * 160);
  return out;
}

export const scenes = {
  title: (): Canvas => {
    const out = canvas(160, 144), p = new Pen(out);
    for (const [x, y] of [[12, 10], [140, 20], [30, 120], [130, 110], [80, 6], [150, 70], [8, 70]]) p.dot(x, y, 2);
    frameBox(p, 16, 28, 128, 48);
    bigText(p, centred("GAME TITLE", 160, 2), 40, "GAME TITLE");
    p.text(centred("A SUBTITLE"), 62, "A SUBTITLE", 2);
    p.text(centred("PRESS START"), 104, "PRESS START");
    p.text(centred("(C) 2026 YOU"), 132, "(C) 2026 YOU", 2);
    return out;
  },
  logo: (): Canvas => { const out = canvas(160, 144), p = new Pen(out); p.fill(3); p.round(48, 40, 64, 48, 1, 0); p.text(centred("LOGO"), 61, "LOGO"); p.text(centred("YOUR STUDIO"), 100, "YOUR STUDIO", 1); return out; },
  menu: (): Canvas => {
    const out = canvas(160, 144), p = new Pen(out);
    p.fill(1);
    frameBox(p, 8, 8, 144, 24); p.text(16, 18, "MENU");
    frameBox(p, 8, 40, 80, 96);
    ["NEW GAME", "CONTINUE", "OPTIONS", "CREDITS"].forEach((item, at) => p.text(24, 52 + at * 16, item));
    for (let row = 0; row < 5; row += 1) p.rect(14, 52 + row, 3 - Math.abs(2 - row), 1, 3);
    frameBox(p, 96, 40, 56, 96); p.text(104, 52, "INFO"); for (let row = 0; row < 5; row += 1) p.rect(104, 64 + row * 10, 40 - row * 6, 2, 2);
    return out;
  },
  dialogue: (): Canvas => {
    const out = villageScreen(0, 0), p = new Pen(out);
    frameBox(p, 0, 96, 160, 48); p.panel(8, 104, 32, 32, 0, 2); p.text(13, 117, "FACE", 2);
    p.text(48, 108, "HELLO THERE!"); p.text(48, 118, "THIS IS WHERE"); p.text(48, 128, "THE WORDS GO."); p.rect(148, 132, 4, 4, 3);
    return out;
  },
  battle: (): Canvas => {
    const out = canvas(160, 144), p = new Pen(out);
    p.fill(0); p.rect(0, 56, 160, 1, 2);
    p.oval(56, 8, 48, 40, 1); p.text(centred("ENEMY"), 26, "ENEMY", 3);
    frameBox(p, 0, 64, 160, 32); p.text(8, 72, "AN ENEMY APPEARS!"); p.text(8, 84, "WHAT WILL YOU DO?", 2);
    frameBox(p, 0, 96, 88, 48); ["FIGHT", "MAGIC", "ITEM", "RUN"].forEach((item, at) => p.text(16 + (at % 2) * 36, 108 + Math.floor(at / 2) * 16, item));
    frameBox(p, 88, 96, 72, 48); p.text(96, 104, "HERO"); p.text(96, 116, "HP 24/30", 2); p.rect(96, 126, 56, 4, 2); p.rect(96, 126, 44, 4, 3);
    return out;
  },
  room: (): Canvas => {
    // A point-and-click room: back wall, floor and ceiling in perspective, a door, a window, a desk.
    const out = canvas(160, 144), p = new Pen(out);
    p.fill(1); p.panel(32, 24, 96, 72, 0, 3);
    p.line(0, 0, 32, 24, 3); p.line(159, 0, 127, 24, 3); p.line(0, 143, 32, 95, 3); p.line(159, 143, 127, 95, 3);
    for (let x = 0; x < 160; x += 16) p.line(x, 143, 32 + x * 0.6, 96, 2);
    p.panel(44, 40, 24, 56, 2); p.dot(63, 70, 0);
    p.panel(84, 36, 32, 24, 1); p.rect(99, 36, 1, 24, 3); p.rect(84, 47, 32, 1, 3);
    p.panel(80, 76, 40, 8, 2); p.rect(84, 84, 2, 12, 3); p.rect(114, 84, 2, 12, 3);
    p.panel(132, 60, 12, 40, 2); p.text(4, 4, "ROOM", 2);
    return out;
  },
  house: () => fromMap(house, houseLegend),
  shop: () => fromMap(shop, shopLegend),
  town: () => fromMap(town, townLegend),
  level: () => fromMap(level, levelLegend),
  cave: (): Canvas => drawCave({ style: "cave", columns: 2, rows: 2, cell: 16, seed: 7, fill: 46, smooth: 4, rooms: 8, roomSize: 5, connected: true, stairs: true }),
  overworld: (): Canvas => drawWorld({ columns: 3, rows: 3, seed: 3, water: 35, mountains: 18, forest: 35, towns: 3, scale: 5, island: true, roads: true, theme: "" }),
};
