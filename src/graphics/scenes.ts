/**
 * Wireframe scenes and UI: whole backgrounds laid out from the wireframe tiles (one letter a 16 × 16 tile), with
 * screen-sized pieces drawn on top (title, menu, dialogue), plus GB Studio's UI pieces: the 24 × 24 window frame
 * (an 8 × 8 nine-slice) and the 8 × 8 menu cursor. Backgrounds in screens of 160 × 144 (10 × 9 tiles).
 */
import { drawCave, drawWorld } from "../app/generators";
import { paintXp, sheet } from "./areas";
import { Pen, canvas, textWidth, type Canvas } from "./pen";
import { outdoorTile, TILES } from "./tiles";

/** A background from rows of letters, each letter a tile id in `legend` (space: the first entry). Tall tiles go on
 * after the rest, over the cell below them too. */
export function fromMap(rows: string[], legend: Record<string, string>, between?: (out: Canvas) => void): Canvas {
  const width = Math.max(...rows.map((row) => row.length)) * 16, out = canvas(width, rows.length * 16);
  const blank = Object.values(legend)[0];
  for (const tall of [false, true]) {
    // Between the flat tiles and the tall ones: areas painted with the library's pieces, under the trees.
    if (tall && between) between(out);
    rows.forEach((row, y) => {
    for (let x = 0; x < width / 16; x += 1) {
      const id = legend[row[x] ?? " "] ?? blank, tile = TILES[id];
      if (!tile || Boolean(tile.tall) !== tall) continue;
      if (!outdoorTile(out, id, x * 16, y * 16)) tile.draw(new Pen(out, x * 16, y * 16, 16, tall ? 32 : 16));
    }
    });
  }
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
 * The village, 30 × 18 cells of 16 (3 × 2 screens), remade after the author's Town (2026-10-13, the Asset Catalog
 * project's Town.png): a ring of small round trees with ways out at the bottom, houses with two rows of roof over a
 * brick wall and their door on a path, plain Path tiles in a grid (as the author painted them), Flower bed XP hedges, a framed field (Ground XP),
 * a little pond (Floor tiles XP) under a pine, fences, a sign and a few bushes on Grass XP.
 * Cells: "." grass, T tree, R roof, W wall, D door, "," path, h hedge, c field, o pond, F fence, s sign, P pine.
 */
function village(): string[] {
  const W = 30, H = 18, map = Array.from({ length: H }, () => Array.from({ length: W }, () => "."));
  const set = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < W && y < H) map[y][x] = c; };
  const box = (x: number, y: number, w: number, h: number, c: string) => { for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) set(x + dx, y + dy, c); };
  box(0, 0, W, 1, "T"); box(0, H - 1, W, 1, "T"); box(0, 0, 1, H, "T"); box(W - 1, 0, 1, H, "T");
  // Paths: two long ones across, three down, the ways out at the bottom.
  box(2, 5, 26, 1, ","); box(2, 10, 26, 1, ","); box(4, 14, 22, 1, ",");
  box(2, 5, 1, 6, ","); box(8, 5, 1, 10, ","); box(17, 5, 1, 13, ","); box(25, 5, 1, 6, ","); box(11, 14, 1, 4, ",");
  // Houses: roof, roof, wall with its door, a path from the door to the nearest path.
  const house = (x: number, y: number, w: number, door: number, to: number) => {
    box(x, y, w, 2, "R"); box(x, y + 2, w, 1, "W"); set(door, y + 2, "D");
    for (let py = y + 3; py !== to; py += to > y ? 1 : -1) set(door, py, ",");
  };
  house(3, 1, 4, 4, 5); house(11, 1, 5, 13, 5); house(20, 1, 4, 21, 5);
  house(3, 11, 4, 5, 14); house(13, 11, 3, 14, 14); house(21, 11, 4, 23, 14);
  // Hedges, the field, the pond under its pine, fences, a sign and bushes.
  box(4, 6, 1, 3, "h"); box(4, 8, 3, 1, "h"); box(10, 6, 3, 1, "h"); box(19, 7, 5, 2, "h"); box(26, 11, 2, 2, "h"); box(1, 15, 3, 1, "h"); box(19, 15, 4, 1, "h");
  box(11, 7, 5, 3, "c");
  box(26, 2, 2, 2, "o"); set(27, 1, "P");
  box(6, 6, 1, 1, "F"); box(21, 6, 3, 1, "F");
  set(15, 6, "s");
  return map.map((row) => row.join(""));
}
const villageLegend = { ".": "grass", T: "tree", P: "pine", R: "roof", W: "houseWall", D: "door", ",": "path", h: "grass", c: "grass", o: "grass", F: "fence", s: "sign" };

/**
 * The village as one picture (480 × 288): the tiles from the Outdoor tiles sheet (the author's versions), its paths,
 * hedges, field and pond painted with the library's XP pieces, joined at their edges as the stamps would.
 */
export const villageMap = () => {
  const rows = village(), w = rows[0].length, h = rows.length;
  return fromMap(rows, villageLegend, (out) => {
    paintXp(out, sheet("xp-flowers"), (x, y) => rows[y][x] === "h", w, h, false);
    paintXp(out, sheet("xp-ground"), (x, y) => rows[y][x] === "c", w, h, false);
    paintXp(out, sheet("xp-ice"), (x, y) => rows[y][x] === "o", w, h, false);
  });
};

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
