import { deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { isAseprite, readAseprite } from "./aseprite";

/** A little Aseprite writer, to the file spec, for the tests. */
function aseprite({ width, height, depth, layers, frames, palette = [], transparent = 0 }: {
  width: number; height: number; depth: 32 | 8;
  layers: { name: string; visible?: boolean; opacity?: number }[];
  /** Per frame, its cels: pixels (RGBA or indices, w × h) at x, y on a layer; or `link` to that frame's cel. */
  frames: { layer: number; x?: number; y?: number; w?: number; h?: number; pixels?: number[]; link?: number; raw?: boolean }[][];
  palette?: [number, number, number, number][]; transparent?: number;
}): Uint8Array {
  const chunk = (type: number, body: number[]) => { const size = 6 + body.length; return [...u32(size), ...u16(type), ...body]; };
  const u16 = (n: number) => [n & 255, (n >> 8) & 255];
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  const out: number[] = [];
  frames.forEach((cels, index) => {
    const chunks: number[][] = [];
    if (index === 0) {
      if (palette.length) chunks.push(chunk(0x2019, [...u32(palette.length), ...u32(0), ...u32(palette.length - 1), ...new Array(8).fill(0), ...palette.flatMap((rgba) => [...u16(0), ...rgba])]));
      for (const layer of layers) chunks.push(chunk(0x2004, [...u16(layer.visible === false ? 0 : 1), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), layer.opacity ?? 255, 0, 0, 0, ...u16(layer.name.length), ...[...layer.name].map((c) => c.charCodeAt(0))]));
    }
    for (const cel of cels) {
      const head = [...u16(cel.layer), ...u16(cel.x ?? 0), ...u16(cel.y ?? 0), 255];
      if (cel.link !== undefined) { chunks.push(chunk(0x2005, [...head, ...u16(1), ...u16(0), 0, 0, 0, 0, 0, ...u16(cel.link)])); continue; }
      const data = Uint8Array.from(cel.pixels!);
      chunks.push(chunk(0x2005, [...head, ...u16(cel.raw ? 0 : 2), ...u16(0), 0, 0, 0, 0, 0, ...u16(cel.w!), ...u16(cel.h!), ...(cel.raw ? data : deflateSync(data))]));
    }
    const body = chunks.flat();
    out.push(...u32(16 + body.length), ...u16(0xf1fa), ...u16(chunks.length), ...u16(100), 0, 0, ...u32(chunks.length), ...body);
  });
  const header = [...u32(128 + out.length), ...u16(0xa5e0), ...u16(frames.length), ...u16(width), ...u16(height), ...u16(depth), ...u32(1), ...u16(100), ...u32(0), ...u32(0), transparent, 0, 0, 0, ...u16(palette.length), 1, 1];
  return Uint8Array.from([...header, ...new Array(128 - header.length).fill(0), ...out]);
}

const inflate = (data: Uint8Array) => new Uint8Array(inflateSync(data));
const px = (image: { rgba: Uint8ClampedArray; width: number }, x: number, y: number) => [...image.rgba.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];

describe("Aseprite files", () => {
  it("draws visible layers in order with their opacity, frames side by side, linked cels too", async () => {
    const red = [255, 0, 0, 255], blue = [0, 0, 255, 255], clear = [0, 0, 0, 0];
    const file = aseprite({ width: 4, height: 2, depth: 32,
      layers: [{ name: "Back" }, { name: "Hidden", visible: false }, { name: "Front", opacity: 128 }],
      frames: [
        [{ layer: 0, w: 4, h: 2, pixels: new Array(8).fill(red).flat() }, { layer: 1, w: 4, h: 2, pixels: new Array(8).fill(blue).flat() }, { layer: 2, x: 1, y: 1, w: 1, h: 1, pixels: blue, raw: true }],
        [{ layer: 0, link: 0 }, { layer: 2, x: 3, y: 0, w: 1, h: 1, pixels: blue }],
      ] });
    const image = await readAseprite(file, inflate);
    expect([image.width, image.height, image.frames, image.frameWidth]).toEqual([8, 2, 2, 4]);
    expect(px(image, 0, 0)).toEqual(red);
    // Half-see-through blue over red.
    const mixed = px(image, 1, 1);
    expect(mixed[0]).toBeGreaterThan(120); expect(mixed[0]).toBeLessThan(135); expect(mixed[2]).toBeGreaterThan(120); expect(mixed[3]).toBe(255);
    // The hidden layer isn't drawn; frame 2 links frame 1's red and adds its own blue.
    expect(px(image, 2, 0)).toEqual(red);
    expect(px(image, 4, 0)).toEqual(red);
    expect(px(image, 7, 0)[2]).toBeGreaterThan(120);
    expect(image.notes).toEqual(["its 2 frames are side by side, left to right"]);
    expect(px(await readAseprite(aseprite({ width: 2, height: 1, depth: 32, layers: [{ name: "A" }], frames: [[]] }), inflate), 0, 0)).toEqual(clear);
  });

  it("reads indexed files through their palette, the transparent index see-through", async () => {
    const file = aseprite({ width: 3, height: 1, depth: 8, layers: [{ name: "Layer 1" }], palette: [[0, 0, 0, 0], [224, 248, 207, 255], [7, 24, 33, 255]], transparent: 0,
      frames: [[{ layer: 0, w: 3, h: 1, pixels: [0, 1, 2] }]] });
    const image = await readAseprite(file, inflate);
    expect([px(image, 0, 0)[3], px(image, 1, 0), px(image, 2, 0)]).toEqual([0, [224, 248, 207, 255], [7, 24, 33, 255]]);
  });

  it("knows its file names and refuses other files", async () => {
    expect([isAseprite("a.aseprite"), isAseprite("B.ASE"), isAseprite("c.png")]).toEqual([true, true, false]);
    await expect(readAseprite(new Uint8Array(200), inflate)).rejects.toThrow("Not an Aseprite file");
  });
});
