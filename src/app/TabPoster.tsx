/**
 * A tab's poster (the author's pick, 2026-10-18: "B1 · Poster tabs with palette strip"): the picture fills the tab,
 * drawn in its palettes (a sprite sheet shows its first frame), and a strip under the name shows the palettes its
 * tiles wear. The thumbnail is redrawn a moment after the picture changes, so painting never waits on it.
 */
import { useEffect, useState } from "react";
import { GB_SHADES, toRgba } from "../paint";
import type { Doc } from "./model";

const THUMB_W = 300, THUMB_H = 144;

/** Changes whenever the picture, its size or its palettes do (each stroke adds an undo step). */
const versionOf = (doc: Doc) => `${doc.undo.length}|${doc.redo.length}|${doc.width}x${doc.height}|${doc.palettes.map((palette) => palette.colors.join("")).join(",")}`;

function drawThumb(doc: Doc): string {
  // A sprite sheet: its first frame (a square as tall as the sheet).
  const sprite = doc.asset?.kind === "sprites" || doc.asset?.kind === "emotes";
  const sw = sprite ? Math.min(doc.width, doc.height) : doc.width, sh = doc.height;
  const full = Object.assign(document.createElement("canvas"), { width: doc.width, height: doc.height });
  full.getContext("2d")!.putImageData(new ImageData(toRgba(doc.pixels, doc.cells, doc.width, doc.palettes), doc.width, doc.height), 0, 0);
  // A picture fills the tab (cropped like CSS cover); a sprite's frame fits whole, in whole pixels, on the tab's dark.
  // The frame sits above the name band (its top 62 %), so the band never covers it.
  const room = sprite ? THUMB_H * 0.62 : THUMB_H;
  const scale = sprite ? Math.max(1, Math.floor(Math.min(THUMB_W / sw, room / sh))) : Math.max(THUMB_W / sw, THUMB_H / sh);
  const out = Object.assign(document.createElement("canvas"), { width: THUMB_W, height: THUMB_H });
  const context = out.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  const w = sw * scale, h = sh * scale;
  context.drawImage(full, 0, 0, sw, sh, (THUMB_W - w) / 2, (room - h) / 2 + (sprite ? 6 : 0), w, h);
  return out.toDataURL();
}

/** The palettes the picture's tiles wear (1-based slots into `palettes`; none: the GB greens), at most eight. */
function wornPalettes(doc: Doc): readonly (readonly string[])[] {
  const used = new Set<number>();
  for (const cell of doc.cells) if (cell > 0 && doc.palettes[cell - 1]) used.add(cell);
  return used.size ? [...used].sort((a, b) => a - b).slice(0, 8).map((at) => doc.palettes[at - 1].colors) : [GB_SHADES];
}

export function TabPoster({ doc }: { doc: Doc }) {
  const version = versionOf(doc);
  const [thumb, setThumb] = useState<{ version: string; url: string } | null>(null);
  useEffect(() => {
    if (thumb?.version === version) return;
    // The first one right away; later ones once painting pauses.
    const timer = setTimeout(() => setThumb({ version, url: drawThumb(doc) }), thumb ? 400 : 0);
    return () => clearTimeout(timer);
  }, [version]);
  const palettes = wornPalettes(doc);
  return (
    <>
      {thumb && <img className="app-tab-poster" src={thumb.url} alt="" draggable={false} />}
      <span className="app-tab-strip" aria-hidden>{palettes.map((colors, at) => <span key={at}>{colors.map((color, k) => <i key={k} style={{ background: color }} />)}</span>)}</span>
    </>
  );
}
