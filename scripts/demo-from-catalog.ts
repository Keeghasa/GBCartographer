/**
 * Makes demo/ from the Asset Catalog project (the author, 2026-10-14: "that is the new demo project"): its saved
 * pictures, palettes, settings, stamps and Map Room maps, all GB Cartographer's own art or credited CC0 packs. Left
 * out: backups, unsaved drafts (kept per project), the panel's hidden / pinned list and GB Studio's .bak files.
 *
 *   npx vite-node scripts/demo-from-catalog.ts "/path/to/Asset Catalog"
 */
import { cpSync, existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Give the Asset Catalog project's folder.");
const demo = join(__dirname, "..", "demo");
const project = readdirSync(source).find((file) => file.endsWith(".gbsproj"));
if (!project) throw new Error(`No .gbsproj in ${source}.`);

// The demo's credits stay (written by hand); everything else is replaced.
const credits = existsSync(join(demo, "CREDITS.md")) ? readFileSync(join(demo, "CREDITS.md"), "utf8") : null;
rmSync(demo, { recursive: true, force: true });
const skip = (path: string) => {
  const rel = relative(source, path);
  const name = basename(path);
  return name === ".DS_Store" || name.endsWith(".bak") || name.endsWith(".saving")
    || /^Cartographer\/(backups|unsaved)(\/|$)/.test(rel) || rel === "Cartographer/panel.json" || rel === "build" || rel.startsWith("build/");
};
cpSync(source, demo, { recursive: true, filter: (path) => !skip(path) });
renameSync(join(demo, project), join(demo, "demo.gbsproj"));
const gbsproj = JSON.parse(readFileSync(join(demo, "demo.gbsproj"), "utf8")) as Record<string, unknown>;
writeFileSync(join(demo, "demo.gbsproj"), `${JSON.stringify({ ...gbsproj, name: "GB Cartographer demo", author: "", notes: "GB Cartographer's demo: its own graphics and credited CC0 art (see CREDITS.md)." }, null, 2)}\n`);
const settings = join(demo, "project", "settings.gbsres");
if (existsSync(settings)) writeFileSync(settings, `${JSON.stringify({ ...JSON.parse(readFileSync(settings, "utf8")), name: "GB Cartographer demo", author: "" }, null, 2)}\n`);
if (credits) writeFileSync(join(demo, "CREDITS.md"), credits);
console.log(`demo/ made from ${source}.`);
