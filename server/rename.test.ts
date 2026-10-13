import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canRename, renameAsset } from "./assets";
import { renameOwn, writePanel, writeUnsaved } from "./own";

describe("renaming a picture GB Studio hasn't taken in", () => {
  const setup = () => {
    const project = mkdtempSync(join(tmpdir(), "gbc-rename-"));
    for (const folder of ["assets/backgrounds", "Cartographer/stamps"]) mkdirSync(join(project, folder), { recursive: true });
    return project;
  };

  it("renames a new background, and refuses one GB Studio has read (a .gbsres beside it) or a taken name", () => {
    const project = setup(), folder = join(project, "assets/backgrounds");
    writeFileSync(join(folder, "Cave-1.png"), "png");
    expect(renameAsset(project, "backgrounds", join(folder, "Cave-1.png"), "Deep cave")).toEqual({ file: "Deep cave.png" });
    expect(existsSync(join(folder, "Deep cave.png")) && !existsSync(join(folder, "Cave-1.png"))).toBe(true);
    writeFileSync(join(folder, "Town.png"), "png"); writeFileSync(join(folder, "Town.png.gbsres"), "{}");
    expect(canRename("backgrounds", join(folder, "Town.png"))).toBe(false);
    expect(() => renameAsset(project, "backgrounds", join(folder, "Town.png"), "City")).toThrow(/GB Studio/);
    writeFileSync(join(folder, "Hill.png"), "png");
    expect(() => renameAsset(project, "backgrounds", join(folder, "Hill.png"), "Deep cave")).toThrow(/already exists/);
    expect(() => renameAsset(project, "backgrounds", join(folder, "Hill.png"), "../x")).toThrow(/plain name/);
  });

  it("takes a stamp's own .json along, and moves hidden / pinned keys and kept unsaved changes", () => {
    const project = setup(), folder = join(project, "Cartographer/stamps");
    writeFileSync(join(folder, "Rock.png"), "png"); writeFileSync(join(folder, "Rock.png.json"), "{\"slots\":[]}");
    renameAsset(project, "stamps", join(folder, "Rock.png"), "Boulder");
    expect(existsSync(join(folder, "Boulder.png.json")) && !existsSync(join(folder, "Rock.png.json"))).toBe(true);
    writePanel(project, { hidden: ["stamps/Rock.png"], pinned: [] });
    writeUnsaved(project, "stamps", "Rock.png", { format: 1, name: "Rock" });
    renameOwn(project, "stamps", "Rock.png", "Boulder.png");
    expect(JSON.parse(readFileSync(join(project, "Cartographer/panel.json"), "utf8")).hidden).toEqual(["stamps/Boulder.png"]);
    expect(existsSync(join(project, "Cartographer/unsaved/stamps/Boulder.png.json"))).toBe(true);
    expect(existsSync(join(project, "Cartographer/unsaved/stamps/Rock.png.json"))).toBe(false);
  });
});
