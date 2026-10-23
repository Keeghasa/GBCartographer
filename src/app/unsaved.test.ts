import { describe, expect, it } from "vitest";
import type { Doc } from "./model";
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
});
