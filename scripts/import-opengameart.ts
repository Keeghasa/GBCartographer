/**
 * Brings six CC0 packs from OpenGameArt into the catalog (the author's pick, 2026-10-14: CC0 art from OpenGameArt only,
 * each piece credited to its maker). Cuts each sheet into tilesets, stamps, auto-tiles, forest brushes and sprites,
 * turns every piece's colors into the four Game Boy shades (by brightness) and writes src/graphics/opengameart.ts.
 *
 *   npx vite-node scripts/import-opengameart.ts "/folder/with/the/downloads"
 *
 * The folder holds the files as downloaded: bricks.brown_.png, gb-mini-pixel-world/ (the zip, unpacked), nestor.png,
 * gauntness.png, Stonelands_tileset_ortho_NES.png and NES_2.png. The downloads themselves never enter the repo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { decodePng, type DecodedPng } from "../src/gb/png";
import type { PieceCredit } from "../src/graphics/types";
import type { AssetKind } from "../src/app/model";
import type { AutotileKind } from "../src/app/autotile";

const folder = process.argv[2];
if (!folder) throw new Error("Give the folder with the downloads.");

const PACKS = {
  bricks: { file: "bricks.brown_.png", group: "Dungeon Bricks", credit: { author: "MoikMellah", license: "CC0", source: "https://opengameart.org/content/4-color-dungeon-bricks-extended-16x16" } },
  mini: { file: "gb-mini-pixel-world/tileset.png", group: "Mini Pixel World", credit: { author: "pebonius", license: "CC0", source: "https://opengameart.org/content/gb-mini-pixel-world" } },
  nestor: { file: "nestor.png", group: "Nestor", credit: { author: "Demetrius (Garbata Team)", license: "CC0", source: "https://opengameart.org/content/nestor-tileset" } },
  gaunt: { file: "gauntness.png", group: "Gauntness", credit: { author: "surt", license: "CC0", source: "https://opengameart.org/content/gauntness" } },
  stone: { file: "Stonelands_tileset_ortho_NES.png", group: "Stonelands", credit: { author: "Chasersgaming", license: "CC0", source: "https://opengameart.org/content/rpg-tile-set-stonelands-nes" } },
  nes2: { file: "NES_2.png", group: "NES Graphics 2", credit: { author: "ETTiNGRiNDER (thanks to gwes)", license: "CC0", source: "https://opengameart.org/content/nes-cc0-graphics-2" } },
} satisfies Record<string, { file: string; group: string; credit: PieceCredit }>;
type Pack = keyof typeof PACKS;

/** A rectangle of a sheet; parts of one piece sit side by side. */
interface Part { pack: Pack; x: number; y: number; w: number; h: number; file?: string }
interface Cut {
  id: string; name: string; kind: AssetKind; parts: Part[]; autotile?: AutotileKind; about?: string;
  /** Colors (hex) read as see-through, besides transparent pixels; "edge": the color at the corner, where it touches the edge. */
  clear?: "edge" | string;
  /** Shades by how much of the picture each color covers (a quarter each), for dark, many-colored scenes. */
  equal?: boolean;
}
const at = (pack: Pack, x: number, y: number, w: number, h: number, file?: string): Part => ({ pack, x, y, w, h, file });
const one = (pack: Pack, x: number, y: number, w: number, h: number) => [at(pack, x, y, w, h)];

const XP = "48 × 64 in RPG Maker's autotile layout (a lone tile, the inner corners, a 3 × 3 block): paint 16 px cells and the edges fit.";
const FOREST = "64 × 32: a clump of trees that tiles as forest, and a tree on its own. Paint in 32 px tree units.";
const NESTOR_XP: [string, number, number][] = [
  ["Grass", 0, 128], ["Tall grass", 48, 128], ["Dirt", 0, 192], ["Cobbles", 48, 192],
  ["Hollow in grass", 96, 0], ["Dark hollow", 144, 0], ["Dirt pit", 96, 64], ["Rocky pit", 144, 64],
  ["Leaf litter", 96, 128], ["Mushroom field", 144, 128], ["Hedge", 96, 192], ["Tree trunks", 144, 192],
];

const CUTS: Cut[] = [
  // Dungeon Bricks (MoikMellah): the walls as a tileset, the furniture as stamps.
  { id: "oga-bricks-tiles", name: "Dungeon bricks", kind: "tilesets", parts: one("bricks", 0, 0, 176, 64), about: "Brick walls, a dark wall and battlements, 16 × 16 tiles." },
  { id: "oga-bricks-pit", name: "Brick pit 9-slice", kind: "stamps", autotile: "box", parts: one("bricks", 0, 0, 48, 48), about: "A brick frame round a dark middle: drag it to any size." },
  { id: "oga-bricks-door", name: "Dungeon door", kind: "stamps", parts: one("bricks", 0, 64, 32, 64), clear: "edge" },
  { id: "oga-bricks-gate", name: "Portcullis arch", kind: "stamps", parts: one("bricks", 32, 64, 32, 32), clear: "edge" },
  { id: "oga-bricks-arch", name: "Arch", kind: "stamps", parts: one("bricks", 64, 64, 32, 32), clear: "edge" },
  { id: "oga-bricks-arch-seal", name: "Sealed arch", kind: "stamps", parts: one("bricks", 96, 64, 32, 32), clear: "edge" },
  { id: "oga-bricks-pillar", name: "Pillar", kind: "stamps", parts: one("bricks", 128, 64, 16, 32), clear: "edge" },
  { id: "oga-bricks-candelabra", name: "Candle stand", kind: "stamps", parts: one("bricks", 144, 48, 16, 48), clear: "edge" },
  { id: "oga-bricks-goblet", name: "Goblet", kind: "stamps", parts: one("bricks", 128, 48, 16, 16), clear: "edge" },
  { id: "oga-bricks-bust", name: "Bust", kind: "stamps", parts: one("bricks", 160, 48, 16, 16), clear: "edge" },
  { id: "oga-bricks-cups", name: "Cups", kind: "stamps", parts: one("bricks", 160, 64, 16, 16), clear: "edge" },
  { id: "oga-bricks-vase", name: "Vase", kind: "stamps", parts: one("bricks", 160, 80, 16, 16), clear: "edge" },
  { id: "oga-bricks-table", name: "Table and stool", kind: "stamps", parts: one("bricks", 32, 96, 48, 32), clear: "edge" },
  { id: "oga-bricks-shield", name: "Shield and swords", kind: "stamps", parts: one("bricks", 80, 96, 32, 32), clear: "edge" },
  { id: "oga-bricks-painting", name: "Painting", kind: "stamps", parts: one("bricks", 112, 96, 32, 32), clear: "edge" },
  { id: "oga-bricks-food", name: "Food", kind: "stamps", parts: one("bricks", 144, 96, 32, 32), clear: "edge" },
  { id: "oga-bricks-chairs", name: "Chairs", kind: "stamps", parts: one("bricks", 0, 128, 32, 48), clear: "edge" },
  { id: "oga-bricks-rack", name: "Weapon rack", kind: "stamps", parts: one("bricks", 32, 128, 16, 48), clear: "edge" },
  { id: "oga-bricks-armor", name: "Suit of armor", kind: "stamps", parts: one("bricks", 48, 128, 32, 48), clear: "edge" },
  { id: "oga-bricks-sacks", name: "Sacks", kind: "stamps", parts: one("bricks", 80, 128, 32, 16), clear: "edge" },
  { id: "oga-bricks-crate", name: "Big crate", kind: "stamps", parts: one("bricks", 80, 144, 32, 32), clear: "edge" },
  { id: "oga-bricks-barrel", name: "Barrel and coins", kind: "stamps", parts: one("bricks", 112, 128, 16, 48), clear: "edge" },
  { id: "oga-bricks-treasure", name: "Treasure", kind: "stamps", parts: one("bricks", 128, 128, 48, 16), clear: "edge" },
  { id: "oga-bricks-bones", name: "Skull and bones", kind: "stamps", parts: one("bricks", 128, 144, 16, 32), clear: "edge" },
  { id: "oga-bricks-rug", name: "Rope rug", kind: "stamps", parts: one("bricks", 144, 144, 32, 32), clear: "edge" },

  // Mini Pixel World (pebonius): the sheet, the walker, the house, tree and props.
  { id: "oga-mini-tiles", name: "Mini Pixel World", kind: "tilesets", parts: one("mini", 0, 0, 80, 144), about: "The whole sheet, 16 × 16 tiles: a house, tree, fence, ground and props." },
  { id: "oga-mini-walker", name: "Mini World kid", kind: "sprites", about: "Six frames: down, down step, up, up step, right, right step.",
    parts: ["down1", "down2", "up1", "up2", "right1", "right2"].map((frame) => at("mini", 0, 0, 16, 16, `gb-mini-pixel-world/pc-walk-${frame}.png`)), clear: "edge" },
  { id: "oga-mini-npc", name: "Mini World gardener", kind: "sprites", parts: one("mini", 32, 0, 16, 16), clear: "edge", about: "One frame." },
  { id: "oga-mini-cat", name: "Mini World cat", kind: "sprites", parts: one("mini", 0, 64, 16, 16), clear: "edge", about: "One frame." },
  { id: "oga-mini-house", name: "Cottage", kind: "stamps", parts: one("mini", 0, 0, 32, 32), clear: "edge" },
  { id: "oga-mini-tree", name: "Big leafy tree", kind: "stamps", parts: one("mini", 48, 0, 32, 32), clear: "edge" },
  { id: "oga-mini-bush", name: "Bush", kind: "stamps", parts: one("mini", 0, 32, 16, 16), clear: "edge" },
  { id: "oga-mini-gate", name: "Wooden gate", kind: "stamps", parts: one("mini", 16, 32, 48, 48), clear: "edge" },
  { id: "oga-mini-crops", name: "Crop rows", kind: "stamps", parts: one("mini", 64, 32, 16, 16), clear: "edge" },
  { id: "oga-mini-flower", name: "Big flower", kind: "stamps", parts: one("mini", 0, 48, 16, 16), clear: "edge" },
  { id: "oga-mini-pot", name: "Clay pot", kind: "stamps", parts: one("mini", 64, 48, 16, 16), clear: "edge" },
  { id: "oga-mini-sign", name: "Signpost", kind: "stamps", parts: one("mini", 64, 64, 16, 16), clear: "edge" },
  { id: "oga-mini-pond", name: "Garden plot", kind: "stamps", parts: one("mini", 0, 96, 48, 48), clear: "edge" },
  { id: "oga-mini-plant", name: "Potted plant", kind: "stamps", parts: one("mini", 64, 128, 16, 16), clear: "edge" },

  // Nestor (Demetrius, Garbata Team): RPG Maker 2000's chipset, its twelve ground autotiles, trees and props.
  { id: "oga-nestor-tiles", name: "Nestor", kind: "tilesets", parts: one("nestor", 192, 0, 288, 256), about: "Floors, walls, roofs, furniture and props, 16 × 16 tiles." },
  { id: "oga-nestor-water", name: "Nestor water and ground", kind: "tilesets", parts: one("nestor", 0, 0, 192, 256), about: "Water, waterfalls and ground, as the chipset lays them out." },
  ...NESTOR_XP.map(([name, x, y]): Cut => ({ id: `oga-nestor-xp-${name.toLowerCase().replace(/ /g, "-")}`, name, kind: "stamps", autotile: "xp", parts: one("nestor", x, y, 48, 64), about: XP })),
  { id: "oga-nestor-forest-round", name: "Leafy forest", kind: "stamps", autotile: "forest", parts: [at("nestor", 336, 128, 32, 32), at("nestor", 304, 128, 32, 32)], clear: "edge", about: FOREST },
  { id: "oga-nestor-forest-pine", name: "Fir forest", kind: "stamps", autotile: "forest", parts: [at("nestor", 352, 160, 32, 32), at("nestor", 320, 160, 32, 32)], clear: "edge", about: FOREST },
  { id: "oga-nestor-cypress", name: "Cypresses", kind: "stamps", parts: one("nestor", 288, 160, 32, 32), clear: "edge" },
  { id: "oga-nestor-bushes", name: "Round bushes", kind: "stamps", parts: one("nestor", 368, 128, 16, 32), clear: "edge" },
  { id: "oga-nestor-dead-tree", name: "Bare tree", kind: "stamps", parts: one("nestor", 384, 16, 32, 32), clear: "edge" },
  { id: "oga-nestor-boulder", name: "Boulder", kind: "stamps", parts: one("nestor", 416, 16, 32, 32), clear: "edge" },
  { id: "oga-nestor-statue", name: "Statue", kind: "stamps", parts: one("nestor", 448, 176, 16, 32), clear: "edge" },

  // Gauntness (surt): the grey set of its dungeon walls, and its sample room.
  { id: "oga-gaunt-tiles", name: "Gauntness walls", kind: "tilesets", parts: one("gaunt", 0, 240, 640, 392), about: "Five dungeon wall styles in three looks each, plus doors, pipes and floors." },
  { id: "oga-gaunt-room", name: "Gauntness room", kind: "backgrounds", parts: one("gaunt", 8, 40, 256, 192), equal: true, about: "The pack's sample room, 256 × 192." },

  // Stonelands (Chasersgaming): the sheet, its trees and props.
  { id: "oga-stone-tiles", name: "Stonelands", kind: "tilesets", parts: one("stone", 0, 24, 280, 232), about: "Grassland, rocks, fences, logs, water and a waterfall, 8 × 8 tiles." },
  { id: "oga-stone-grove", name: "Grove", kind: "stamps", parts: one("stone", 0, 176, 72, 56), clear: "edge" },
  { id: "oga-stone-tree", name: "Tall tree", kind: "stamps", parts: one("stone", 88, 176, 24, 48), clear: "edge" },
  { id: "oga-stone-signs", name: "Arrow signs", kind: "stamps", parts: one("stone", 48, 24, 64, 32), clear: "edge" },
  { id: "oga-stone-boxes", name: "Wooden boxes", kind: "stamps", parts: one("stone", 72, 216, 40, 32), clear: "edge" },

  // NES Graphics 2 (ETTiNGRiNDER): three items and five wall tiles.
  { id: "oga-nes2-shield", name: "Crest shield", kind: "sprites", parts: one("nes2", 3, 1, 16, 16), clear: "edge", about: "One frame." },
  { id: "oga-nes2-sword", name: "Sword", kind: "sprites", parts: one("nes2", 21, 1, 16, 16), clear: "edge", about: "One frame." },
  { id: "oga-nes2-gun", name: "Blaster", kind: "sprites", parts: one("nes2", 39, 1, 16, 16), clear: "edge", about: "One frame." },
  { id: "oga-nes2-tiles", name: "NES bricks", kind: "tilesets", parts: [at("nes2", 3, 21, 16, 16), at("nes2", 21, 21, 16, 16), at("nes2", 39, 21, 16, 16), at("nes2", 3, 39, 16, 16), at("nes2", 21, 39, 16, 16)], about: "Five 16 × 16 tiles: bricks, a carved block, red brick and leaves." },
];

const CLEAR = 4;
const sheets = new Map<string, DecodedPng>();
const sheet = (file: string) => {
  if (!sheets.has(file)) sheets.set(file, decodePng(readFileSync(join(folder, file)), (bytes) => inflateSync(bytes)));
  return sheets.get(file)!;
};
const luma = (rgb: number) => 0.299 * (rgb >> 16) + 0.587 * ((rgb >> 8) & 255) + 0.114 * (rgb & 255);

/** A piece's colors as rows of shades: see-through as ".", the rest by brightness into 0–3 (1–3 on sprites). */
function convert(cut: Cut): string[] {
  const width = cut.parts.reduce((sum, part) => sum + part.w, 0), height = Math.max(...cut.parts.map((part) => part.h));
  const rgb = new Int32Array(width * height).fill(-1);
  let left = 0;
  for (const part of cut.parts) {
    const png = sheet(part.file ?? PACKS[part.pack].file);
    const fileX = part.file ? 0 : part.x, fileY = part.file ? 0 : part.y;
    const own = new Int32Array(part.w * part.h).fill(-1);
    for (let y = 0; y < part.h; y += 1) for (let x = 0; x < part.w; x += 1) {
      const sx = fileX + x, sy = fileY + y;
      if (sx >= png.width || sy >= png.height) continue;
      const i = (sy * png.width + sx) * 4;
      if (png.pixels[i + 3] >= 128) own[y * part.w + x] = (png.pixels[i] << 16) | (png.pixels[i + 1] << 8) | png.pixels[i + 2];
    }
    // The background color where it touches the piece's edge (flood from the border) is see-through too.
    if (cut.clear === "edge") {
      const counts = new Map<number, number>();
      for (let x = 0; x < part.w; x += 1) for (const y of [0, part.h - 1]) counts.set(own[y * part.w + x], (counts.get(own[y * part.w + x]) ?? 0) + 1);
      for (let y = 0; y < part.h; y += 1) for (const x of [0, part.w - 1]) counts.set(own[y * part.w + x], (counts.get(own[y * part.w + x]) ?? 0) + 1);
      const background = [...counts].filter(([color]) => color !== -1).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (background !== undefined) {
        const stack: number[] = [];
        for (let x = 0; x < part.w; x += 1) stack.push(x, (part.h - 1) * part.w + x);
        for (let y = 0; y < part.h; y += 1) stack.push(y * part.w, y * part.w + part.w - 1);
        while (stack.length) {
          const p = stack.pop()!;
          if (own[p] !== background) continue;
          own[p] = -1;
          const x = p % part.w, y = (p - x) / part.w;
          if (x > 0) stack.push(p - 1);
          if (x < part.w - 1) stack.push(p + 1);
          if (y > 0) stack.push(p - part.w);
          if (y < part.h - 1) stack.push(p + part.w);
        }
      }
    }
    for (let y = 0; y < part.h; y += 1) for (let x = 0; x < part.w; x += 1) rgb[y * width + left + x] = own[y * part.w + x];
    left += part.w;
  }

  // Brightness to shades: four levels by 1-D k-means over the piece's own colors (weighted by how often each shows).
  const counts = new Map<number, number>();
  for (const color of rgb) if (color !== -1) counts.set(color, (counts.get(color) ?? 0) + 1);
  const colors = [...counts.keys()].sort((a, b) => luma(b) - luma(a));
  const levels = cut.kind === "sprites" || cut.kind === "emotes" ? 3 : 4;
  const shadeOf = new Map<number, number>();
  if (cut.equal) {
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    let seen = 0;
    for (const color of colors) { shadeOf.set(color, Math.min(levels - 1, Math.floor(((seen + counts.get(color)! / 2) / total) * levels))); seen += counts.get(color)!; }
  } else if (colors.length <= levels) {
    // Few colors: each its own shade, spread by brightness (lightest the lightest shade, darkest the darkest).
    const lo = luma(colors[colors.length - 1] ?? 0), hi = luma(colors[0] ?? 0);
    const taken: number[] = [];
    colors.forEach((color, index) => {
      let level = hi === lo ? 0 : Math.round(((hi - luma(color)) / (hi - lo)) * (levels - 1));
      level = Math.max(level, taken.length ? taken[taken.length - 1] + 1 : 0, 0);
      level = Math.min(level, levels - (colors.length - index));
      taken.push(level);
      shadeOf.set(color, level);
    });
  } else {
    const values = colors.map(luma);
    const lo = Math.min(...values), hi = Math.max(...values);
    let centers = Array.from({ length: levels }, (_, index) => hi - ((hi - lo) * index) / (levels - 1));
    for (let round = 0; round < 30; round += 1) {
      const sums = centers.map(() => 0), weights = centers.map(() => 0);
      colors.forEach((color, index) => {
        const nearest = centers.reduce((best, center, c) => Math.abs(values[index] - center) < Math.abs(values[index] - centers[best]) ? c : best, 0);
        sums[nearest] += values[index] * counts.get(color)!; weights[nearest] += counts.get(color)!;
      });
      centers = centers.map((center, c) => weights[c] ? sums[c] / weights[c] : center);
    }
    colors.forEach((color, index) => shadeOf.set(color, centers.reduce((best, center, c) => Math.abs(values[index] - center) < Math.abs(values[index] - centers[best]) ? c : best, 0)));
  }
  const offset = levels === 3 ? 1 : 0;
  // Tilesets and backgrounds have no see-through: it reads as the lightest shade.
  const solid = cut.kind !== "stamps" && cut.kind !== "sprites" && cut.kind !== "emotes";
  const rows: string[] = [];
  for (let y = 0; y < height; y += 1) {
    let row = "";
    for (let x = 0; x < width; x += 1) {
      const color = rgb[y * width + x];
      row += color === -1 ? (solid ? "0" : ".") : String(shadeOf.get(color)! + offset);
    }
    rows.push(row);
  }
  void CLEAR;
  return rows;
}

const out: string[] = [];
for (const cut of CUTS) {
  const pack = PACKS[cut.parts[0].pack];
  out.push(`  ${JSON.stringify({ id: cut.id, name: cut.name, group: pack.group, kind: cut.kind, ...(cut.autotile ? { autotile: cut.autotile } : {}), ...(cut.about ? { about: cut.about } : {}), credit: pack.credit })
    .replace(/}$/, `, rows: [\n${convert(cut).map((row) => `    ${JSON.stringify(row)},`).join("\n")}\n  ] },`)}`);
}
writeFileSync(join(__dirname, "..", "src", "graphics", "opengameart.ts"), `/**
 * CC0 art from OpenGameArt (the author's pick, 2026-10-14), each piece credited to its maker: cut from the packs and
 * turned into the four Game Boy shades by scripts/import-opengameart.ts. Rows of shades, 0 lightest … 3 darkest,
 * "." see-through. Don't edit by hand: edit in the Asset Catalog project and import again.
 */
import type { AutotileKind } from "../app/autotile";
import type { PieceCredit } from "./types";
import type { AssetKind } from "../app/model";

export interface OgaPiece { id: string; name: string; group: string; kind: AssetKind; autotile?: AutotileKind; about?: string; credit: PieceCredit; rows: readonly string[] }

export const OPENGAMEART: OgaPiece[] = [
${out.join("\n")}
];
`);
console.log(`${CUTS.length} pieces written to src/graphics/opengameart.ts`);
