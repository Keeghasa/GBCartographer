/**
 * The 3D Snapshot window (the author, 2026-10-14: the Darkroom mockup, improved; the pictures under the print). Left:
 * the model, the light rig (key, fill and rim, dragged round the model seen from above) and the settings. Middle: the
 * print, live in the four shades at a Game Boy size; drag it to turn the model, scroll to zoom. Take picture adds the
 * print to the pictures below it; each opens as a new picture to paint and save. Never called a camera after any
 * console's own.
 */
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Box, Camera as CameraIcon, Download, FolderInput, ImagePlus, Trash2, Upload } from "lucide-react";
import { toRgba } from "../paint";
import { Button, Dialog, IconButton, Segmented, Slider, Switch } from "../ui/kit";
import type { ShotSettings, Stage } from "./snapshot3d";
import "./SnapshotWindow.css";

type Size = "screen" | "small" | "sprite";
type Light = "key" | "fill" | "rim";
const SIZES: Record<Size, { width: number; height: number; label: string; title: string }> = {
  screen: { width: 160, height: 144, label: "160 × 144", title: "A whole screen: a background" },
  small: { width: 128, height: 112, label: "128 × 112", title: "A smaller picture, framed on a screen" },
  sprite: { width: 32, height: 32, label: "Sprite 32", title: "A 32 × 32 sprite frame: see-through background, no shade 0" },
};
const LIGHTS: { id: Light; letter: string; name: string; about: string }[] = [
  { id: "key", letter: "K", name: "Key", about: "the main light" },
  { id: "fill", letter: "F", name: "Fill", about: "softens the shadows" },
  { id: "rim", letter: "R", name: "Rim", about: "lights the edges from behind" },
];

interface Picture { id: number; name: string; width: number; height: number; pixels: Uint8Array; url: string }

const urlOf = (pixels: Uint8Array, width: number, height: number) => {
  const canvas = document.createElement("canvas");
  Object.assign(canvas, { width, height });
  canvas.getContext("2d")!.putImageData(new ImageData(toRgba(pixels, new Uint8Array(Math.ceil(width / 8) * Math.ceil(height / 8)), width), width, height), 0, 0);
  return canvas.toDataURL();
};

/**
 * The light rig, seen from above (left: the model in the middle, you at the bottom) and from the side (right: the
 * ground along the bottom, you on the left): a dot per light to drag. Above sets where a light stands round the
 * model; the side view its height (and how far in front or behind).
 */
function Rig({ rig, onMove }: { rig: ShotSettings["rig"]; onMove: (light: Light, at: [number, number, number]) => void }) {
  const top = useRef<HTMLDivElement>(null), side = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<{ light: Light; view: "top" | "side" } | null>(null);
  const place = (event: PointerEvent) => {
    if (!held) return;
    const box = (held.view === "top" ? top : side).current!.getBoundingClientRect();
    const u = Math.min(1, Math.max(-1, ((event.clientX - box.left) / box.width) * 2 - 1)), v = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    const [x, , z] = rig[held.light];
    if (held.view === "top") {
      let nx = u, ny = -(v * 2 - 1);
      const reach = Math.hypot(nx, ny);
      if (reach > 1) { nx /= reach; ny /= reach; }
      onMove(held.light, [nx, ny, z]);
    } else onMove(held.light, [x, u, 1 - v]);
  };
  const dots = (view: "top" | "side") => LIGHTS.map(({ id, letter, name, about }) => {
    const [x, y, z] = rig[id];
    return (
      <button key={id} type="button" className={`sw-light sw-light--${id}`} title={`${name}: ${about}. Drag it ${view === "top" ? "round the model" : "up or down"}.`} aria-label={`${name} light, ${view === "top" ? "from above" : "from the side"}`}
        style={view === "top" ? { left: `${(x + 1) * 50}%`, top: `${(1 - y) * 50}%` } : { left: `${(y + 1) * 50}%`, top: `${(1 - z) * 100}%` }}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setHeld({ light: id, view }); }}>{letter}</button>
    );
  });
  // Beams: a line from each light to the model, in the light's color; the model sits in the middle (above) or on the
  // ground (side); you're at the front (above: bottom; side: left, at eye height).
  const beams = (view: "top" | "side") => (
    <svg className="sw-beams" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {LIGHTS.map(({ id }) => { const [x, y, z] = rig[id]; const [lx, ly] = view === "top" ? [(x + 1) * 50, (1 - y) * 50] : [(y + 1) * 50, (1 - z) * 100]; const [mx, my] = view === "top" ? [50, 50] : [50, 76];
        return <line key={id} x1={lx} y1={ly} x2={mx} y2={my} className={`sw-beam sw-beam--${id}`} vectorEffect="non-scaling-stroke" />; })}
    </svg>
  );
  return (
    <div className="sw-rigs" onPointerMove={place} onPointerUp={() => setHeld(null)}>
      <div ref={top} className="sw-rig">
        <span className="sw-rig-label">Above</span><span className="sw-rig-ring" />{beams("top")}
        <span className="sw-rig-model" title="The model"><Box size={16} /></span>
        <span className="sw-rig-you sw-rig-you--top" title="You (the print's view)"><CameraIcon size={14} /></span>
        {dots("top")}
      </div>
      <div ref={side} className="sw-rig sw-rig--side">
        <span className="sw-rig-label">Side</span><span className="sw-rig-ground" />{beams("side")}
        <span className="sw-rig-model sw-rig-model--side" title="The model"><Box size={16} /></span>
        <span className="sw-rig-you sw-rig-you--side" title="You (the print's view)"><CameraIcon size={14} /></span>
        {dots("side")}
      </div>
    </div>
  );
}

/** The models the window comes with (the author, 2026-10-14): the house drawn in code, and a CC0 duck. */
type BuiltIn = "house" | "duck";
const BUILT_IN: Record<BuiltIn, { label: string; name: string; url?: string; credit?: { text: string; href: string } }> = {
  house: { label: "House", name: "Sample house" },
  duck: { label: "Rubber duck", name: "Rubber Duck Toy", url: `${import.meta.env.BASE_URL}models/rubber-duck/rubber_duck_toy.gltf`,
    credit: { text: "Rubber Duck Toy by Plat251 · Poly Haven · CC0", href: "https://polyhaven.com/a/rubber_duck_toy" } },
};

type Shot = { name: string; width: number; height: number; pixels: Uint8Array };

/** A shot made ready for the project: a background at least a screen big (a smaller shot centred on one), or a sprite. */
function forProject(shot: Shot): { kind: "backgrounds" | "sprites"; shot: Shot } {
  if (shot.width === 32) return { kind: "sprites", shot };
  if (shot.width >= 160 && shot.height >= 144) return { kind: "backgrounds", shot };
  const pixels = new Uint8Array(160 * 144), left = (160 - shot.width) >> 1, top = (144 - shot.height) >> 1;
  for (let y = 0; y < shot.height; y += 1) pixels.set(shot.pixels.subarray(y * shot.width, (y + 1) * shot.width), (top + y) * 160 + left);
  return { kind: "backgrounds", shot: { ...shot, width: 160, height: 144, pixels } };
}

export function SnapshotWindow({ onClose, onTake, onSend, onExport }: { onClose: () => void; onTake: (picture: Shot) => void;
  /** Writes the shot into the open project as a new background or sprite (null: no project open). */
  onSend: ((kind: "backgrounds" | "sprites", picture: Shot) => Promise<boolean>) | null;
  /** Saves a PNG wherever the user picks (the desktop app's save dialog, or a download in a browser). */
  onExport: (blob: Blob, name: string) => Promise<unknown> }) {
  const print = useRef<HTMLCanvasElement>(null), file = useRef<HTMLInputElement>(null);
  const stage = useRef<Stage | null>(null), engine = useRef<typeof import("./snapshot3d") | null>(null);
  const [size, setSize] = useState<Size>("screen");
  const [key, setKey] = useState(70), [fill, setFill] = useState(30), [rim, setRim] = useState(50);
  const [rig, setRig] = useState<ShotSettings["rig"]>({ key: [-0.55, -0.55, 0.7], fill: [0.6, -0.35, 0.45], rim: [0.1, 0.7, 0.6] });
  const [fov, setFov] = useState(35), [brightness, setBrightness] = useState(0), [contrast, setContrast] = useState(45);
  const [dither, setDither] = useState(true), [outline, setOutline] = useState(true);
  const [model, setModel] = useState("Sample house"), [triangles, setTriangles] = useState(0), [problem, setProblem] = useState<string | null>(null);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [background, setBackground] = useState<ShotSettings["background"]>("clear");
  const [builtIn, setBuiltIn] = useState<BuiltIn | null>("house");
  const [, setTick] = useState(0);
  const settings: ShotSettings = { ...SIZES[size], key, fill, rim, rig, fov, brightness, contrast, dither, outline, sprite: size === "sprite", background };
  const shades = useRef<Uint8Array | null>(null);

  // three.js loads when the window opens; the stage starts with the sample house, turned by dragging the print.
  useEffect(() => {
    let gone = false;
    void import("./snapshot3d").then((module) => {
      if (gone || !print.current) return;
      engine.current = module;
      const made = module.createStage(print.current);
      stage.current = made;
      made.onChange(() => setTick((value) => value + 1));
      made.show(module.sampleModel());
      setTriangles(made.triangles());
    });
    return () => { gone = true; stage.current?.dispose(); stage.current = null; };
  }, []);

  // The print, redrawn whenever the view or a setting changes.
  useEffect(() => {
    const live = stage.current, target = print.current;
    if (!live || !target) return;
    const pixels = live.shot(settings);
    shades.current = pixels;
    Object.assign(target, { width: settings.width, height: settings.height });
    target.getContext("2d")!.putImageData(new ImageData(toRgba(pixels, new Uint8Array(Math.ceil(settings.width / 8) * Math.ceil(settings.height / 8)), settings.width), settings.width, settings.height), 0, 0);
  });

  async function open(picked: File[]) {
    if (!picked.length || !engine.current || !stage.current) return;
    try {
      const loaded = await engine.current.loadModel(picked);
      stage.current.show(loaded.model);
      setBuiltIn(null); setModel(loaded.name); setTriangles(stage.current.triangles()); setProblem(null);
    } catch (error) {
      setProblem(`${picked.map((file) => file.name).join(", ")} didn't open: ${error instanceof Error ? error.message : String(error)}. A .glb works best (from Blender: File → Export → glTF 2.0, binary).`);
    }
  }

  async function pick(which: BuiltIn) {
    if (!engine.current || !stage.current) return;
    const item = BUILT_IN[which];
    try {
      stage.current.show(item.url ? await engine.current.loadBuiltIn(item.url) : engine.current.sampleModel());
      setBuiltIn(which); setModel(item.name); setTriangles(stage.current.triangles()); setProblem(null);
    } catch (error) {
      setProblem(`${item.name} didn't open: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function take() {
    if (!shades.current) return;
    const pixels = shades.current.slice(), { width, height } = settings;
    setPictures((list) => [{ id: Date.now(), name: `${model.replace(/\.[^.]+$/, "")} ${list.length + 1}`, width, height, pixels, url: urlOf(pixels, width, height) }, ...list]);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} full title="3D Snapshot" sub="Turn a 3D model, light it, and take its picture in the four shades" icon={<Box size={18} />}>
      <div className="sw-page">
      <div className="sw-top"><span>Turn · light · take</span><span>{model} · {triangles.toLocaleString()} triangles · {settings.width} × {settings.height}</span></div>
      <h1 className="sw-h1"><b>3D Snapshot</b></h1>
      <div className="sw" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void open([...event.dataTransfer.files]); }}>
        <aside className="k-card sw-controls">
          <div className="sw-group">
            <div className="sw-head"><h2 className="k-heading">Model</h2><Button size="sm" icon={<Upload />} onClick={() => file.current?.click()}>Load…</Button></div>
            <Segmented label="Built-in models" fill size="sm" value={builtIn ?? ("" as BuiltIn)} onChange={(value) => void pick(value)} options={(Object.keys(BUILT_IN) as BuiltIn[]).map((value) => ({ value, label: BUILT_IN[value].label }))} />
            <div className="sw-drop">{model} · {triangles.toLocaleString()} triangles</div>
            {builtIn && BUILT_IN[builtIn].credit && <a className="k-xs sw-credit" href={BUILT_IN[builtIn].credit!.href} target="_blank" rel="noreferrer">{BUILT_IN[builtIn].credit!.text}</a>}
            {problem ? <p className="k-xs sw-problem">{problem}</p> : <p className="k-muted k-xs">Drop a model anywhere here (.glb, .gltf, .fbx, .obj, .dae, .usdz, .3mf, .stl, .ply), with the files that come with it (.bin, textures, .mtl). From Blender: File → Export → glTF 2.0.</p>}
            <input ref={file} type="file" accept=".glb,.gltf,.bin,.fbx,.obj,.mtl,.dae,.usdz,.usda,.3mf,.stl,.ply,.png,.jpg,.jpeg,.tga" multiple hidden onChange={(event) => { void open([...(event.target.files ?? [])]); event.target.value = ""; }} />
          </div>
          <div className="sw-group">
            <div className="sw-head"><h2 className="k-heading">Light rig</h2><span className="k-muted k-xs">drag the lights</span></div>
            <Rig rig={rig} onMove={(light, at) => setRig((old) => ({ ...old, [light]: at }))} />
          </div>
          <div className="sw-group">
            <h2 className="k-heading">Lights</h2>
            <label className="sw-row"><span>Key</span><Slider label="Key light" min={0} max={100} value={key} onChange={setKey} /><b>{key}</b></label>
            <label className="sw-row"><span>Fill</span><Slider label="Fill light" min={0} max={100} value={fill} onChange={setFill} /><b>{fill}</b></label>
            <label className="sw-row"><span>Rim</span><Slider label="Rim light" min={0} max={100} value={rim} onChange={setRim} /><b>{rim}</b></label>
          </div>
          <div className="sw-group">
            <h2 className="k-heading">Develop</h2>
            <label className="sw-row"><span>Brightness</span><Slider label="Brightness" min={-50} max={50} value={brightness} onChange={setBrightness} /><b>{brightness}</b></label>
            <label className="sw-row"><span>Contrast</span><Slider label="Contrast" min={0} max={100} value={contrast} onChange={setContrast} /><b>{contrast}</b></label>
            <label className="sw-row"><span>Lens</span><Slider label="Lens (field of view)" min={15} max={75} value={fov} onChange={setFov} /><b>{fov}°</b></label>
            <div className="sw-switches"><Switch checked={outline} onChange={setOutline}>Outline</Switch><Switch checked={dither} onChange={setDither}>Dither</Switch></div>
          </div>
          <div className="sw-group">
            <h2 className="k-heading">Background</h2>
            <div className="sw-backs" role="radiogroup" aria-label="Background">
              <button type="button" role="radio" aria-checked={background === "clear"} className="sw-back sw-back--clear" title={size === "sprite" ? "See-through (GB Studio's color 0)" : "None: the lightest shade"} onClick={() => setBackground("clear")}>{size === "sprite" ? "Clear" : "None"}</button>
              {([0, 1, 2, 3] as const).map((shade) => (
                <button key={shade} type="button" role="radio" aria-checked={background === shade} className="sw-back" style={{ background: ["#e0f8cf", "#86c06c", "#306850", "#071821"][shade] }}
                  disabled={size === "sprite" && shade === 0} title={size === "sprite" && shade === 0 ? "Sprites can't use shade 0 (it's see-through)" : `Shade ${shade}`} aria-label={`Shade ${shade}`} onClick={() => setBackground(shade)} />
              ))}
            </div>
          </div>
        </aside>
        <section className="sw-main">
          <div className="k-card sw-print-card">
            <div className="sw-head"><h2 className="k-heading">Print</h2><Segmented label="Print size" value={size} onChange={setSize} options={(Object.keys(SIZES) as Size[]).map((value) => ({ value, label: SIZES[value].label, title: SIZES[value].title }))} /></div>
            <div className="sw-frame"><canvas ref={print} className="sw-print" style={{ aspectRatio: `${settings.width} / ${settings.height}` }} title="Drag to turn the model, scroll to zoom" /></div>
            <div className="sw-head"><span className="k-muted k-xs">Drag the print to turn the model · scroll to zoom</span><Button variant="primary" icon={<CameraIcon />} onClick={take}>Take picture</Button></div>
          </div>
          <div className="sw-pictures">
            <div className="sw-head"><h2 className="k-heading">Pictures</h2><span className="k-muted k-xs">{pictures.length ? "Hover a picture: open it to paint, or send it to the project" : "Take picture adds the print here"}</span></div>
            <div className="sw-strip">
              {pictures.map((picture) => (
                <figure key={picture.id} className="sw-shot">
                  <img src={picture.url} alt={picture.name} />
                  <figcaption>{picture.name}<small>{picture.width} × {picture.height}</small></figcaption>
                  <span className="sw-shot-acts">
                    <IconButton label="Open as a new picture" size="sm" variant="primary" onClick={() => { onTake(picture); onClose(); }}><ImagePlus /></IconButton>
                    <IconButton label={onSend ? `Send to the project as a new ${picture.width === 32 ? "sprite" : "background"}` : "Open a project to send pictures to it"} size="sm" disabled={!onSend}
                      onClick={() => { const ready = forProject(picture); void onSend?.(ready.kind, ready.shot).then((made) => { if (made) onClose(); }); }}><FolderInput /></IconButton>
                    <IconButton label="Save as PNG… (anywhere on your computer)" size="sm" onClick={() => void fetch(picture.url).then((response) => response.blob()).then((blob) => onExport(blob, `${picture.name}.png`))}><Download /></IconButton>
                    <IconButton label="Throw away" size="sm" onClick={() => setPictures((list) => list.filter((item) => item.id !== picture.id))}><Trash2 /></IconButton>
                  </span>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </div>
      </div>
    </Dialog>
  );
}
