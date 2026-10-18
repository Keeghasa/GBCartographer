import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { KEEP, backupFile, inProjectBackupDir, legacyBackupDir, listBackups, projectBackupDir } from "./backups";

/** Every path under `folder` whose name ends in .gbsres (GB Studio's save reads all of them, folders included). */
function gbsresPaths(folder: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.name.endsWith(".gbsres")) found.push(relative(folder, path));
      if (entry.isDirectory()) walk(path);
    }
  };
  walk(folder);
  return found;
}

describe("backups in the app's data folder", () => {
  it("keeps backups outside the project, never backs up a backup, and leaves no .gbsres-named path in the project", () => {
    const root = mkdtempSync(join(tmpdir(), "gbc-backups-")), project = join(root, "Game"), appData = join(root, "app");
    mkdirSync(join(project, "assets/backgrounds"), { recursive: true });
    const file = join(project, "assets/backgrounds/town.png"), sidecar = `${file}.gbsres`;
    writeFileSync(file, "one");
    writeFileSync(sidecar, "{}");
    const copy = backupFile(appData, project, file)!;
    backupFile(appData, project, sidecar);
    expect(copy.startsWith(join(legacyBackupDir(appData, project), "assets/backgrounds/town.png/"))).toBe(true);
    expect(readFileSync(copy, "utf8")).toBe("one");
    expect(backupFile(appData, project, copy)).toBeNull();
    expect(existsSync(inProjectBackupDir(project))).toBe(false);
    // Only the real sidecar: GB Studio 4.3.2 failed to save ("[checksums]") when a backup folder was named *.gbsres.
    expect(gbsresPaths(project)).toEqual(["assets/backgrounds/town.png.gbsres"]);
  });

  it("moves backups out of <project>/Cartographer/backups once, checked, then takes that folder out of the project", () => {
    const root = mkdtempSync(join(tmpdir(), "gbc-backups-")), project = join(root, "Game"), appData = join(root, "app");
    const old = join(inProjectBackupDir(project), "assets/sprites/hero.png.gbsres");
    mkdirSync(old, { recursive: true });
    // Twelve versions in the project; one has a namesake already in the app's folder with other bytes.
    const ids = Array.from({ length: 12 }, (_, n) => `2026-10-1${n < 9 ? "3" : "4"}T0${n % 10}-00-00-000Z.gbsres`);
    ids.forEach((id, n) => writeFileSync(join(old, id), `version ${n}`));
    const there = join(legacyBackupDir(appData, project), "assets/sprites/hero.png.gbsres");
    mkdirSync(there, { recursive: true });
    writeFileSync(join(there, ids[11]), "a different file");
    const [listed] = listBackups(appData, project, "assets/sprites/hero.png.gbsres");
    expect(listed.versions.length).toBe(KEEP);
    expect(readdirSync(there)).toContain(ids[11].replace(".gbsres", "-2.gbsres"));
    expect(readFileSync(join(there, ids[11]), "utf8")).toBe("a different file");
    expect(existsSync(inProjectBackupDir(project))).toBe(false);
    expect(gbsresPaths(project)).toEqual([]);
    expect(projectBackupDir(appData, project)).toBe(legacyBackupDir(appData, project));
  });
});
