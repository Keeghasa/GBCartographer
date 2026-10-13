/**
 * Brings the author's hand edits from the Asset Catalog project back into the code (the author, 2026-10-13: the
 * Asset Catalog project is where the library's art is decided). For each catalog graphic whose file in the project
 * was saved by GB Cartographer (it has a backup there, so it was edited by hand), the file's pixels are written into
 * src/graphics/authored.ts, which the library uses in place of the code-drawn version.
 * Usage: npm run import-authored -- "<Asset Catalog folder>"
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";
import { GRAPHICS } from "../src/graphics/library";
import { decodePng } from "../src/gb/png";

const folder = process.argv[2];
if (!folder) throw new Error("Give the Asset Catalog project folder.");
const GREENS = [[224, 248, 207], [134, 192, 108], [48, 104, 80], [7, 24, 33]];
const out: string[] = [];
for (const asset of GRAPHICS) {
  const rel = asset.kind === "stamps" ? join("Cartographer", "stamps", `${asset.name}.png`) : join("assets", asset.kind, `${asset.name}.png`);
  const file = join(folder, rel);
  if (!existsSync(file) || !existsSync(join(folder, "Cartographer", "backups", rel))) continue;
  const png = decodePng(new Uint8Array(readFileSync(file)), (d) => new Uint8Array(inflateSync(d)));
  const rows: string[] = [];
  for (let y = 0; y < png.height; y += 1) {
    let row = "";
    for (let x = 0; x < png.width; x += 1) {
      const i = (y * png.width + x) * 4, [r, g, b, a] = [png.pixels[i], png.pixels[i + 1], png.pixels[i + 2], png.pixels[i + 3]];
      if (a < 128 || (r === 0 && g === 255 && b === 0) || (r === 255 && g === 0 && b === 255)) { row += "."; continue; }
      let best = 0, dist = Infinity;
      GREENS.forEach((c, k) => { const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; if (d < dist) { dist = d; best = k; } });
      // Sprites and emotes: GB Studio draws their lightest shade as see-through.
      row += best === 0 && (asset.kind === "sprites" || asset.kind === "emotes") ? "." : String(best);
    }
    rows.push(row);
  }
  out.push(`  ${JSON.stringify(asset.id)}: [\n${rows.map((row) => `    ${JSON.stringify(row)},`).join("\n")}\n  ],`);
}
writeFileSync("src/graphics/authored.ts", `/**
 * The author's own versions of library graphics, edited by hand in the Asset Catalog project and brought back by
 * scripts/import-authored.ts (2026-10-13). Rows of shades, 0 lightest … 3 darkest, "." see-through. The library uses
 * these in place of the code-drawn art. Don't edit by hand: edit in the Asset Catalog project and import again.
 */
export const AUTHORED: Record<string, readonly string[]> = {
${out.join("\n")}
};
`);
console.log(`${out.length} graphics imported into src/graphics/authored.ts`);
