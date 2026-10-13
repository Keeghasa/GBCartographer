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
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OWN_FOLDER, OWN_FORMAT, backupFile, ownFolderReadme } from "./backups";

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

/** The changes were saved or discarded: the file goes to the backups (so a slip can still be undone), then away. */
export function removeUnsaved(project: string, kind: string, file: string, backupDir: string): boolean {
  const path = unsavedFile(project, kind, file);
  if (!path || !existsSync(path)) return false;
  backupFile(backupDir, project, path);
  unlinkSync(path);
  return true;
}
