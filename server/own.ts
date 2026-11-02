/**
 * What GB Cartographer keeps for a project inside the project (the author's picks, 2026-10-12), so it travels with
 * it to another computer, in its own Cartographer/ folder (GB Studio never reads it):
 * - cartographer.json: the folder's format, and per-project choices (`timeOfDay`: the Time-of-day palettes switch,
 *   which changes what Save writes);
 * - panel.json: which pictures are hidden and pinned in the project panel ("kind/file" keys);
 * - unsaved/<kind>/<file>.json: a picture's unsaved changes ("Save to GB Cartographer only"), written by the page
 *   while it has them and taken away (into the backups) once they're saved or discarded.
 * Writes go through a temporary file; settings and panel are small and frequent, so only unsaved pictures are
 * backed up when they go.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OWN_FOLDER, OWN_FORMAT, backupFile, ownFolderReadme } from "./backups";
import { sanitizeViews, type SavedView } from "../src/app/snapshotViews";

const ownFile = (project: string, name: string) => join(project, OWN_FOLDER, name);

function readJson(file: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown) {
  const temp = `${file}.saving`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temp, file);
}

export interface OwnSettings { timeOfDay?: boolean }

/** The project's own choices (none set: an empty object). */
export function readOwnSettings(project: string): OwnSettings {
  const meta = readJson(ownFile(project, "cartographer.json"));
  return typeof meta?.timeOfDay === "boolean" ? { timeOfDay: meta.timeOfDay } : {};
}

/** Sets some of the project's own choices (other fields of cartographer.json are kept). */
export function writeOwnSettings(project: string, change: unknown): OwnSettings {
  const patch = change as OwnSettings | null;
  if (!patch || typeof patch !== "object") throw new Error("Settings, please.");
  ownFolderReadme(project);
  const file = ownFile(project, "cartographer.json");
  const meta = readJson(file) ?? { format: OWN_FORMAT, app: "GB Cartographer" };
  if (typeof patch.timeOfDay === "boolean") meta.timeOfDay = patch.timeOfDay;
  writeJson(file, meta);
  return readOwnSettings(project);
}

export interface Panel { hidden: string[]; pinned: string[] }
const keyList = (value: unknown) => Array.isArray(value) ? value.filter((key): key is string => typeof key === "string" && /^[a-z]+\/[^/\\]+$/.test(key)).slice(0, 5000) : [];

/** Which pictures are hidden and pinned; `exists` false when the project has no panel.json yet (nothing kept). */
export function readPanel(project: string): Panel & { exists: boolean } {
  const meta = readJson(ownFile(project, "panel.json"));
  return { exists: Boolean(meta), hidden: keyList(meta?.hidden), pinned: keyList(meta?.pinned) };
}

export function writePanel(project: string, panel: unknown): Panel {
  const { hidden, pinned } = (panel ?? {}) as Partial<Panel>;
  ownFolderReadme(project);
  const clean = { hidden: keyList(hidden), pinned: keyList(pinned) };
  writeJson(ownFile(project, "panel.json"), clean);
  return clean;
}

/** Where a picture's unsaved changes are kept; null for a kind or name that can't be a picture. */
function unsavedFile(project: string, kind: string, file: string): string | null {
  if (!/^[a-z]+$/.test(kind) || !/^[^/\\]+\.png$/i.test(file) || file.startsWith(".")) return null;
  return join(project, OWN_FOLDER, "unsaved", kind, `${file}.json`);
}

/** Every picture with unsaved changes kept in the project: its kind, file and what the page wrote. */
export function listUnsaved(project: string): { kind: string; file: string; mtime: number; data: Record<string, unknown> }[] {
  const root = join(project, OWN_FOLDER, "unsaved");
  if (!existsSync(root)) return [];
  const found: { kind: string; file: string; mtime: number; data: Record<string, unknown> }[] = [];
  for (const kind of readdirSync(root)) {
    const folder = join(root, kind);
    if (!statSync(folder).isDirectory()) continue;
    for (const entry of readdirSync(folder).filter((name) => /\.png\.json$/i.test(name))) {
      const data = readJson(join(folder, entry));
      if (data) found.push({ kind, file: entry.replace(/\.json$/i, ""), mtime: statSync(join(folder, entry)).mtimeMs, data });
    }
  }
  return found;
}

/** Keeps a picture's unsaved changes (the page's own format: format 1, the picture and what it's made of). */
export function writeUnsaved(project: string, kind: string, file: string, data: unknown): void {
  const path = unsavedFile(project, kind, file);
  if (!path) throw new Error("No such picture.");
  if (!data || typeof data !== "object" || (data as { format?: unknown }).format !== 1) throw new Error("Unsaved changes in format 1, please.");
  ownFolderReadme(project);
  mkdirSync(join(path, ".."), { recursive: true });
  writeJson(path, data);
}

/** A picture was renamed: its hidden / pinned keys and its kept unsaved changes follow it. */
export function renameOwn(project: string, kind: string, from: string, to: string): void {
  const panel = readPanel(project);
  const key = (file: string) => `${kind}/${file}`, swap = (keys: string[]) => keys.map((item) => item === key(from) ? key(to) : item);
  if (panel.exists && [...panel.hidden, ...panel.pinned].includes(key(from))) writePanel(project, { hidden: swap(panel.hidden), pinned: swap(panel.pinned) });
  const old = unsavedFile(project, kind, from), next = unsavedFile(project, kind, to);
  if (old && next && existsSync(old)) {
    const data = readJson(old);
    // Only a file that was read moves (a damaged one stays where it is), and a case-only rename (the same file on
    // macOS and Windows) is written in place, never written and then deleted.
    if (!data) return;
    data.name = to;
    if (old.toLowerCase() === next.toLowerCase()) { writeJson(old, data); if (old !== next) renameSync(old, next); return; }
    writeJson(next, data);
    unlinkSync(old);
  }
}

/** The changes were saved or discarded: the file goes to the backups (so a slip can still be undone), then away. */
export function removeUnsaved(project: string, kind: string, file: string, backupDir: string): boolean {
  const path = unsavedFile(project, kind, file);
  if (!path || !existsSync(path)) return false;
  backupFile(backupDir, project, path);
  unlinkSync(path);
  return true;
}

// ---- the wizards' own sources (the author, 2026-10-24: "the duck and house feel too confusing") -----------------------
/**
 * Files the wizards start from, kept in the project so they're there next time on any computer: 3D models for GB
 * Snapshot in Cartographer/models/<model>/ (a .glb on its own, or a .gltf / .obj / .fbx with the .bin, .mtl and
 * textures that come with it) and pictures for Picture to background in Cartographer/pictures/. Added files are
 * copied in, never over another (a taken name gets -2, -3…); a removed one goes to the backups first.
 */
export type SourceKind = "models" | "pictures";
export const SOURCE_KINDS: readonly SourceKind[] = ["models", "pictures"];
/** A model file that can be opened on its own (the folder is named for it); the rest come along with it. */
const MODEL_MAIN = /\.(glb|gltf|fbx|obj|dae|usdz|usda|3mf|stl|ply)$/i;
const MODEL_PART = /\.(glb|gltf|bin|fbx|obj|mtl|dae|usdz|usda|3mf|stl|ply|png|jpe?g|tga)$/i;
const PICTURE_FILE = /\.(png|jpe?g|gif|webp|bmp)$/i;
export const SOURCE_LIMIT = 64 * 1024 * 1024;
export interface SourceEntry { kind: SourceKind; /** What it's called (a model's folder, a picture's file name). */ name: string; /** The folder (models) or file (pictures) under its kind's folder. */ file: string; /** A model's files, the one to open first. */ files: string[]; mtime: number; size: number }

const sourceRoot = (project: string, kind: SourceKind) => join(project, OWN_FOLDER, kind);
/** A file name that can't leave its folder or be a .gbsres (GB Studio reads every such path in a project). */
const safeFileName = (name: string) => name.replace(/[/\\:*?"<>|\u0000-\u001f]/g, "-").replace(/^\.+/, "").trim().slice(0, 120).replace(/\.gbsres$/i, "");
const mainFirst = (files: string[]) => [...files].sort((a, b) => Number(MODEL_MAIN.test(b)) - Number(MODEL_MAIN.test(a)) || a.localeCompare(b));

function sourceEntry(project: string, kind: SourceKind, file: string): SourceEntry | null {
  const path = join(sourceRoot(project, kind), file);
  if (!existsSync(path)) return null;
  const stat = statSync(path);
  if (kind === "pictures") return stat.isFile() && PICTURE_FILE.test(file) ? { kind, name: file, file, files: [file], mtime: stat.mtimeMs, size: stat.size } : null;
  if (!stat.isDirectory()) return null;
  const files = mainFirst(readdirSync(path).filter((entry) => MODEL_PART.test(entry) && statSync(join(path, entry)).isFile()));
  if (!files.length || !MODEL_MAIN.test(files[0])) return null;
  return { kind, name: file, file, files, mtime: Math.max(...files.map((entry) => statSync(join(path, entry)).mtimeMs)), size: files.reduce((sum, entry) => sum + statSync(join(path, entry)).size, 0) };
}

export function listSources(project: string, kind: SourceKind): SourceEntry[] {
  const root = sourceRoot(project, kind);
  if (!existsSync(root)) return [];
  return readdirSync(root).map((entry) => sourceEntry(project, kind, entry)).filter((entry): entry is SourceEntry => Boolean(entry)).sort((a, b) => a.name.localeCompare(b.name));
}

/** The full path of a source's file (a model's `inner` file), only inside its folder and only when it exists. */
export function sourcePath(project: string, kind: SourceKind, file: string, inner?: string): string | null {
  const root = sourceRoot(project, kind), name = safeFileName(file);
  if (!name || name !== file) return null;
  const path = kind === "models" ? (inner && safeFileName(inner) === inner ? join(root, name, inner) : null) : join(root, name);
  return path && existsSync(path) && statSync(path).isFile() ? path : null;
}

/**
 * Copies a file in: a picture under its own name, a model into a folder named for its main file (`into`: one of the
 * model's other files, added to the folder just made). Never over another file. Returns the entry.
 */
export function addSource(project: string, kind: SourceKind, name: string, bytes: Buffer, into?: string): SourceEntry {
  if (!SOURCE_KINDS.includes(kind)) throw new Error("kind must be models or pictures");
  const file = safeFileName(name);
  if (!file || !(kind === "models" ? MODEL_PART : PICTURE_FILE).test(file)) throw new Error(kind === "models" ? `${name}: not a model file (.glb, .gltf with its .bin and textures, .fbx, .obj, .dae, .usdz, .3mf, .stl, .ply)` : `${name}: not a picture (.png, .jpg, .gif, .webp, .bmp)`);
  if (bytes.length > SOURCE_LIMIT) throw new Error(`${name} is bigger than ${SOURCE_LIMIT / 1024 / 1024} MB`);
  ownFolderReadme(project);
  const root = sourceRoot(project, kind);
  const free = (folder: string, base: string, ext: string) => { let candidate = `${base}${ext}`; for (let n = 2; existsSync(join(folder, candidate)); n += 1) candidate = `${base}-${n}${ext}`; return candidate; };
  if (kind === "pictures") {
    mkdirSync(root, { recursive: true });
    const dot = file.lastIndexOf("."), target = free(root, file.slice(0, dot), file.slice(dot));
    writeFileSync(join(root, target), bytes, { flag: "wx" });
    return sourceEntry(project, kind, target)!;
  }
  let folder: string;
  if (into) {
    folder = safeFileName(into);
    if (folder !== into || !existsSync(join(root, folder))) throw new Error(`No model folder ${into} to add to.`);
    if (existsSync(join(root, folder, file))) throw new Error(`${file} is already in ${folder}.`);
  } else {
    if (!MODEL_MAIN.test(file)) throw new Error(`${name}: a model starts with its main file (.glb, .gltf, .fbx, .obj…); its .bin and textures come after.`);
    folder = free(root, file.replace(/\.[^.]+$/, ""), "");
    mkdirSync(join(root, folder), { recursive: true });
  }
  writeFileSync(join(root, folder, file), bytes, { flag: "wx" });
  return sourceEntry(project, kind, folder) ?? { kind, name: folder, file: folder, files: [file], mtime: Date.now(), size: bytes.length };
}

/** Takes a source out: each of its files goes to the backups, then away (a model's folder too). */
export function removeSource(project: string, kind: SourceKind, file: string, backupDir: string): boolean {
  const entry = sourceEntry(project, kind, safeFileName(file) === file ? file : "");
  if (!entry) return false;
  const root = sourceRoot(project, kind);
  for (const inner of kind === "models" ? entry.files : [entry.file]) {
    const path = kind === "models" ? join(root, entry.file, inner) : join(root, inner);
    backupFile(backupDir, project, path);
    unlinkSync(path);
  }
  if (kind === "models") {
    const views = join(root, entry.file, VIEWS_FILE);
    if (existsSync(views)) { backupFile(backupDir, project, views); unlinkSync(views); }
    try { rmdirSync(join(root, entry.file)); } catch { /* something else is in it: it stays */ }
  }
  return true;
}

/**
 * GB Snapshot's saved views of a model (the author, 2026-11-02): Cartographer/models/<model>/views.json beside the
 * model, so all of one model's sprites can be taken from the same angles on any computer. Backed up before each write.
 */
const VIEWS_FILE = "views.json";
function viewsPath(project: string, file: string): string | null {
  if (!file || safeFileName(file) !== file) return null;
  const folder = join(sourceRoot(project, "models"), file);
  return existsSync(folder) && statSync(folder).isDirectory() ? join(folder, VIEWS_FILE) : null;
}
export function readModelViews(project: string, file: string): SavedView[] {
  const path = viewsPath(project, file);
  return path ? sanitizeViews(readJson(path)?.views) : [];
}
export function writeModelViews(project: string, file: string, views: unknown, backupDir: string): SavedView[] {
  const path = viewsPath(project, file);
  if (!path) throw new Error(`No model ${file} in Cartographer/models.`);
  const clean = sanitizeViews(views);
  backupFile(backupDir, project, path);
  writeJson(path, { views: clean });
  return clean;
}

/**
 * The wizards' saved presets (the author, 2026-11-02: "Desert cave", "Snowy overworld"): Cartographer/presets.json,
 * `{ presets: { <wizard>: { <name>: settings } } }`, so a project's presets travel with it. Settings are each
 * wizard's own plain object (src/app/wizardSettings.ts); here only their shape is checked. Backed up before each write.
 */
const PRESETS_FILE = "presets.json";
export type Presets = Record<string, Record<string, Record<string, unknown>>>;
const plainObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const wizardKey = /^[a-z][a-z0-9-]{0,39}$/;
export function sanitizePresets(value: unknown): Presets {
  const clean: Presets = {};
  if (!plainObject(value)) return clean;
  for (const [wizard, named] of Object.entries(value).slice(0, 64)) {
    if (!wizardKey.test(wizard) || !plainObject(named)) continue;
    const kept: Record<string, Record<string, unknown>> = {};
    for (const [name, settings] of Object.entries(named).slice(0, 200)) {
      const trimmed = name.trim();
      if (trimmed && trimmed.length <= 60 && plainObject(settings) && JSON.stringify(settings).length <= 20000) kept[trimmed] = settings;
    }
    if (Object.keys(kept).length) clean[wizard] = kept;
  }
  return clean;
}
export function readPresets(project: string): Presets {
  return sanitizePresets(readJson(ownFile(project, PRESETS_FILE))?.presets);
}
/** Saves (settings) or deletes (null) one wizard's named preset; the others are kept. */
export function writePreset(project: string, wizard: string, name: string, settings: unknown, backupDir: string): Presets {
  const presets = readPresets(project);
  const key = String(name ?? "").trim();
  if (!wizardKey.test(wizard) || !key || key.length > 60) throw new Error("A wizard and a name, please.");
  if (settings !== null && !plainObject(settings)) throw new Error("Settings, please.");
  const named = { ...presets[wizard] };
  if (settings === null) delete named[key]; else named[key] = settings as Record<string, unknown>;
  const next = sanitizePresets({ ...presets, [wizard]: named });
  ownFolderReadme(project);
  const path = ownFile(project, PRESETS_FILE);
  if (existsSync(path)) backupFile(backupDir, project, path);
  writeJson(path, { presets: next });
  return next;
}
