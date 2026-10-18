/**
 * Turns a project's Cliff stamps drawn in the older packed layout (48 × 80) into a + (src/app/cliffPlus.ts, the
 * author 2026-10-18), tile palettes moved with their pixels, and adds a "<name> (32 px walls)" stamp beside each: its
 * own + with two-cell faces, made from the same pixels (never replacing a file). Each changed file is backed up first,
 * in the app's data folder like any GB Cartographer save (the desktop app's, or the dev server's with --dev).
 * Usage: npm run cliff-to-plus -- "<project folder>" [--dev]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { join, resolve } from "node:path";
import { decodePng, encodePng } from "../src/gb/png";
import { rectCellsToPlus, rectToPlus } from "../src/app/cliffPlus";
import { CLEAR, type Canvas } from "../src/graphics/pen";
import { backupFile, desktopBackupDir } from "../server/backups";

const project = process.argv[2];
if (!project || !existsSync(join(project, "Cartographer", "stamps"))) throw new Error("Give a GB Studio project folder that has Cartographer/stamps.");
const backupDir = process.argv.includes("--dev") ? resolve("backups") : desktopBackupDir();
const stamps = join(project, "Cartographer", "stamps");
const GREENS = [[224, 248, 207], [134, 192, 108], [48, 104, 80], [7, 24, 33]];

const read = (file: string): Canvas => {
  const png = decodePng(new Uint8Array(readFileSync(file)), (d) => new Uint8Array(inflateSync(d)));
  const pixels = new Uint8Array(png.width * png.height);
  for (let at = 0; at < pixels.length; at += 1) {
    const [r, g, b, a] = png.pixels.subarray(at * 4, at * 4 + 4);
    if (a < 128) { pixels[at] = CLEAR; continue; }
    let best = 0, dist = Infinity;
    GREENS.forEach((c, k) => { const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; if (d < dist) { dist = d; best = k; } });
    pixels[at] = best;
  }
  return { width: png.width, height: png.height, pixels };
};
const write = (file: string, art: Canvas) => {
  const rgba = new Uint8ClampedArray(art.width * art.height * 4);
  art.pixels.forEach((v, at) => { if (v !== CLEAR) rgba.set([...GREENS[v], 255], at * 4); });
  writeFileSync(file, encodePng(rgba, art.width, art.height, (d) => new Uint8Array(deflateSync(d))));
};

let done = 0;
for (const name of readdirSync(stamps).filter((file) => file.endsWith(".png.json"))) {
  const meta = JSON.parse(readFileSync(join(stamps, name), "utf8"));
  const png = join(stamps, name.slice(0, -5));
  if (meta.autotile !== "xpCliff" || !existsSync(png)) continue;
  const rect = read(png);
  if (rect.width !== 48 || rect.height !== 80) continue;
  const tileColors: number[] = meta.tileColors ?? [];
  // The tall one first, while the 48 × 80 is at hand.
  const tallName = `${name.slice(0, -9)} (32 px walls).png`;
  if (!existsSync(join(stamps, tallName))) {
    write(join(stamps, tallName), rectToPlus(rect, true));
    writeFileSync(join(stamps, `${tallName}.json`), `${JSON.stringify({ ...meta, autotile: "xpCliffTall", tileColors: rectCellsToPlus(tileColors, true) }, null, 2)}\n`);
    console.log(`added ${tallName}`);
  }
  for (const file of [png, join(stamps, name)]) backupFile(backupDir, project, file);
  write(png, rectToPlus(rect, false));
  writeFileSync(join(stamps, name), `${JSON.stringify({ ...meta, tileColors: rectCellsToPlus(tileColors, false) }, null, 2)}\n`);
  console.log(`${name.slice(0, -5)}: now a + (112 × 112)`);
  done += 1;
}
console.log(`${done} Cliff stamp${done === 1 ? "" : "s"} turned into a +.`);
