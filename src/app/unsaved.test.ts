import { describe, expect, it } from "vitest";
import { plainSprite, type Doc } from "./model";
import { applyUnsaved, fromBase64, toBase64, unsavedOf } from "./unsaved";

const doc = (cells: Uint16Array): Doc => ({ id: 1, name: "x.png", width: 16, height: 8, pixels: new Uint8Array(16 * 8), cells, hasAlpha: false, palettes: [], undo: [], redo: [], dirty: true } as unknown as Doc);

describe("unsaved snapshots", () => {
  it("keep 16-bit tile palettes, so the 300th palette survives a restart", () => {
    const kept = unsavedOf(doc(new Uint16Array([300, 2])));
    expect(kept.cellBytes).toBe(2);
    const target = doc(new Uint16Array(2));
    expect(applyUnsaved(target, kept)).toBe(true);
    expect([...target.cells]).toEqual([300, 2]);
    expect(target.cells).toBeInstanceOf(Uint16Array);
  });

  it("still read a snapshot from before, one byte a cell", () => {
    const old = { ...unsavedOf(doc(new Uint16Array(2))), cells: toBase64(new Uint8Array([7, 1])) } as ReturnType<typeof unsavedOf>;
    delete (old as { cellBytes?: 2 }).cellBytes;
    const target = doc(new Uint16Array(2));
    expect(applyUnsaved(target, old)).toBe(true);
    expect([...target.cells]).toEqual([7, 1]);
    expect(fromBase64(toBase64(new Uint8Array([1, 2, 255])))).toEqual(new Uint8Array([1, 2, 255]));
  });

  it("open a sprite draft painted with palettes in plain greens, while a background keeps its palettes (2026-10-25)", () => {
    const palettes = [{ id: "p", name: "Teal", colors: ["#fff", "#aaa", "#555", "#000"] }];
    const kept = { ...unsavedOf(doc(new Uint16Array([1, 1]))), palettes };
    const sprite = Object.assign(doc(new Uint16Array(2)), { asset: { kind: "sprites", file: "E-Scorpo.png", name: "E-Scorpo", mtime: 0, slots: ["a"], opened: [1, 1] } }) as Doc;
    expect(applyUnsaved(sprite, kept)).toBe(true);
    plainSprite(sprite);
    expect([...sprite.cells]).toEqual([0, 0]);
    expect(sprite.palettes).toEqual([]);
    expect(sprite.asset?.slots).toBeUndefined();
    const background = Object.assign(doc(new Uint16Array(2)), { asset: { kind: "backgrounds", file: "farm.png", name: "farm", mtime: 0 } }) as Doc;
    expect(applyUnsaved(background, kept)).toBe(true);
    plainSprite(background);
    expect([...background.cells]).toEqual([1, 1]);
    expect(background.palettes).toHaveLength(1);
  });
});
