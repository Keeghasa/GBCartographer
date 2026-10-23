import { describe, expect, it } from "vitest";
import type { Palette } from "../paint";
import { editedPalettes, followProject, restorePalettes } from "./paletteSync";

const OLD = ["#000000", "#FF0001", "#FF0000", "#F7F7F7"], NEW = ["#000000", "#FF0001", "#FF0000", "#F4C88A"];
const project = [{ id: "p3", name: "Part3", colors: NEW }, { id: "p2", name: "Part2", colors: OLD }];
const copy = (id: string, name: string, colors: string[], edited?: boolean): Palette => ({ id, name, colors: [...colors], ...(edited ? { edited } : {}) });

describe("palette copies and the project", () => {
  it("a stale copy is not an edit: it is never written back", () => {
    // The scene's copy still has the colors from before the Palettes window saved F4C88A.
    const doc = { palettes: [copy("p3", "Part3", OLD), copy("p2", "Part2", OLD)] };
    expect(editedPalettes([doc], project)).toEqual([]);
  });

  it("a recolor made here is written, once, the active picture first", () => {
    const a = { palettes: [copy("p2", "Part2", NEW, true)] }, b = { palettes: [copy("p2", "Part2", ["#111111", "#222222", "#333333", "#444444"], true)] };
    expect(editedPalettes([a, b], project, b)).toEqual([{ id: "p2", name: "Part2", colors: b.palettes[0].colors }]);
    expect(editedPalettes([a, b], project, a)).toEqual([{ id: "p2", name: "Part2", colors: NEW }]);
  });

  it("colors compare without regard to case", () => {
    const doc = { palettes: [copy("p3", "Part3", NEW.map((color) => color.toLowerCase()), true)] };
    expect(editedPalettes([doc], project)).toEqual([]);
  });

  it("copies the user didn't touch follow the project when it is reread", () => {
    const doc = { palettes: [copy("p3", "Part2 copy", OLD), copy("p2", "Part2", NEW, true)] };
    expect(followProject([doc], project)).toBe(1);
    expect(doc.palettes[0]).toEqual({ id: "p3", name: "Part3", colors: NEW });
    // The edited one keeps its own colors.
    expect(doc.palettes[1].colors).toEqual(NEW);
    expect(doc.palettes[1].edited).toBe(true);
  });

  it("an edited copy that the project now matches stops being an edit", () => {
    const doc = { palettes: [copy("p3", "Part3", NEW, true)] };
    followProject([doc], project);
    expect(doc.palettes[0].edited).toBeUndefined();
  });

  it("undo restores palettes by id, not by position, and marks a restored difference as an edit", () => {
    const doc = { palettes: [copy("p2", "Part2", OLD), copy("p3", "Part3", NEW)] };
    // A snapshot from when the list was in the other order and Part3 had its old colors.
    restorePalettes(doc, [copy("p3", "Part3", OLD), copy("p2", "Part2", OLD)], project);
    expect(doc.palettes[1]).toEqual({ id: "p3", name: "Part3", colors: OLD, edited: true });
    expect(doc.palettes[0].edited).toBeUndefined();
  });

  it("a snapshot that predates a palette leaves the newer one alone", () => {
    const doc = { palettes: [copy("p2", "Part2", OLD), copy("p3", "Part3", NEW)] };
    restorePalettes(doc, [copy("p2", "Part2", OLD)], project);
    expect(doc.palettes[1].colors).toEqual(NEW);
  });
});
