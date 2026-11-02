import { describe, expect, it } from "vitest";
import { FRAME_SIZE, STYLE_SHADES, drawFrame, frameFileName, sliceFrame, type FrameStyle } from "./uiFrame";

const at = (frame: { pixels: Uint8Array }, x: number, y: number) => frame.pixels[y * FRAME_SIZE + x];

describe("UI frame wizard", () => {
  it("makes GB Studio's 24 × 24 frame in every style, its middle the fill and its edge the border", () => {
    for (const style of ["thin", "double", "rounded", "thick", "dark"] as FrameStyle[]) {
      const frame = drawFrame({ style, corners: "drawn", border: 2, fill: 1 });
      expect([frame.width, frame.height]).toEqual([24, 24]);
      expect(at(frame, 12, 12)).toBe(1);
      expect([at(frame, 12, 0), at(frame, 12, 1)]).toContain(2);
      expect([...frame.pixels].every((shade) => shade < 4)).toBe(true);
    }
  });
  it("keeps a style's own look at its own shades", () => {
    const thin = drawFrame({ style: "thin", corners: "drawn", ...STYLE_SHADES.thin });
    expect(at(thin, 0, 0)).toBe(3);
    expect(at(thin, 5, 5)).toBe(0);
  });
  it("redraws the corners, mirrored and matching the edges", () => {
    const square = drawFrame({ style: "rounded", corners: "square", border: 3, fill: 0 });
    expect(at(square, 0, 0)).toBe(3);
    const round = drawFrame({ style: "thin", corners: "rounded", border: 3, fill: 0 });
    expect(at(round, 0, 0)).toBe(0);
    const cut = drawFrame({ style: "thin", corners: "cut", border: 3, fill: 0 });
    expect(at(cut, 0, 0)).toBe(0);
    expect(at(cut, 2, 0)).toBe(3);
    for (const frame of [square, round, cut]) for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
      expect(at(frame, 23 - x, y)).toBe(at(frame, x, y));
      expect(at(frame, x, 23 - y)).toBe(at(frame, x, y));
    }
  });
  it("nine-slices to a dialogue box", () => {
    const frame = drawFrame({ style: "double", corners: "drawn", border: 3, fill: 0 });
    const box = sliceFrame(frame, 20, 6);
    expect([box.width, box.height]).toEqual([160, 48]);
    expect(box.pixels[0]).toBe(at(frame, 0, 0));
    expect(box.pixels[47 * 160 + 159]).toBe(at(frame, 23, 23));
    expect(box.pixels[20 * 160 + 80]).toBe(at(frame, 12, 12));
  });
  it("never names a file that's there", () => {
    expect(frameFileName("thin", ["cursor.png"])).toBe("frame");
    expect(frameFileName("thin", ["frame.png", "frame-thin.png"])).toBe("frame-thin-2");
  });
});
