/**
 * The UI frame wizard (the author, 2026-11-02): a window frame for GB Studio's ui folder in your own style. A style
 * from the catalog's Frame pieces, its corners, border and fill shades, shown at dialogue-box size on a Game Boy screen
 * with a line of text in the project's font (as the Dialogue box preview draws it). Made as a NEW PNG in assets/ui
 * (frame.png when the project has none, else frame-<style>…, never replacing a file), or opened as a picture.
 * GB Studio reads only ui/frame.png: a frame under another name is swapped in by hand.
 */
import { PanelsTopLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GB_SHADES, hexRgb } from "../paint";
import { Button, Chip, Field, Segmented, Select } from "../ui/kit";
import { CLEAR_PIXEL, encodeText, fetchFontMap, glyphOf, readFont, type GbFont } from "../gb/font";
import { FRAME_CORNERS, FRAME_STYLES, STYLE_SHADES, drawFrame, frameFileName, sliceFrame, type FrameSettings, type FrameStyle } from "./uiFrame";
import { WizardPage } from "./WizardPage";
import "./FrameWizard.css";

interface Settings { colorMode: string; uiPalette: string[] | null; defaultFont: string | null; fonts: { file: string; name: string }[] }

const SHADES = [{ value: "0", label: "Light" }, { value: "1", label: "Mid" }, { value: "2", label: "Dark" }, { value: "3", label: "Darkest" }];
const NO_FONT = "none";

export function FrameWizard({ projectName, uiFiles, onClose, onCreate }: {
  /** The open project's name (null: only Open as picture). */
  projectName: string | null;
  /** The files in the project's ui folder (a new frame's name is never one of them). */
  uiFiles: string[];
  onClose: () => void;
  /** A new picture: kind "ui" writes a new PNG into the project, null opens it here. */
  onCreate: (picture: { kind: "ui" | null; name: string; width: number; height: number; pixels: Uint8Array }) => Promise<boolean>;
}) {
  const [frame, setFrame] = useState<FrameSettings>({ style: "rounded", corners: "drawn", ...STYLE_SHADES.rounded });
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("Hello! It's cold out here. Come inside?");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [font, setFont] = useState("");
  const [sheet, setSheet] = useState<GbFont | null>(null);
  useEffect(() => {
    if (!projectName) return;
    void fetch("./__cartographer/dialogue-settings", { cache: "no-cache" }).then((response) => response.json() as Promise<Settings>).then((result) => { setSettings(result); setFont(result.defaultFont ?? ""); }).catch(() => undefined);
  }, [projectName]);
  useEffect(() => {
    let live = true;
    if (!font) { setSheet(null); return; }
    const image = new Image();
    image.onload = () => void (async () => {
      const scratch = document.createElement("canvas");
      Object.assign(scratch, { width: image.naturalWidth, height: image.naturalHeight });
      const context = scratch.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, scratch.width, scratch.height);
      const map = await fetchFontMap(font).catch(() => null);
      if (live) setSheet(readFont(data.data, data.width, data.height, map));
    })();
    image.src = `./__cartographer/gbstudio-asset?${new URLSearchParams({ kind: "fonts", file: font })}`;
    return () => { live = false; };
  }, [font]);

  const drawn = useMemo(() => drawFrame(frame), [frame]);
  const palette = (settings?.uiPalette ?? [...GB_SHADES]).map(hexRgb);
  const fileName = frameFileName(frame.style, uiFiles);
  const set = (change: Partial<FrameSettings>) => setFrame((old) => ({ ...old, ...change }));

  // The screen: a plain scene, the box at the bottom (20 × 6 tiles: four lines), the text inside.
  const [screen, setScreen] = useState<HTMLCanvasElement | null>(null);
  const [tile, setTile] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!screen) return;
    Object.assign(screen, { width: 160, height: 144 });
    const out = new ImageData(160, 144);
    const put = (x: number, y: number, shade: number) => { const [r, g, b] = palette[shade]; out.data.set([r, g, b, 255], (y * 160 + x) * 4); };
    for (let y = 0; y < 144; y += 1) for (let x = 0; x < 160; x += 1) put(x, y, y < 72 ? ((x >> 3) + (y >> 3)) % 2 : 1);
    const box = sliceFrame(drawn, 20, 6), top = 144 - box.height;
    for (let y = 0; y < box.height; y += 1) for (let x = 0; x < box.width; x += 1) put(x, top + y, box.pixels[y * box.width + x]);
    // Text: the project's font as GB Studio reads it (src/gb/font.ts), else the catalog pen's small letters stand in.
    const words = text.split(/\s+/).filter(Boolean), lines: string[] = [];
    if (sheet) {
      const width = (word: string) => encodeText(sheet, word).reduce((sum, code) => sum + (glyphOf(sheet, code)?.width ?? 0), 0);
      let line = "";
      for (const word of words) { const next = line ? `${line} ${word}` : word; if (line && width(next) > 144) { lines.push(line); line = word; } else line = next; }
      if (line) lines.push(line);
      lines.slice(0, 4).forEach((line, row) => {
        let pen = 8;
        for (const code of encodeText(sheet, line)) {
          const glyph = glyphOf(sheet, code);
          if (!glyph) continue;
          if (pen + glyph.width > 152) break;
          for (let y = 0; y < 8; y += 1) for (let x = 0; x < glyph.width; x += 1) {
            const shade = sheet.shades[(glyph.sy + y) * sheet.width + glyph.sx + x];
            if (shade !== CLEAR_PIXEL && shade > 0) put(pen + x, top + 8 + row * 8 + y, shade === 3 ? (frame.fill === 3 ? 0 : 3) : shade);
          }
          pen += glyph.width;
        }
      });
    } else {
      // No font: bars where the lines would be, in the shade furthest from the fill.
      const ink = frame.fill >= 2 ? 0 : 3;
      for (let row = 0; row < 3; row += 1) for (let y = 2; y < 5; y += 1) for (let x = 8; x < [136, 112, 72][row]; x += 1) put(x, top + 8 + row * 8 + y, ink);
    }
    screen.getContext("2d")!.putImageData(out, 0, 0);
  });
  useEffect(() => {
    if (!tile) return;
    Object.assign(tile, { width: 24, height: 24 });
    const out = new ImageData(24, 24);
    drawn.pixels.forEach((shade, i) => { const [r, g, b] = palette[shade]; out.data.set([r, g, b, 255], i * 4); });
    tile.getContext("2d")!.putImageData(out, 0, 0);
  });

  async function make(kind: "ui" | null) {
    setBusy(true);
    let done = false;
    try { done = await onCreate({ kind, name: kind ? fileName : `${fileName}.png`, width: 24, height: 24, pixels: drawn.pixels.slice() }); } finally { setBusy(false); }
    if (done) onClose();
  }

  return (
    <WizardPage title="UI frame" icon={<PanelsTopLeft size={18} />} busy={busy} onClose={onClose}
      line={["For assets/ui", "24 × 24, nine 8 × 8 tiles · shown as a dialogue box"]}
      footer={<>
        <span className="k-muted k-xs">{projectName ? (fileName === "frame" ? "The project has no frame.png: this one becomes it" : `The project has a frame.png already: this one is ${fileName}.png beside it (GB Studio reads frame.png; swap them by hand)`) : "Open a GB Studio project to make it there"}</span>
        <span className="k-spacer" />
        <Button onClick={() => void make(null)} disabled={busy}>Open as picture</Button>
        <Button variant="primary" disabled={!projectName || busy} title={projectName ? `Makes assets/ui/${fileName}.png (never replaces a file)` : "Open a GB Studio project first"} onClick={() => void make("ui")}>{busy ? "Making…" : `Make ${fileName}.png`}</Button>
      </>}>
      <div className="fw">
        <div className="fw-controls k-stack">
          <Select label="Style" value={frame.style} onChange={(style) => set({ style: style as FrameStyle, ...STYLE_SHADES[style as FrameStyle] })} options={FRAME_STYLES} />
          <div className="k-stack k-stack--tight"><span className="k-label">Corners</span>
            <Segmented fill size="sm" label="Corners" value={frame.corners} onChange={(corners) => set({ corners })} options={FRAME_CORNERS} /></div>
          <div className="k-stack k-stack--tight"><span className="k-label">Border</span>
            <Segmented fill size="sm" label="Border shade" value={String(frame.border)} onChange={(value) => set({ border: Number(value) })} options={SHADES} /></div>
          <div className="k-stack k-stack--tight"><span className="k-label">Fill</span>
            <Segmented fill size="sm" label="Fill shade" value={String(frame.fill)} onChange={(value) => set({ fill: Number(value) })} options={SHADES} /></div>
          {frame.border === frame.fill && <span className="k-muted k-xs">Border and fill are the same shade: the line disappears</span>}
          {projectName && <Field label="Font"><Select label="Font" value={font || NO_FONT} onChange={(value) => setFont(value === NO_FONT ? "" : value)} options={[{ value: NO_FONT, label: "No font" }, ...(settings?.fonts ?? []).map((item) => ({ value: item.file, label: item.name }))]} /></Field>}
          <Field label="Text"><textarea className="k-input fw-text" value={text} rows={3} spellCheck={false} onChange={(event) => setText(event.target.value)} /></Field>
          <span className="k-row"><span className="k-label">The frame</span><span className="k-spacer" /><canvas ref={setTile} className="fw-tile" aria-label="The frame, 24 × 24" /></span>
        </div>
        <div className="fw-stage">
          <div className="k-well fw-screen"><canvas ref={setScreen} aria-label="The frame as a dialogue box on a Game Boy screen" /></div>
          <span className="k-row">
            <Chip>24 × 24 px</Chip>
            <Chip>{settings?.uiPalette ? "UI palette" : "The greens"}</Chip>
            <span className="k-muted k-xs">{sheet ? "Text in the project's font, roughly as GB Studio draws it" : projectName ? "Pick a font to see text" : "Bars stand in for the text"}</span>
          </span>
        </div>
      </div>
    </WizardPage>
  );
}
