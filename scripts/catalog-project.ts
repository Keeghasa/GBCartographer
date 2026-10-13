/**
 * Makes (or refreshes) a GB Studio project holding everything in the Asset Catalog (the author's ask, 2026-10-12), to
 * edit the pieces by hand and decide what to add or drop: every palette shelf as project palettes, every graphic as
 * a PNG in its kind's folder (stamps in Cartographer/stamps with their auto-tile set). A file already there is left
 * alone, so hand edits survive a refresh; new catalog items are added beside them.
 *
 *   npx vite-node scripts/catalog-project.ts "/path/to/Asset Catalog"
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { encodePng } from "../src/gb/png";
import { GRAPHICS } from "../src/graphics/library";
import { storeShelves } from "../src/app/store";
import { KEY_GREEN, KEY_MAGENTA, toRgba } from "../src/paint";
import { ownFolderReadme } from "../server/backups";
import { KEYED_KINDS, paletteFileName } from "../server/assets";

const folder = process.argv[2];
if (!folder) throw new Error("Give the project folder to make.");
const name = folder.split("/").filter(Boolean).pop() ?? "Asset Catalog";
mkdirSync(join(folder, "project", "palettes"), { recursive: true });
for (const kind of ["backgrounds", "sprites", "tilesets", "fonts", "emotes", "avatars", "ui"]) mkdirSync(join(folder, "assets", kind), { recursive: true });

// The project file and settings: GB Studio 4's format, the settings copied from the demo and pointed at the first palettes.
const gbsproj = join(folder, `${name}.gbsproj`);
if (!existsSync(gbsproj)) writeFileSync(gbsproj, `${JSON.stringify({ _resourceType: "project", name, author: "", notes: "Every palette and graphic from GB Cartographer's Asset Catalog, to edit by hand.", _version: "4.2.0", _release: "10" }, null, 2)}\n`);

// Palettes: every shelf's sets, one .gbsres each (a palette file of the same name already there is kept).
const palettes = join(folder, "project", "palettes");
const have = new Map<string, string>();
for (const file of readdirSync(palettes).filter((entry) => entry.endsWith(".gbsres"))) {
  const meta = JSON.parse(readFileSync(join(palettes, file), "utf8")) as { id?: string; name?: string };
  if (meta.name && meta.id) have.set(meta.name.toLowerCase(), meta.id);
}
const ids: string[] = [];
let addedPalettes = 0;
for (const shelf of storeShelves()) for (const set of shelf.sets) for (const palette of set.palettes) {
  const known = have.get(palette.name.toLowerCase());
  if (known) { ids.push(known); continue; }
  const id = randomUUID();
  let file = `${paletteFileName(palette.name)}.gbsres`;
  for (let n = 2; existsSync(join(palettes, file)); n += 1) file = `${paletteFileName(palette.name)}_${n}.gbsres`;
  writeFileSync(join(palettes, file), `${JSON.stringify({ _resourceType: "palette", id, name: palette.name, colors: palette.colors.map((color) => color.replace(/^#/, "").toUpperCase()) }, null, 2)}\n`);
  have.set(palette.name.toLowerCase(), id);
  ids.push(id);
  addedPalettes += 1;
}
const settingsFile = join(folder, "project", "settings.gbsres");
if (!existsSync(settingsFile)) {
  const demo = JSON.parse(readFileSync(join(__dirname, "..", "demo", "project", "settings.gbsres"), "utf8")) as Record<string, unknown>;
  writeFileSync(settingsFile, `${JSON.stringify({ ...demo, name, author: "", defaultBackgroundPaletteIds: ids.slice(0, 8), defaultSpritePaletteIds: Array.from({ length: 8 }, () => ids[0]), customHead: "" }, null, 2)}\n`);
}

// Graphics: a PNG per piece in its kind's folder (see-through as GB Studio's key green on sprites and emotes, alpha
// elsewhere); stamps get their sidecar with the auto-tile.
let addedArt = 0;
for (const asset of GRAPHICS) {
  const art = asset.make();
  const dir = asset.kind === "stamps" ? join(folder, "Cartographer", "stamps") : join(folder, "assets", asset.kind);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${asset.name}.png`);
  if (existsSync(file)) continue;
  const keyed = (KEYED_KINDS as readonly string[]).includes(asset.kind);
  const rgba = toRgba(art.pixels, new Uint8Array(Math.ceil(art.width / 8) * Math.ceil(art.height / 8)), art.width, [], keyed ? KEY_GREEN : asset.kind === "fonts" ? KEY_MAGENTA : undefined);
  writeFileSync(file, encodePng(rgba, art.width, art.height, (bytes) => deflateSync(bytes)));
  if (asset.kind === "stamps") writeFileSync(`${file}.json`, `${JSON.stringify({ _resourceType: "cartographerStamp", slots: [], tileColors: [], ...(asset.group === "Patterns" ? { tags: ["pattern"] } : {}), ...(asset.autotile ? { autotile: asset.autotile } : {}) }, null, 2)}\n`);
  addedArt += 1;
}
ownFolderReadme(folder);
console.log(`${name}: ${addedPalettes} palettes and ${addedArt} graphics added (${have.size} palettes, ${GRAPHICS.length} graphics in the catalog).`);
