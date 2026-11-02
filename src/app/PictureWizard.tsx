/**
 * Picture to background (W1, the author's pick 2026-10-10: one page, live). Any picture or photo goes to GB Studio's
 * limits while keeping as much of its color as possible: framed to whole screens, fewer colors (a slider, optional
 * dithering), four colors a tile in at most 8 (or 7) palettes, and under the tile budget. Everything is on one
 * screen and the result re-fits as a control changes. The parent opens the result as a picture or writes it into the
 * project as a new background with its palettes in the slots.
 */
import { LOGO_TILES, logoHelps } from "../gb/limits";
import { Crop, Eraser, Images, ImagePlus, Lock, RotateCcw, RotateCw, Undo2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toRgba } from "../paint";
import { Button, Checkbox, IconButton, Select, Chip, Field, Meter, Segmented, Slider } from "../ui/kit";
import { WizardPage } from "./WizardPage";
import { SCREEN_SIZES, clampCrop, fitPicture, fitPictures, lockCell, rotatedSize, type CropBox, type DitherKind, type FitOptions, type FitResult } from "./pictureFit";
import { defaultName } from "./names";
import { NameInput } from "./NameInput";
import { SourceShelf, storeSources } from "./SourceShelf";
import { useWizardSettings } from "./useWizardSettings";
import { TileBudget } from "./TileBudget";
import { BeforeAfter } from "./BeforeAfter";
import "./PictureWizard.css";

interface Props {
  projectName: string | null;
  onClose: () => void;
  /** Opens the result as a picture here (no project needed). */
  onOpen: (result: FitResult, name: string) => Promise<void>;
  /**
   * Writes the result into the project as a new background, palettes in the slots; resolves true when done. `asked`
   * skips the question (a batch asks once, for its first picture).
   */
  onSave: (result: FitResult, name: string, asked?: boolean) => Promise<boolean>;
  /** The project's background names (the suggested name is never one of them). */
  takenNames?: string[];
  /** A line for the message bar (kept pictures, problems). */
  say?: (text: string) => void;
}

type Source = { image: ImageBitmap; name: string; /** The shelf tile it came from ("sample:sammie", "project:<file>"). */ key?: string };
type Framing = "cover" | "contain";

type Drawable = ImageBitmap | HTMLCanvasElement;

/** A picture's average color, "rgb(r,g,b)". */
function average(source: Drawable): string {
  const tiny = Object.assign(document.createElement("canvas"), { width: 1, height: 1 });
  const tc = tiny.getContext("2d", { willReadFrequently: true })!;
  tc.drawImage(source, 0, 0, 1, 1);
  const [r, g, b] = tc.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${g},${b})`;
}

/**
 * The source turned (the author, 2026-11-02): quarter turns plus a fine angle; the corners a fine angle opens take the
 * picture's average color (as the letterbox does), so they fit in the same palettes.
 */
function turn(source: ImageBitmap, degrees: number): Drawable {
  if (!degrees) return source;
  const [width, height] = rotatedSize(source.width, source.height, degrees);
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d")!;
  if (degrees % 90) { context.fillStyle = average(source); context.fillRect(0, 0, width, height); }
  context.imageSmoothingQuality = "high";
  context.translate(width / 2, height / 2);
  context.rotate(degrees * Math.PI / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

/** The part of the turned picture the crop box takes (all of it without one). */
function cropTo(source: Drawable, crop: CropBox | null): Drawable {
  if (!crop) return source;
  const sx = Math.round(crop.x * source.width), sy = Math.round(crop.y * source.height);
  const width = Math.max(1, Math.round(crop.w * source.width)), height = Math.max(1, Math.round(crop.h * source.height));
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  canvas.getContext("2d")!.drawImage(source, sx, sy, width, height, 0, 0, width, height);
  return canvas;
}

/** Draws the source into a width × height frame: cover (crop, panned) or contain (letterboxed on its average color). */
function frame(source: Drawable, width: number, height: number, framing: Framing, panX: number, panY: number): Uint8ClampedArray {
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const scale = framing === "cover" ? Math.max(width / source.width, height / source.height) : Math.min(width / source.width, height / source.height);
  const w = source.width * scale, h = source.height * scale;
  if (framing === "contain") {
    // The letterbox takes the picture's average color, so it fits in the same palettes.
    context.fillStyle = average(source);
    context.fillRect(0, 0, width, height);
  }
  const x = framing === "cover" ? -(w - width) * panX / 100 : (width - w) / 2;
  const y = framing === "cover" ? -(h - height) * panY / 100 : (height - h) / 2;
  context.drawImage(source, x, y, w, h);
  return context.getImageData(0, 0, width, height).data;
}

function Picture({ rgba, width, height, label, extra, children }: { rgba: Uint8ClampedArray | null; width: number; height: number; label: ReactNode; extra?: ReactNode; children?: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current;
    if (!target || !rgba) return;
    if (target.width !== width || target.height !== height) Object.assign(target, { width, height });
    target.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  }, [rgba, width, height]);
  return <figure className="pw-pic"><figcaption className="k-eyebrow">{label}</figcaption><div className="pw-frame"><canvas ref={canvas} width={width} height={height} />{children}{extra}</div></figure>;
}

/** One picture of a batch on the strip: its fitted result, small. */
function Thumb({ result, picked, label, onPick }: { result: FitResult; picked: boolean; label: string; onPick: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    Object.assign(target, { width: result.width, height: result.height });
    const rgba = toRgba(result.pixels, result.cells, result.width, result.palettes.map((colors, index) => ({ name: `${index}`, colors })));
    target.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(rgba), result.width, result.height), 0, 0);
  }, [result]);
  return <button type="button" className={`pw-thumb${picked ? " is-picked" : ""}`} title={label} aria-pressed={picked} onClick={onPick}><canvas ref={canvas} /></button>;
}

/** A lock's tint per slot (only on the wizard's overlay, never in the picture). */
const LOCK_TINTS = ["#ff5a5a", "#ffb03a", "#f2e24a", "#5ad46a", "#3ac8ff", "#5a7aff", "#c05aff", "#ff5ab4"];

/**
 * Lock a region's palette (the author, 2026-11-02): painted over the result, tile by tile, with a slot brush (or the
 * eraser). Strokes draw on the overlay at once and reach the fit when the pointer lifts.
 */
function LockLayer({ width, height, locks, brush, onLocks }: { width: number; height: number; locks: Uint8Array; brush: number | null; onLocks: (locks: Uint8Array) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<Uint8Array | null>(null);
  const draw = (map: Uint8Array) => {
    const target = canvas.current;
    if (!target) return;
    const context = target.getContext("2d")!;
    context.clearRect(0, 0, width, height);
    const cw = Math.ceil(width / 8);
    context.font = "6px monospace";
    context.textBaseline = "top";
    map.forEach((slot, cell) => {
      if (!slot) return;
      const x = (cell % cw) * 8, y = Math.floor(cell / cw) * 8;
      context.globalAlpha = 0.4; context.fillStyle = LOCK_TINTS[slot - 1]; context.fillRect(x, y, 8, 8);
      context.globalAlpha = 1; context.fillStyle = "#000"; context.fillText(String(slot), x + 2, y + 1);
    });
  };
  useEffect(() => draw(locks)); // eslint-disable-line react-hooks/exhaustive-deps
  const paint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!live.current || brush === null) return;
    // The canvas keeps its picture's shape inside its box (object-fit: contain): map the pointer into the picture.
    const rect = event.currentTarget.getBoundingClientRect(), scale = Math.min(rect.width / width, rect.height / height);
    const x = Math.floor((event.clientX - rect.left - (rect.width - width * scale) / 2) / scale), y = Math.floor((event.clientY - rect.top - (rect.height - height * scale) / 2) / scale);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    live.current[lockCell(width, x, y)] = brush;
    draw(live.current);
  };
  return <canvas ref={canvas} width={width} height={height} className={`pw-locks${brush !== null ? " is-painting" : ""}`} aria-label="Palette locks"
    onPointerDown={(event) => { if (brush === null) return; event.currentTarget.setPointerCapture(event.pointerId); live.current = locks.slice(); paint(event); }}
    onPointerMove={paint}
    onPointerUp={() => { if (live.current) { onLocks(live.current); live.current = null; } }}
    onPointerCancel={() => { live.current = null; draw(locks); }} />;
}

/**
 * The whole source picture (turned), the part the frame takes boxed on it (Fill crops; Fit inside takes it all).
 * Dragging on it draws a crop box (the author, 2026-11-02); the frame then fits inside that box.
 */
function SourceView({ name, turned, crop, onCrop, width, height, framing, pan }: { name: string; turned: Drawable; crop: CropBox | null; onCrop: (crop: CropBox | null) => void; width: number; height: number; framing: Framing; pan: { x: number; y: number } }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number; box: CropBox | null } | null>(null);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    Object.assign(target, { width: turned.width, height: turned.height });
    target.getContext("2d")!.drawImage(turned, 0, 0);
  }, [turned]);
  const shown = drag?.box ?? crop;
  const area = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sw = turned.width * area.w, sh = turned.height * area.h;
  const scale = Math.max(width / sw, height / sh), w = width / scale / sw, h = height / scale / sh;
  const box = framing === "cover" && !drag ? { left: (area.x + (1 - w) * area.w * pan.x / 100) * 100, top: (area.y + (1 - h) * area.h * pan.y / 100) * 100, width: w * area.w * 100, height: h * area.h * 100 } : null;
  const at = (event: React.PointerEvent<HTMLElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }; };
  return (
    <figure className="pw-pic"><figcaption className="k-eyebrow">Your picture · {name} <span className="k-muted">· drag to crop</span></figcaption>
      <div className="pw-frame pw-frame--source"><span className="pw-src"
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const p = at(event); setDrag({ ...p, box: null }); }}
        onPointerMove={(event) => { if (!drag) return; const p = at(event); setDrag({ ...drag, box: clampCrop(drag.x, drag.y, p.x, p.y) }); }}
        onPointerUp={() => { if (drag) { if (drag.box) onCrop(drag.box); setDrag(null); } }}
        onPointerCancel={() => setDrag(null)}><canvas ref={canvas} />
        {shown && <i className="pw-cropbox" style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.w * 100}%`, height: `${shown.h * 100}%` }} />}
        {box && <i className="pw-crop" style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }} />}</span></div>
    </figure>
  );
}

export function PictureWizard({ projectName, onClose, onOpen, onSave, takenNames = [], say }: Props) {
  // The shelf rereads the project's pictures when a drop or paste adds one.
  const [shelfTick, setShelfTick] = useState(0);
  const [source, setSource] = useState<Source | null>(null);
  // Remembered per project, with presets (the author, 2026-11-02); the picture, its crop and pan are not.
  const ws = useWizardSettings("picture", { size: [160, 144] as [number, number], framing: "cover" as Framing, keep: 32, dither: "none" as DitherKind, strength: 100, max: 8 as 7 | 8, budget: true });
  const [size, setSize] = ws.field("size");
  const [framing, setFraming] = ws.field("framing");
  const [pan, setPan] = useState({ x: 50, y: 50 });
  // Crop and turn the source first (the author, 2026-11-02): quarter turns, a fine angle (-45 … 45°) and a crop box.
  const [quarter, setQuarter] = useState(0);
  const [angle, setAngle] = useState(0);
  const [crop, setCrop] = useState<CropBox | null>(null);
  const unturn = () => { setQuarter(0); setAngle(0); setCrop(null); };
  const [keep, setKeep] = ws.field("keep");
  // (the author, 2026-11-02): the dither pattern is a choice, with a strength; none stays the default.
  const [dither, setDither] = ws.field("dither");
  const [strength, setStrength] = ws.field("strength");
  const [max, setMax] = ws.field("max");
  const [budget, setBudget] = ws.field("budget");
  const [name, setName] = useState(() => defaultName("Background", takenNames));
  const [over, setOver] = useState(false);
  // Before / after (the author, 2026-11-02): your picture as framed, wiped into the result.
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<FitResult | null>(null);
  // Batch (the author, 2026-11-02): several pictures share one palette set; the strip flips through them.
  const [batch, setBatch] = useState<{ image: ImageBitmap; name: string }[] | null>(null);
  const [batchResults, setBatchResults] = useState<FitResult[]>([]);
  const [shown, setShown] = useState(0);
  const several = useRef<HTMLInputElement>(null);
  const takeSeveral = async (files: File[]) => {
    const images = (await Promise.all(files.map(async (picked) => { try { return { image: await createImageBitmap(picked, { colorSpaceConversion: "none", premultiplyAlpha: "none" }), name: picked.name }; } catch { return null; } }))).filter((entry) => entry !== null);
    if (images.length < 2) { images.forEach((entry) => entry.image.close()); if (images.length) void take(files.find((picked) => picked.name === images[0].name)); else say?.("None of those are pictures."); return; }
    setBatch((was) => { was?.forEach((entry) => entry.image.close()); return images; });
    setShown(0);
  };
  const endBatch = () => { setBatch((was) => { was?.forEach((entry) => entry.image.close()); return null; }); setBatchResults([]); };
  // Palette locks, one slot per tile (0 free); a new size starts with none. The brush: a slot, 0 to erase, null off.
  const [lockMap, setLockMap] = useState<Uint8Array>(() => new Uint8Array(0));
  const [lockBrush, setLockBrush] = useState<number | null>(null);
  const [lockSlot, setLockSlot] = useState(1);
  const file = useRef<HTMLInputElement>(null);
  const [width, height] = size;

  // The newest pick wins (a slow decode never replaces a later one), and the picture it replaces is freed.
  const picks = useRef(0), chosen = useRef(false);
  const take = async (picked: File | Blob | null | undefined, label?: string, sample = false, key?: string) => {
    if (!picked) return;
    if (sample && chosen.current) return;
    if (!sample) chosen.current = true;
    const ticket = ++picks.current;
    try {
      const image = await createImageBitmap(picked, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      if (ticket !== picks.current || (sample && chosen.current)) { image.close(); return; }
      unturn();
      setSource((was) => { was?.image.close(); return { image, name: label ?? (picked instanceof File ? picked.name : "picture"), key }; });
    } catch { /* not a picture */ }
  };
  /** A file chosen, dropped or pasted: kept in the project when one is open (the shelf shows it), then taken. */
  const keepFile = async (picked: File | Blob | null | undefined, label?: string) => {
    if (!picked) return;
    if (!projectName) return take(picked, label);
    const file = picked instanceof File ? picked : new File([picked], `pasted-${Date.now()}.png`, { type: picked.type || "image/png" });
    try {
      const entry = await storeSources("pictures", [file]);
      setShelfTick((tick) => tick + 1);
      if (entry) { say?.(`${entry.name} is in ${projectName} now (Cartographer/pictures).`); return take(file, entry.name, false, `project:${entry.file}`); }
    } catch (error) { say?.(`Could not keep it in the project: ${(error as Error).message}`); }
    return take(file, label);
  };

  // It starts on the author's photo of Sammie (2026-10-14), so the wizard shows what it does straight away.
  useEffect(() => {
    let gone = false;
    void fetch(`${import.meta.env.BASE_URL}sammie.jpg`).then((response) => response.blob()).then((blob) => { if (!gone) void take(blob, "Sammie", true, "sample:sammie"); }).catch(() => {});
    return () => { gone = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Paste a picture from the clipboard while the window is open.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => { const item = [...(event.clipboardData?.items ?? [])].find((entry) => entry.type.startsWith("image/")); if (item) { event.preventDefault(); void keepFile(item.getAsFile(), "Pasted picture"); } };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const turned = useMemo(() => source ? turn(source.image, quarter * 90 + angle) : null, [source, quarter, angle]);
  const cellCount = Math.ceil(width / 8) * Math.ceil(height / 8);
  const locks = useMemo(() => lockMap.length === cellCount ? lockMap : new Uint8Array(cellCount), [lockMap, cellCount]);
  const locked = useMemo(() => locks.some((slot) => slot > 0 && slot <= max), [locks, max]);
  const framed = useMemo(() => turned ? frame(cropTo(turned, crop), width, height, framing, pan.x, pan.y) : null, [turned, crop, width, height, framing, pan.x, pan.y]);
  const options = useMemo<FitOptions>(() => ({ keep, dither, strength, max, budget, locks: locked ? locks : undefined }), [keep, dither, strength, max, budget, locks, locked]);

  // A batch is framed as it is (no turn, crop or locks: those are a single picture's) and fitted all at once.
  const batchOptions = useMemo(() => ({ keep, dither, strength, max, budget }), [keep, dither, strength, max, budget]);
  useEffect(() => {
    if (!batch) return;
    setWorking(true);
    const timer = window.setTimeout(() => { setBatchResults(fitPictures(batch.map((entry) => frame(entry.image, width, height, framing, pan.x, pan.y)), width, height, batchOptions)); setWorking(false); }, 120);
    return () => window.clearTimeout(timer);
  }, [batch, width, height, framing, pan.x, pan.y, batchOptions]);
  const current = batch ? batchResults[Math.min(shown, batchResults.length - 1)] ?? null : result;
  /** The batch's names: the name box plus -1, -2… (never one the project has). */
  const batchNames = () => { const used = new Set(takenNames.map((taken) => taken.toLowerCase())); const base = name.trim(); return (batch ?? []).map((_, index) => { let made = `${base}-${index + 1}`; for (let n = 2; used.has(made.toLowerCase()); n += 1) made = `${base}-${index + 1}-${n}`; used.add(made.toLowerCase()); return made; }); };
  /** Saves every picture of the batch one by one (each a new PNG, as a single one is); the palettes are added once. */
  const saveBatch = async () => {
    const names = batchNames(), base = name.trim();
    for (const [index, each] of batchResults.entries()) {
      if (!await onSave({ ...each, names: each.palettes.map((_, at) => `${base} ${at + 1}`) }, names[index], index > 0)) { if (index) say?.(`Saved ${index} of ${batchResults.length}; stopped at ${names[index]}.`); return false; }
    }
    return true;
  };

  // The fit is the slow part (a few hundred ms on four screens): run it a beat after the last change.
  useEffect(() => {
    if (batch) return;
    if (!framed) return setResult(null);
    setWorking(true);
    const timer = window.setTimeout(() => { setResult(fitPicture(framed, width, height, options)); setWorking(false); }, 120);
    return () => window.clearTimeout(timer);
  }, [framed, width, height, options, batch]);

  const after = useMemo(() => current ? toRgba(current.pixels, current.cells, current.width, current.palettes.map((colors, index) => ({ name: `${index}`, colors }))) : null, [current]);
  const screens = `${width / 160 * height / 144} screen${width / 160 * height / 144 === 1 ? "" : "s"}`;
  const act = async (what: () => Promise<unknown>) => { setBusy(true); try { await what(); } finally { setBusy(false); } };

  return (
    <WizardPage tools={ws.bar} title="Picture to background" icon={<ImagePlus size={18} />} busy={busy} onClose={onClose}
      line={["Change anything, the result follows", batch ? `${batch.length} pictures · one shared set of ${current?.palettes.length ?? "…"} palettes · ${width} × ${height}` : result ? `${source?.name ?? "picture"} · ${width} × ${height} · ${result.tiles} / ${result.limit} tiles · ${result.palettes.length} palettes` : source ? `${source.name} · fitting…` : "drop, paste or choose a picture"]}
      footer={<>
        <input ref={file} type="file" accept="image/*" hidden onChange={(event) => { void keepFile(event.target.files?.[0]); event.target.value = ""; }} />
        <input ref={several} type="file" accept="image/*" multiple hidden onChange={(event) => { void takeSeveral([...(event.target.files ?? [])]); event.target.value = ""; }} />
        {batch ? <Button onClick={endBatch} title="Back to one picture">One picture</Button> : <Button icon={<Upload />} onClick={() => file.current?.click()}>{source ? "Another picture…" : "Choose a picture…"}</Button>}
        <Button icon={<Images />} title="Several pictures at once, fitted to one shared set of palettes, each saved as its own background" onClick={() => several.current?.click()}>{batch ? "Other pictures…" : "Several…"}</Button>
        <span className="k-spacer" />
        <span className="pw-name"><NameInput kind="Background" value={name} onChange={setName} taken={takenNames} /></span>
        <Button disabled={!current || busy || working} title={batch ? "Opens the picture shown here as an untitled picture" : "Opens the result here as an untitled picture"} onClick={() => current && void act(() => onOpen(current, batch ? batchNames()[shown] ?? "Picture" : name.trim() || "Picture"))}>Open as a picture</Button>
        {batch ? <Button variant="primary" disabled={batchResults.length !== batch.length || busy || working || !projectName || !name.trim()} title={projectName ? `${batch.length} new backgrounds in ${projectName} (${batchNames().join(", ")}), the shared palettes added once and put in the default slots` : "Open a project to save into it"} onClick={() => void act(async () => { if (await saveBatch()) onClose(); })}>Save {batch.length} into {projectName ?? "the project"}</Button>
          : <Button variant="primary" disabled={!result || busy || working || !projectName || !name.trim()} title={projectName ? `A new background in ${projectName}, its palettes added to the project and put in the default slots` : "Open a project to save into it"} onClick={() => result && void act(async () => { if (await onSave(result, name.trim())) onClose(); })}>Save into {projectName ?? "the project"}</Button>}
      </>}>
      <div className="pw-body">
        <div className="pw-stage">
          {batch ? (<>
            <Picture rgba={after && current?.width === width && current.height === height ? after : null} width={width} height={height} label={<>{batch[shown]?.name} · {shown + 1} of {batch.length} · {width} × {height} ({screens})</>} extra={working ? <Chip title="Fitting…">fitting…</Chip> : undefined} />
            <div className="pw-strip" aria-label="The batch">{batchResults.map((each, index) => <Thumb key={index} result={each} picked={index === shown} label={batch[index]?.name ?? ""} onPick={() => setShown(index)} />)}</div>
          </>) : !source ? (
            <div className={`pw-drop${over ? " is-over" : ""}`} onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setOver(false); void keepFile(event.dataTransfer.files?.[0]); }}>
              <ImagePlus size={28} />
              <div><b>Drop a picture or photo here</b><br /><span className="k-small">or paste one, or <button type="button" className="k-link" onClick={() => file.current?.click()}>choose a file</button></span></div>
              <span className="k-muted k-xs">It is framed to whole screens, fitted to 8 palettes of 4 colors a tile, and kept under the tile budget.</span>
            </div>
          ) : (<>
            {compare && framed && after && result?.width === width && result.height === height
              ? <BeforeAfter before={framed} after={after} width={width} height={height} beforeLabel="Your picture, framed" afterLabel={<>Result · {width} × {height}</>} />
              : <Picture rgba={after && result?.width === width && result.height === height ? after : framed} width={width} height={height} label={<>Result · {width} × {height} ({screens}) · live</>} extra={working ? <Chip title="Fitting…">fitting…</Chip> : undefined}>
                <LockLayer width={width} height={height} locks={locks} brush={lockBrush} onLocks={setLockMap} />
              </Picture>}
            <div style={{ width: "46%" }}>{turned && <SourceView name={source.name} turned={turned} crop={crop} onCrop={setCrop} width={width} height={height} framing={framing} pan={pan} />}</div>
          </>)}
        </div>
        <div className="pw-controls">
          <SourceShelf kind="pictures" projectName={projectName} accept="image/*" samples={[{ id: "sammie", label: "Sammie", thumb: `${import.meta.env.BASE_URL}sammie.jpg` }]} selected={source?.key ?? null}
            onSample={() => void fetch(`${import.meta.env.BASE_URL}sammie.jpg`).then((response) => response.blob()).then((blob) => take(blob, "Sammie", false, "sample:sammie"))}
            onProject={(entry, files) => void take(files[0], entry.name, false, `project:${entry.file}`)} onLoose={(files) => void take(files[0])} say={say ?? (() => {})} refresh={shelfTick} />
          <div className="pw-section"><span className="k-label">Size</span><Segmented fill size="sm" label="Size" value={`${width}x${height}`} onChange={(value) => { const [w, h] = value.split("x").map(Number); setSize([w, h]); }} options={SCREEN_SIZES.map(([w, h, label]) => ({ value: `${w}x${h}`, label }))} /></div>
          <div className="pw-section"><span className="k-label"><Crop size={12} /> Frame</span><Segmented fill size="sm" label="Frame" value={framing} onChange={setFraming} options={[{ value: "cover", label: "Fill (crop)" }, { value: "contain", label: "Fit inside" }]} />
            {framing === "cover" && <>
              <Field label="Left ↔ right"><Slider label="Pan across" value={pan.x} onChange={(x) => setPan({ ...pan, x })} min={0} max={100} /></Field>
              <Field label="Top ↕ bottom"><Slider label="Pan down" value={pan.y} onChange={(y) => setPan({ ...pan, y })} min={0} max={100} /></Field>
            </>}
          </div>
          <div className="pw-section"><span className="k-label">Turn and crop</span>
            <div className="pw-row">
              <IconButton label="Turn left a quarter" size="sm" onClick={() => { setQuarter((quarter + 3) % 4); setCrop(null); }}><RotateCcw /></IconButton>
              <IconButton label="Turn right a quarter" size="sm" onClick={() => { setQuarter((quarter + 1) % 4); setCrop(null); }}><RotateCw /></IconButton>
              <span className="k-spacer" />
              <Button size="sm" icon={<Undo2 />} disabled={!quarter && !angle && !crop} title="No turn, no crop" onClick={unturn}>Reset</Button>
            </div>
            <Field label={<>Straighten <span className="k-muted">· {angle}°</span></>} hint={crop ? "Cropped: drag on your picture again to change it" : "Drag on your picture to crop it"}><Slider label="Straighten" value={angle} onChange={(value) => { setAngle(value); setCrop(null); }} min={-45} max={45} /></Field>
          </div>
          <Field label={<>Keep colors <span className="k-muted">· {keep >= 64 ? "all" : keep}</span></>} hint="Fewer colors: cleaner tiles, fewer palettes needed"><Slider label="Keep colors" value={keep} onChange={setKeep} min={4} max={64} step={2} /></Field>
          <div className="pw-section"><span className="k-label">Dithering</span><Segmented fill size="sm" label="Dithering" value={dither} onChange={setDither} options={[{ value: "none", label: "None" }, { value: "ordered", label: "Ordered", title: "A 4 × 4 pattern: even textures" }, { value: "floyd", label: "Diffused", title: "Floyd-Steinberg: each pixel's error spreads to its neighbours" }]} />
            {dither !== "none" && <Field label={<>Strength <span className="k-muted">· {strength}%</span></>}><Slider label="Dither strength" value={strength} onChange={setStrength} min={0} max={100} step={5} /></Field>}</div>
          <div className="pw-section"><span className="k-label">Palettes</span><Segmented fill size="sm" label="Palettes" value={String(max) as "7" | "8"} onChange={(value) => setMax(Number(value) as 7 | 8)} options={[{ value: "8", label: "8" }, { value: "7", label: "7 · keep slot 8 for the UI" }]} /></div>
          <div className="pw-section"><span className="k-label"><Lock size={12} /> Lock palettes</span>
            <div className="pw-row">
              <Button size="sm" icon={<Lock />} pressed={lockBrush !== null && lockBrush > 0} title="Paint over the result: those tiles keep this slot, its palette fitted to them alone" onClick={() => setLockBrush(lockBrush !== null && lockBrush > 0 ? null : Math.min(lockSlot, max))}>Paint</Button>
              <span className="pw-slot"><Select label="Slot to lock" value={String(Math.min(lockSlot, max))} onChange={(value) => { setLockSlot(Number(value)); if (lockBrush) setLockBrush(Number(value)); }} options={Array.from({ length: max }, (_, index) => ({ value: String(index + 1), label: `Slot ${index + 1}` }))} /></span>
              <IconButton label="Erase locks" size="sm" pressed={lockBrush === 0} onClick={() => setLockBrush(lockBrush === 0 ? null : 0)}><Eraser /></IconButton>
            </div>
            <Button size="sm" disabled={!locks.some(Boolean)} onClick={() => { setLockMap(new Uint8Array(cellCount)); setLockBrush(null); }}>Clear the locks</Button>
          </div>
          <Checkbox checked={budget} onChange={setBudget}>Stay within the tile budget (merge near tiles)</Checkbox>
          {batch && <p className="k-hint">A batch is framed as set above; turning, cropping and locks are for one picture.</p>}
          {current && <>
            {!batch && <Checkbox checked={compare} onChange={setCompare}>Before / after</Checkbox>}
            <TileBudget tiles={current.tiles} limit={current.limit} slots={current.palettes.length} title={current.merged ? `${current.tilesBefore} before merging near tiles` : "Unique tiles (flipped copies count once, as in a Color Only scene)"} />
            {logoHelps(current.width, current.height, current.limit) && <Meter label="Logo" value={current.tiles} of={LOGO_TILES} tone={current.tiles > LOGO_TILES ? "bad" : undefined} title="As a Logo scene (static: no text, menus or actors) GB Studio lets one screen use every tile, up to 360" />}
            <p className="pw-report">{current.merged ? `${current.tilesBefore} → ${current.tiles} tiles after merging ${current.merged} near ones. ` : ""}{current.report.after} palette{current.report.after === 1 ? "" : "s"} · {current.report.overfull.length} tile{current.report.overfull.length === 1 ? "" : "s"} had more than 4 colors.{current.tiles > current.limit ? ` Still ${current.tiles - current.limit} over GB Studio's ${current.limit}: keep fewer colors, or set dithering to None.` : ""}</p>
            <div className="pw-palettes" aria-label="Palettes">{current.palettes.map((colors, index) => <span key={index} title={`Palette ${index + 1}: ${colors.join(" ")}`}>{colors.map((color, at) => <i key={at} style={{ background: color }} />)}</span>)}</div>
          </>}
        </div>
      </div>
    </WizardPage>
  );
}
