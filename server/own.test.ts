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

describe("the wizards' own sources", () => {
  it("keeps pictures and models in the project, never over another, and takes them out to the backups", async () => {
    const { listSources, addSource, sourcePath, removeSource } = await import("./own");
    const { root, folder } = project();
    expect(listSources(folder, "pictures")).toEqual([]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(addSource(folder, "pictures", "my photo.png", png).file).toBe("my photo.png");
    expect(addSource(folder, "pictures", "my photo.png", png).file).toBe("my photo-2.png");
    expect(() => addSource(folder, "pictures", "notes.txt", png)).toThrow(/not a picture/);
    // Nothing in Cartographer/ may be named .gbsres (GB Studio reads every such path): the tail is dropped.
    expect(addSource(folder, "pictures", "evil.png.gbsres", png).file).toBe("evil.png");
    expect(listSources(folder, "pictures").map((entry) => entry.name)).toEqual(["evil.png", "my photo-2.png", "my photo.png"]);
    expect(sourcePath(folder, "pictures", "my photo.png")).toBe(join(folder, "Cartographer/pictures/my photo.png"));
    expect(sourcePath(folder, "pictures", "../cartographer.json")).toBeNull();
    // A model: its main file names the folder; its parts go in after it.
    const model = addSource(folder, "models", "castle.gltf", Buffer.from("{}"));
    expect(model).toMatchObject({ name: "castle", file: "castle", files: ["castle.gltf"] });
    addSource(folder, "models", "castle.bin", Buffer.from([1, 2, 3]), "castle");
    addSource(folder, "models", "wall.png", png, "castle");
    expect(listSources(folder, "models")[0].files).toEqual(["castle.gltf", "castle.bin", "wall.png"]);
    expect(() => addSource(folder, "models", "castle.bin", png)).toThrow(/main file/);
    expect(() => addSource(folder, "models", "castle.bin", png, "castle")).toThrow(/already/);
    expect(addSource(folder, "models", "castle.glb", png).file).toBe("castle-2");
    expect(sourcePath(folder, "models", "castle", "castle.bin")).toBe(join(folder, "Cartographer/models/castle/castle.bin"));
    expect(sourcePath(folder, "models", "castle")).toBeNull();
    // Out: every file to the backups, the folder gone.
    expect(removeSource(folder, "models", "castle", join(root, "backups"))).toBe(true);
    expect(existsSync(join(folder, "Cartographer/models/castle"))).toBe(false);
    expect(listBackups(join(root, "backups"), folder).map((entry) => entry.file).sort()).toEqual(["Cartographer/models/castle/castle.bin", "Cartographer/models/castle/castle.gltf", "Cartographer/models/castle/wall.png"]);
    expect(removeSource(folder, "pictures", "nope.png", join(root, "backups"))).toBe(false);
  });
});
