/**
 * Reads Aseprite's own files (.aseprite / .ase; the format Aseprite documents in its repository, docs/ase-file-specs.md)
 * into RGBA pixels, so they open like a PNG (L17, the author's test file 2026-10-12). Every visible layer is drawn in
 * order with its opacity (blend modes other than Normal are drawn as Normal, and said so); several frames are laid
 * side by side, left to right, as GB Studio's sprite sheets lay their frames. RGBA, greyscale and indexed files;
 * raw, compressed and linked cels. Tilemap layers aren't read (said so). Nothing is ever written back to the file.
 */
export interface AsepriteImage {
  /** The whole picture: every frame side by side. */
  width: number; height: number; rgba: Uint8ClampedArray;
  frames: number; frameWidth: number;
  /** Things drawn differently from Aseprite, in words. */
  notes: string[];
}

/** zlib's inflate (the browser's DecompressionStream("deflate"), or Node's inflateSync in tests). */
export type Inflate = (data: Uint8Array) => Promise<Uint8Array> | Uint8Array;

interface Layer { visible: boolean; opacity: number; type: number; blend: number; background: boolean }
interface Cel { layer: number; x: number; y: number; opacity: number; z: number; w: number; h: number; pixels: Uint8Array }

export const isAseprite = (name: string) => /\.(aseprite|ase)$/i.test(name);

export async function readAseprite(bytes: Uint8Array, inflate: Inflate): Promise<AsepriteImage> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 128 || view.getUint16(4, true) !== 0xa5e0) throw new Error("Not an Aseprite file");
  const frames = view.getUint16(6, true), width = view.getUint16(8, true), height = view.getUint16(10, true);
  const depth = view.getUint16(12, true), flags = view.getUint32(14, true), transparent = view.getUint8(28);
  if (depth !== 32 && depth !== 16 && depth !== 8) throw new Error(`Unknown color depth ${depth}`);
  if (!frames || !width || !height) throw new Error("An empty Aseprite file");
  const layerOpacityValid = (flags & 1) !== 0;
  const bpp = depth / 8;
  const layers: Layer[] = [];
  // Groups: a layer shows only when every group above it does.
  const groupVisible: boolean[] = [];
  let palette: [number, number, number, number][] = [];
  const notes = new Set<string>();
  const cels: Cel[][] = [];
  let at = 128;
  for (let frame = 0; frame < frames; frame += 1) {
    const frameSize = view.getUint32(at, true);
    if (view.getUint16(at + 4, true) !== 0xf1fa) throw new Error(`Frame ${frame + 1} is damaged`);
    const chunks = view.getUint32(at + 12, true) || view.getUint16(at + 6, true);
    const here: Cel[] = [];
    let chunk = at + 16;
    for (let n = 0; n < chunks; n += 1) {
      const size = view.getUint32(chunk, true), type = view.getUint16(chunk + 4, true), body = chunk + 6;
      if (type === 0x2004) {
        const layerFlags = view.getUint16(body, true), layerType = view.getUint16(body + 2, true), level = view.getUint16(body + 4, true);
        const blend = view.getUint16(body + 10, true), opacity = layerOpacityValid ? view.getUint8(body + 12) : 255;
        const visible = (layerFlags & 1) !== 0 && (level === 0 || groupVisible[level - 1] !== false);
        groupVisible[level] = visible;
        groupVisible.length = level + 1;
        layers.push({ visible, opacity, type: layerType, blend, background: (layerFlags & 2) !== 0 });
        if (layerType === 2 && visible) notes.add("tilemap layers aren't read");
        if (blend !== 0 && visible) notes.add("blend modes are drawn as Normal");
      } else if (type === 0x2019) {
        const first = view.getUint32(body + 4, true), last = view.getUint32(body + 8, true);
        let entry = body + 20;
        for (let index = first; index <= last; index += 1) {
          const entryFlags = view.getUint16(entry, true);
          palette[index] = [view.getUint8(entry + 2), view.getUint8(entry + 3), view.getUint8(entry + 4), view.getUint8(entry + 5)];
          entry += 6;
          if (entryFlags & 1) entry += 2 + view.getUint16(entry, true);
        }
      } else if (type === 0x0004 && !palette.length) {
        // The old palette chunk (files from before Aseprite 1.2 carry only this one).
        const packets = view.getUint16(body, true);
        let entry = body + 2, index = 0;
        const old: [number, number, number, number][] = [];
        for (let packet = 0; packet < packets; packet += 1) {
          index += view.getUint8(entry);
          const count = view.getUint8(entry + 1) || 256;
          entry += 2;
          for (let c = 0; c < count; c += 1, index += 1, entry += 3) old[index] = [view.getUint8(entry), view.getUint8(entry + 1), view.getUint8(entry + 2), 255];
        }
        palette = old;
      } else if (type === 0x2005) {
        const layer = view.getUint16(body, true), x = view.getInt16(body + 2, true), y = view.getInt16(body + 4, true);
        const opacity = view.getUint8(body + 6), celType = view.getUint16(body + 7, true), z = view.getInt16(body + 9, true);
        const data = body + 16;
        if (celType === 0 || celType === 2) {
          const w = view.getUint16(data, true), h = view.getUint16(data + 2, true);
          const raw = bytes.subarray(data + 4, chunk + size);
          const pixels = celType === 0 ? raw.slice(0, w * h * bpp) : await inflate(raw);
          if (pixels.length < w * h * bpp) throw new Error(`A cel in frame ${frame + 1} is damaged`);
          here.push({ layer, x, y, opacity, z, w, h, pixels });
        } else if (celType === 1) {
          // Linked: the same cel as an earlier frame's, at this cel's opacity and z.
          const from = cels[view.getUint16(data, true)]?.find((cel) => cel.layer === layer);
          if (from) here.push({ ...from, opacity, z });
        } else if (celType === 3) notes.add("tilemap layers aren't read");
      }
      chunk += size;
    }
    cels.push(here);
    at += frameSize;
  }

  const rgba = new Uint8ClampedArray(width * frames * height * 4);
  const stride = width * frames;
  for (let frame = 0; frame < frames; frame += 1) {
    // Aseprite's order: by layer, a cel's z-index moving it among the layers.
    const order = cels[frame].filter((cel) => layers[cel.layer]?.visible && layers[cel.layer].type !== 2).sort((a, b) => (a.layer + a.z) - (b.layer + b.z) || a.z - b.z);
    for (const cel of order) {
      const layer = layers[cel.layer];
      const alpha = (cel.opacity / 255) * (layer.opacity / 255);
      for (let cy = 0; cy < cel.h; cy += 1) {
        const py = cel.y + cy;
        if (py < 0 || py >= height) continue;
        for (let cx = 0; cx < cel.w; cx += 1) {
          const px = cel.x + cx;
          if (px < 0 || px >= width) continue;
          const source = (cy * cel.w + cx) * bpp;
          let r: number, g: number, b: number, a: number;
          if (depth === 32) [r, g, b, a] = [cel.pixels[source], cel.pixels[source + 1], cel.pixels[source + 2], cel.pixels[source + 3]];
          else if (depth === 16) [r, g, b, a] = [cel.pixels[source], cel.pixels[source], cel.pixels[source], cel.pixels[source + 1]];
          else {
            const index = cel.pixels[source];
            if (index === transparent && !layer.background) continue;
            [r, g, b, a] = palette[index] ?? [0, 0, 0, 255];
          }
          const over = (a / 255) * alpha;
          if (over <= 0) continue;
          const target = (py * stride + frame * width + px) * 4;
          const under = rgba[target + 3] / 255, out = over + under * (1 - over);
          rgba[target] = (r * over + rgba[target] * under * (1 - over)) / out;
          rgba[target + 1] = (g * over + rgba[target + 1] * under * (1 - over)) / out;
          rgba[target + 2] = (b * over + rgba[target + 2] * under * (1 - over)) / out;
          rgba[target + 3] = out * 255;
        }
      }
    }
  }
  if (frames > 1) notes.add(`its ${frames} frames are side by side, left to right`);
  return { width: stride, height, rgba, frames, frameWidth: width, notes: [...notes] };
}

/** The browser's inflate for readAseprite. */
export async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
