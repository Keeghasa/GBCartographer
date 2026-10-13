import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listBackups } from "./backups";
import { listUnsaved, readOwnSettings, readPanel, removeUnsaved, writeOwnSettings, writePanel, writeUnsaved } from "./own";

const project = () => { const root = mkdtempSync(join(tmpdir(), "gbc-own-")), folder = join(root, "Game"); mkdirSync(folder); return { root, folder }; };

describe("what travels with a project", () => {
  it("keeps the Time-of-day switch in cartographer.json beside its format", () => {
    const { folder } = project();
    expect(readOwnSettings(folder)).toEqual({});
    expect(writeOwnSettings(folder, { timeOfDay: true })).toEqual({ timeOfDay: true });
    const meta = JSON.parse(readFileSync(join(folder, "Cartographer/cartographer.json"), "utf8"));
    expect([meta.format, meta.timeOfDay]).toEqual([1, true]);
    expect(writeOwnSettings(folder, { timeOfDay: false, junk: 3 })).toEqual({ timeOfDay: false });
  });

  it("keeps hidden and pinned pictures in panel.json, only plain kind/file keys", () => {
    const { folder } = project();
    expect(readPanel(folder)).toEqual({ exists: false, hidden: [], pinned: [] });
    writePanel(folder, { hidden: ["backgrounds/town.png", "../evil", 4], pinned: ["stamps/Tree.png"] });
    expect(readPanel(folder)).toEqual({ exists: true, hidden: ["backgrounds/town.png"], pinned: ["stamps/Tree.png"] });
  });

  it("keeps a picture's unsaved changes, lists them, and moves them to the backups when they go", () => {
    const { root, folder } = project();
    const data = { format: 1, width: 8, height: 8, pixels: "AAAA" };
    writeUnsaved(folder, "backgrounds", "town.png", data);
    expect(listUnsaved(folder).map(({ kind, file, data: kept }) => [kind, file, kept])).toEqual([["backgrounds", "town.png", data]]);
    expect(() => writeUnsaved(folder, "backgrounds", "../town.png", data)).toThrow();
    expect(() => writeUnsaved(folder, "backgrounds", "town.png", { format: 2 })).toThrow();
    expect(removeUnsaved(folder, "backgrounds", "town.png", join(root, "app"))).toBe(true);
    expect(existsSync(join(folder, "Cartographer/unsaved/backgrounds/town.png.json"))).toBe(false);
    expect(listBackups(join(root, "app"), folder, "Cartographer/unsaved/backgrounds/town.png.json")[0].versions.length).toBe(1);
    expect(removeUnsaved(folder, "backgrounds", "town.png", join(root, "app"))).toBe(false);
  });
});
