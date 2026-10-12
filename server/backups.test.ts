import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KEEP, backupFile, legacyBackupDir, listBackups, projectBackupDir } from "./backups";

describe("backups in the project", () => {
  it("keeps backups in Cartographer/backups, never backs up a backup, and marks the folder", () => {
    const root = mkdtempSync(join(tmpdir(), "gbc-backups-")), project = join(root, "Game"), appData = join(root, "app");
    mkdirSync(join(project, "assets/backgrounds"), { recursive: true });
    const file = join(project, "assets/backgrounds/town.png");
    writeFileSync(file, "one");
    const copy = backupFile(appData, project, file)!;
    expect(copy.startsWith(join(project, "Cartographer/backups/assets/backgrounds/town.png/"))).toBe(true);
    expect(readFileSync(copy, "utf8")).toBe("one");
    expect(backupFile(appData, project, copy)).toBeNull();
    expect(JSON.parse(readFileSync(join(project, "Cartographer/cartographer.json"), "utf8")).format).toBe(1);
    expect(readFileSync(join(project, "Cartographer/README.txt"), "utf8")).toContain("backups/");
  });

  it("moves older backups from the app's folder into the project once, checked, the old folder kept aside", () => {
    const root = mkdtempSync(join(tmpdir(), "gbc-backups-")), project = join(root, "Game"), appData = join(root, "app");
    mkdirSync(project, { recursive: true });
    const old = join(legacyBackupDir(appData, project), "assets/sprites/hero.png");
    mkdirSync(old, { recursive: true });
    // Twelve old versions; one has a namesake already in the project with other bytes.
    const ids = Array.from({ length: 12 }, (_, n) => `2026-10-0${n < 9 ? "1" : "2"}T0${n % 10}-00-00-000Z.png`);
    ids.forEach((id, n) => writeFileSync(join(old, id), `version ${n}`));
    const inProject = join(project, "Cartographer/backups/assets/sprites/hero.png");
    mkdirSync(inProject, { recursive: true });
    writeFileSync(join(inProject, ids[11]), "a different file");
    const [listed] = listBackups(appData, project, "assets/sprites/hero.png");
    expect(listed.versions.length).toBe(KEEP);
    // The clash kept both: the project's own under its name, the old one numbered.
    expect(readdirSync(inProject)).toContain(ids[11].replace(".png", "-2.png"));
    expect(readFileSync(join(inProject, ids[11]), "utf8")).toBe("a different file");
    expect(existsSync(legacyBackupDir(appData, project))).toBe(false);
    expect(readFileSync(join(`${legacyBackupDir(appData, project)}.moved-to-project`, "assets/sprites/hero.png", ids[0]), "utf8")).toBe("version 0");
    expect(projectBackupDir(appData, project)).toBe(join(project, "Cartographer/backups"));
  });
});
