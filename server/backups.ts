/**
 * Backups that keep history. Before GB Cartographer overwrites a project file, the old file is copied to
 *   <project>/Cartographer/backups/<path inside the project>/<time>.<ext>
 * inside the project, so they travel with it to another computer (the author, 2026-10-12; GB Studio 4.3.2 reads only
 * project/, assets/ and plugins/, so it never sees them). The newest KEEP versions of each file are kept.
 * A restore first backs up the file it replaces, so a restore can be undone the same way.
 *
 * Before 2026-10-12 they lived in the app's data folder (`backupDir`), in <backupDir>/<folder name>-<hash of its
 * path>/: the first time a project's backups are touched, those are copied in, checked, and the old folder is renamed
 * "<name>.moved-to-project" (kept, never deleted).
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";

export const KEEP = 10;

/**
 * GB Cartographer's own folder inside a project, for what it needs and GB Studio doesn't (approved by the author
 * 2026-10-10): stamps (Cartographer/stamps/<name>.png, tile palettes in <name>.png.json), the Map Room's layouts
 * (Cartographer/maps.json, server/maps.ts) and the backups (Cartographer/backups). GB Studio reads only its own
 * folders (assets/, project/, plugins/), so it leaves this one alone.
 */
export const OWN_FOLDER = "Cartographer";
/** The format of what's in the folder: cartographer.json says which, so older data is converted once. */
export const OWN_FORMAT = 1;

const OWN_README = "This folder belongs to GB Cartographer (https://github.com/Keeghasa/GBCartographer), not to GB Studio.\nIt keeps what GB Cartographer needs and GB Studio doesn't:\n- stamps/ holds saved stamps (a PNG each, and its tile palettes in a .json beside it);\n- maps.json holds the Map Room's layouts (which background sits where in each map);\n- backups/ holds the last 10 versions of every project file GB Cartographer changed (Backups... in its project menu puts one back);\n- panel.json says which pictures are hidden and pinned in its project panel;\n- unsaved/ holds pictures' changes kept with Save to GB Cartographer only (they open again on any computer);\n- cartographer.json says which version of this folder's format it is, and this project's own choices.\nGB Studio ignores this folder; deleting it loses only these files. Copy it with the project to keep them.\n";

/** Says what the Cartographer folder is, and marks its format (written when GB Cartographer first uses it, kept up to date). */
export function ownFolderReadme(project: string) {
  const readme = join(project, OWN_FOLDER, "README.txt"), marker = join(project, OWN_FOLDER, "cartographer.json");
  mkdirSync(join(project, OWN_FOLDER), { recursive: true });
  if (!existsSync(readme) || readFileSync(readme, "utf8") !== OWN_README) writeFileSync(readme, OWN_README);
  let format = 0;
  try { format = Number((JSON.parse(readFileSync(marker, "utf8")) as { format?: unknown }).format) || 0; } catch { /* none yet */ }
  if (format < OWN_FORMAT) writeFileSync(marker, `${JSON.stringify({ format: OWN_FORMAT, app: "GB Cartographer" }, null, 2)}\n`);
}

export interface BackupVersion { id: string; time: number; size: number }
/** `current`: the project file's modification time when listed (null: gone), so a restore can tell it changed since. */
export interface BackupFile { file: string; versions: BackupVersion[]; current?: number | null }

/** The folder holding one project's backups: <project>/Cartographer/backups (`backupDir`: where older ones may wait). */
export function projectBackupDir(backupDir: string, project: string): string {
  migrateBackups(backupDir, project);
  return join(resolve(project), OWN_FOLDER, "backups");
}

/** Where a project's backups were kept before they moved into it: the app's data folder, keyed by the project's path. */
export function legacyBackupDir(backupDir: string, project: string): string {
  const full = resolve(project);
  const name = basename(full).replace(/[^A-Za-z0-9 _.-]/g, "_").slice(0, 40) || "project";
  return join(backupDir, `${name}-${createHash("sha1").update(full).digest("hex").slice(0, 8)}`);
}

/**
 * Moves a project's old backups (the app's data folder) into the project, once: every version is copied (one already
 * there of the same name and size is left), the copies are checked, each file keeps its newest KEEP, and only then is
 * the old folder renamed "<name>.moved-to-project". If anything fails, the old folder stays as it was.
 */
export function migrateBackups(backupDir: string, project: string): void {
  if (!backupDir) return;
  const old = legacyBackupDir(backupDir, project);
  if (!existsSync(old) || !existsSync(project)) return;
  const target = join(resolve(project), OWN_FOLDER, "backups");
  try {
    // Each old version and where its copy is: under its own name, or "-2", "-3"… when a different file has that name.
    const pairs: [string, string][] = [];
    const walk = (from: string) => {
      for (const entry of readdirSync(from, { withFileTypes: true })) {
        const source = join(from, entry.name);
        if (entry.isDirectory()) { walk(source); continue; }
        let to = join(target, relative(old, source));
        mkdirSync(dirname(to), { recursive: true });
        const ext = extname(to), base = to.slice(0, to.length - ext.length);
        for (let n = 2; existsSync(to) && statSync(to).size !== statSync(source).size; n += 1) to = `${base}-${n}${ext}`;
        if (!existsSync(to)) copyFileSync(source, to);
        pairs.push([source, to]);
      }
    };
    walk(old);
    // Checked before anything is set aside: every old version has its copy, the same size.
    const ok = pairs.every(([source, to]) => existsSync(to) && statSync(to).size === statSync(source).size);
    if (!ok) return;
    const trim = (folder: string) => {
      if (!existsSync(folder)) return;
      for (const extra of versions(folder).slice(KEEP)) rmSync(join(folder, extra.id), { force: true });
      for (const entry of readdirSync(folder, { withFileTypes: true })) if (entry.isDirectory()) trim(join(folder, entry.name));
    };
    trim(target);
    ownFolderReadme(project);
    let aside = `${old}.moved-to-project`;
    for (let n = 2; existsSync(aside); n += 1) aside = `${old}.moved-to-project-${n}`;
    renameSync(old, aside);
  } catch (error) {
    console.error("GB Cartographer could not move a project's backups into it:", error);
  }
}

/** A project file's path inside the project, with forward slashes; null when it is outside the project or is a backup. */
function inside(project: string, path: string): string | null {
  const rel = relative(resolve(project), resolve(path));
  if (!rel || rel.startsWith("..") || resolve(project, rel) !== resolve(path)) return null;
  const parts = rel.split(sep);
  if (parts[0] === OWN_FOLDER && parts[1] === "backups") return null;
  return parts.join("/");
}

/** A version id from a time: sortable and safe as a file name (2026-10-09T23-12-05-123Z). */
function versionId(time: number): string {
  return new Date(time).toISOString().replace(/[:.]/g, "-");
}

function versions(folder: string): BackupVersion[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => /^\d{4}-\d\d-\d\dT[\d-]+Z(-\d+)?(\.[^.]+)?$/.test(name))
    .map((name) => {
      const stat = statSync(join(folder, name));
      const time = Date.parse(name.replace(/^(\d{4}-\d\d-\d\dT\d\d)-(\d\d)-(\d\d)-(\d{3})Z.*$/, "$1:$2:$3.$4Z"));
      return { id: name, time: Number.isFinite(time) ? time : stat.mtimeMs, size: stat.size };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

/**
 * Copies a project file to its backup folder before it is overwritten (nothing to do when it does not exist yet)
 * and drops versions beyond the newest KEEP. Returns the backup's path, or null.
 */
export function backupFile(backupDir: string, project: string, path: string): string | null {
  const rel = inside(project, path);
  if (!rel || !existsSync(path)) return null;
  const folder = join(projectBackupDir(backupDir, project), ...rel.split("/"));
  ownFolderReadme(project);
  mkdirSync(folder, { recursive: true });
  const ext = extname(path);
  let id = `${versionId(Date.now())}${ext}`;
  for (let n = 2; existsSync(join(folder, id)); n += 1) id = `${versionId(Date.now())}-${n}${ext}`;
  const target = join(folder, id);
  copyFileSync(path, target);
  for (const old of versions(folder).slice(KEEP)) rmSync(join(folder, old.id), { force: true });
  return target;
}

/** Every backed-up file of a project (newest version first), or just `file` (a path inside the project). */
export function listBackups(backupDir: string, project: string, file?: string): BackupFile[] {
  const root = projectBackupDir(backupDir, project);
  if (!existsSync(root)) return [];
  const found: BackupFile[] = [];
  const walk = (folder: string) => {
    const entries = readdirSync(folder, { withFileTypes: true });
    const list = versions(folder);
    if (list.length) found.push({ file: relative(root, folder).split(sep).join("/"), versions: list });
    for (const entry of entries) if (entry.isDirectory()) walk(join(folder, entry.name));
  };
  const now = (entry: BackupFile): BackupFile => { const target = resolve(project, ...entry.file.split("/")); return { ...entry, current: inside(project, target) && existsSync(target) ? statSync(target).mtimeMs : null }; };
  if (file) {
    const folder = join(root, ...file.split("/"));
    const list = existsSync(folder) && !file.split("/").includes("..") ? versions(folder) : [];
    return list.length ? [now({ file, versions: list })] : [];
  }
  walk(root);
  return found.sort((a, b) => b.versions[0].time - a.versions[0].time).map(now);
}

/** The file being restored changed on disk after the backups were listed. */
export class RestoreChangedError extends Error { constructor() { super("The file changed on disk since the backups were listed."); } }

/** The path of one backed-up version, or null when there is no such version. */
export function backupPath(backupDir: string, project: string, file: string, version: string): string | null {
  if (file.split("/").includes("..") || !/^[\w.-]+$/.test(version)) return null;
  const path = join(projectBackupDir(backupDir, project), ...file.split("/"), version);
  return existsSync(path) ? path : null;
}

/**
 * Puts a backed-up version back in the project: the current file is backed up first (so the restore can be
 * undone), then replaced through a temporary file. Returns the restored file's new modification time.
 */
export function restoreBackup(backupDir: string, project: string, file: string, version: string, expected: number | null = null, force = false): number {
  const source = backupPath(backupDir, project, file, version);
  const target = resolve(project, ...file.split("/"));
  if (!source || !inside(project, target)) throw new Error("No such backup");
  // Like every other write (2026-10-14): a file changed on disk since the list was read (GB Studio saved it) needs a yes.
  if (!force && expected !== null && existsSync(target) && Math.abs(statSync(target).mtimeMs - expected) > 1) throw new RestoreChangedError();
  // The version is copied out before the current file is backed up: that backup may push the oldest version out.
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.restoring`;
  copyFileSync(source, temp);
  backupFile(backupDir, project, target);
  try {
    renameSync(temp, target);
  } catch (error) {
    // Never copied into the file itself (it could be left half written): the current file stays, the error is said.
    try { unlinkSync(temp); } catch { /* nothing more to do */ }
    throw error;
  }
  return statSync(target).mtimeMs;
}
