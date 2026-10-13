/**
 * The map generators (2026-10-10): a cave or dungeon, and an RPG-style overworld. Sliders on the left, the map on
 * the right, redrawn as they move, with the screen edges marked. Placeholder art (wireframe primitives in the four
 * shades, src/app/generators.ts) to paint over: opened as a new picture, or made a project background.
 */
import { Dices, Mountain, Pickaxe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { countUniqueTiles, toRgba } from "../paint";
import { Button, Chip, Dialog, IconButton, Segmented, Select, Slider, Switch } from "../ui/kit";
import { CAVE_THEMES, WORLD_THEMES, themeOf } from "./mapThemes";
import { CAVE_DEFAULTS, CAVE_WALLS, WORLD_DEFAULTS, drawCave, wallsOf, type CaveWalls, drawWorld, type CaveSettings, type CaveTiles, type Generated, type WorldSettings } from "./generators";
import type { Asset } from "./model";
import { autotileOf } from "./autotile";
import { defaultName, isSuggestedName, type NameKind } from "./names";
import { NameInput } from "./NameInput";
import "./GeneratorWizard.css";

export type GeneratorMode = "cave" | "world";

interface Props {
  mode: GeneratorMode;
  /** The open project's name (null: only Open as picture). */
  projectName: string | null;
  /** The scene's unique-tile limit, for the tile chip. */
  limit: number;
  onClose: () => void;
  onOpen: (picture: Generated, name: string) => void;
  onSave: (picture: Generated, name: string) => Promise<boolean>;
  /** Cuts it into one background per screen (sharing a tile at each edge) and lays them out as a Map Room map. */
  onSaveMap: (picture: Generated, name: string, columns: number, rows: number) => Promise<boolean>;
  /** The project's stamps a cave can be drawn with (Wall face F, Wang W, Wang edges E), and how to read one. */
  tileStamps: Asset[];
  loadTiles: (stamp: Asset) => Promise<CaveTiles | null>;
  /** Names the project's backgrounds already have (a suggested name is never one of them). */
  takenNames: string[];
}

const newSeed = () => Math.floor(Math.random() * 1_000_000);

/** A labelled slider with its value. */
function Setting({ label, value, unit = "", min, max, step, onChange, title }: { label: string; value: number; unit?: string; min: number; max: number; step?: number; onChange: (value: number) => void; title?: string }) {
  return (
    <div className="gw-setting" title={title}>
      <span className="gw-setting-head"><span className="k-label">{label}</span><span className="k-mono k-small">{value}{unit}</span></span>
      <Slider label={label} value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  );
}

export function GeneratorWizard({ mode, projectName, limit, onClose, onOpen, onSave, onSaveMap, tileStamps, loadTiles, takenNames }: Props) {
  const [cave, setCave] = useState<CaveSettings>(() => ({ ...CAVE_DEFAULTS, seed: newSeed(), theme: "V20-5-Stone" }));
  const [world, setWorld] = useState<WorldSettings>(() => ({ ...WORLD_DEFAULTS, seed: newSeed() }));
  // A random "Kind-Name" (the author, 2026-10-12): Cave- or Dungeon- follows the style while it's still a suggestion.
  const nameKind = (style = cave.style): NameKind => mode === "world" ? "Overworld" : style === "dungeon" ? "Dungeon" : "Cave";
  const [name, setName] = useState(() => defaultName(nameKind(), takenNames));
  const rollName = (kind = nameKind()) => setName(() => defaultName(kind, takenNames));
  const [busy, setBusy] = useState(false);
  const setC = (change: Partial<CaveSettings>) => setCave((old) => ({ ...old, ...change }));
  const setW = (change: Partial<WorldSettings>) => setWorld((old) => ({ ...old, ...change }));
  const themes = mode === "cave" ? CAVE_THEMES : WORLD_THEMES;
  const theme = themeOf(themes, (mode === "cave" ? cave.theme : world.theme) ?? "");
  const columns = mode === "cave" ? cave.columns : world.columns, rows = mode === "cave" ? cave.rows : world.rows;

  // Own tiles: the cave's from an F / W / E stamp; the overworld's shores from a C stamp and roads from a P stamp.
  const [tilesFile, setTilesFile] = useState("");
  const [shoreFile, setShoreFile] = useState("");
  const [roadFile, setRoadFile] = useState("");
  const [sheet, setSheet] = useState<CaveTiles | null>(null);
  const [shore, setShore] = useState<CaveTiles | null>(null);
  const [road, setRoad] = useState<CaveTiles | null>(null);
  const useSheet = (file: string, set: (sheet: CaveTiles | null) => void) => useEffect(() => {
    let live = true;
    const stamp = tileStamps.find((item) => item.file === file);
    if (!stamp) { set(null); return; }
    void loadTiles(stamp).then((loaded) => { if (live) set(loaded); });
    return () => { live = false; };
  }, [file]);
  useSheet(tilesFile, setSheet);
  useSheet(shoreFile, setShore);
  useSheet(roadFile, setRoad);
  const stampsOf = (...kinds: string[]) => tileStamps.filter((stamp) => kinds.includes(stamp.autotile ?? ""));
  const stampOptions = (kinds: string[], none: string) => [{ value: "placeholder", label: none }, ...stampsOf(...kinds).map((stamp) => { const glyph = autotileOf(stamp.autotile)?.glyph ?? ""; return { value: stamp.file, label: stamp.name.endsWith(`(${glyph})`) ? stamp.name : `${stamp.name} (${glyph})` }; })];
  const picture = useMemo(() => mode === "cave" ? drawCave(cave, sheet) : drawWorld(world, { shore, road }), [mode, cave, world, sheet, shore, road]);
  const tiles = useMemo(() => countUniqueTiles(picture.pixels, picture.width, picture.height, false), [picture]);

  // A state ref: the dialog mounts its content after this component's first effects, so redraw when the canvas arrives.
  const [target, setTarget] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!target) return;
    Object.assign(target, { width: picture.width, height: picture.height });
    const cells = picture.cells ?? new Uint8Array(Math.ceil(picture.width / 8) * Math.ceil(picture.height / 8));
    target.getContext("2d")!.putImageData(new ImageData(toRgba(picture.pixels, cells, picture.width, picture.palettes ?? []), picture.width, picture.height), 0, 0);
  }, [picture, target]);

  const valid = /^[\w ()\-.]+$/.test(name.trim());
  async function save() {
    setBusy(true);
    const done = await onSave(picture, name.trim());
    setBusy(false);
    if (done) onClose();
  }
  async function saveMap() {
    setBusy(true);
    const done = await onSaveMap(picture, name.trim(), columns, rows);
    setBusy(false);
    if (done) onClose();
  }

  const reroll = <IconButton label="New layout (another seed)" onClick={() => mode === "cave" ? setC({ seed: newSeed() }) : setW({ seed: newSeed() })}><Dices /></IconButton>;
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }} wide tall
      title={mode === "cave" ? "Cave or dungeon" : "Overworld"} icon={mode === "cave" ? <Pickaxe size={18} /> : <Mountain size={18} />}
      sub={mode === "cave" ? "A cave or dungeon in the catalog's art, sized in screens" : "An RPG-style overworld in the catalog's art: water, forest, mountains, towns"}
      footer={<>
        <span className="k-spacer" />
        <Button onClick={() => { onOpen(picture, name.trim() || "Map"); onClose(); }} disabled={busy}>Open as picture</Button>
        {columns * rows > 1 && <Button disabled={!projectName || !valid || busy} title={!projectName ? "Open a GB Studio project first" : `Makes ${columns * rows} backgrounds (${name.trim()} 1-1 …), one per screen sharing a tile at each edge, and a Map Room map of them`} onClick={() => void saveMap()}>Make map ({columns * rows} screens)</Button>}
        <Button variant="primary" disabled={!projectName || !valid || busy} title={!projectName ? "Open a GB Studio project first" : valid ? `Makes assets/backgrounds/${name.trim()}.png (never replaces a file)` : "Give it a name (letters, digits, spaces, - _ ( ) .)"} onClick={() => void save()}>{busy ? "Making…" : "Make background"}</Button>
      </>}>
      <div className="gw">
        <div className="gw-controls k-stack">
          <div className="k-stack k-stack--tight">
            <span className="k-label">Name</span>
            <NameInput kind={nameKind()} value={name} onChange={setName} taken={takenNames} />
          </div>
          <div className="k-stack k-stack--tight" title={theme ? `${theme.palettes.length === 7 ? "7 terrain palettes made from these colors" : `${theme.palettes.length} palette${theme.palettes.length === 1 ? "" : "s"}`}; Make background adds ${theme.palettes.length === 1 ? "it" : "them"} to the project` : undefined}>
            <Select label="Palettes" value={(mode === "cave" ? cave.theme : world.theme) || "greens"} onChange={(id) => mode === "cave" ? setC({ theme: id === "greens" ? "" : id }) : setW({ theme: id === "greens" ? "" : id })}
              options={[{ value: "greens", label: "GB greens" }, ...themes.map((theme) => ({ value: theme.id, label: theme.name }))]} />
            <span className="k-muted k-xs">{theme ? theme.credit : "No palettes: the greens"}</span>
          </div>
          {mode === "cave" && <div className="k-stack k-stack--tight" title="The catalog's walls (Cliff XP for caves, Stone wall for dungeons) or one of the project's auto-tile stamps: Wall face (F) for floor, walls and nothing; Wang (W) or Wang edges (E) for the rock">
            <Select label="Walls" value={tilesFile || `cat:${wallsOf(cave)}`} onChange={(file) => { if (file.startsWith("cat:")) { setTilesFile(""); setC({ walls: file.slice(4) as CaveWalls }); } else setTilesFile(file); }}
              options={[...CAVE_WALLS.map(({ value, label }) => ({ value: `cat:${value}`, label })), ...stampOptions(["wallface", "wang", "edges"], "").slice(1)]} />
            <span className="k-muted k-xs">{stampsOf("wallface", "wang", "edges").length ? (tilesFile ? "Your stamp's tiles; Make background keeps them" : "Or one of your F, W or E stamps") : "Stamps marked F, W or E (Asset Catalog → Auto-tiles) can draw it"}</span>
          </div>}
          {mode === "world" && <div className="k-stack k-stack--tight" title="Draw the overworld's water edges with a corner-Wang (C) stamp and its roads with a path (P) stamp">
            <Select label="Shores" value={shoreFile || "placeholder"} onChange={(file) => setShoreFile(file === "placeholder" ? "" : file)} options={stampOptions(["corner"], "Catalog shores")} />
            <Select label="Roads" value={roadFile || "placeholder"} onChange={(file) => setRoadFile(file === "placeholder" ? "" : file)} options={stampOptions(["path"], "Catalog roads")} />
            <span className="k-muted k-xs">{stampsOf("corner", "path").length ? "Your C stamp for shores, your P stamp for roads" : "Stamps marked C or P (Asset Catalog → Auto-tiles: Overworld shore, Overworld road) can draw them"}</span>
          </div>}
          {mode === "cave" && <Segmented fill size="sm" label="Style" value={cave.style} onChange={(style) => { setC({ style, walls: undefined }); if (isSuggestedName(nameKind(), name)) rollName(nameKind(style)); }} options={[{ value: "cave", label: "Cave" }, { value: "dungeon", label: "Dungeon" }]} />}
          <Setting label="Screens wide" value={columns} min={1} max={mode === "cave" ? 4 : 6} onChange={(value) => mode === "cave" ? setC({ columns: value }) : setW({ columns: value })} />
          <Setting label="Screens tall" value={rows} min={1} max={mode === "cave" ? 4 : 6} onChange={(value) => mode === "cave" ? setC({ rows: value }) : setW({ rows: value })} />
          {mode === "cave" && <>
            <div className="k-stack k-stack--tight">
              <span className="k-label">Cells</span>
              <Segmented fill size="sm" label="Cell size" value={String(cave.cell)} onChange={(value) => { const cell = Number(value) as 8 | 16 | 32; setC({ cell, roomSize: Math.min(10, Math.max(3, Math.round(cave.roomSize * cave.cell / cell))) }); }} options={[{ value: "32", label: "32 px", title: "4 × 4 tiles a cell: big rooms and halls" }, { value: "16", label: "16 px", title: "2 × 2 tiles a cell: broad passages" }, { value: "8", label: "8 px", title: "One tile a cell: twisty passages" }]} />
            </div>
            {cave.style === "cave" ? <>
              <Setting label="Rock" value={cave.fill} unit="%" min={30} max={62} onChange={(fill) => setC({ fill })} title="How much starts as rock: more is tighter" />
              <Setting label="Smoothing" value={cave.smooth} min={0} max={8} onChange={(smooth) => setC({ smooth })} title="Passes that round the walls off" />
              <Switch checked={cave.connected} onChange={(connected) => setC({ connected })}>One connected cave</Switch>
            </> : <>
              <Setting label="Rooms" value={cave.rooms} min={2} max={20} onChange={(rooms) => setC({ rooms })} />
              <Setting label="Room size" value={cave.roomSize} min={3} max={10} onChange={(roomSize) => setC({ roomSize })} title="Typical room size, in cells" />
            </>}
            <Switch checked={cave.stairs} onChange={(stairs) => setC({ stairs })}>Stairs at the far ends</Switch>
          </>}
          {mode === "world" && <>
            <Setting label="Water" value={world.water} unit="%" min={0} max={80} onChange={(water) => setW({ water })} />
            <Setting label="Mountains" value={world.mountains} unit="%" min={0} max={60} onChange={(mountains) => setW({ mountains })} title="Share of the land" />
            <Setting label="Forest" value={world.forest} unit="%" min={0} max={80} onChange={(forest) => setW({ forest })} title="Share of the lowland" />
            <Setting label="Towns" value={world.towns} min={0} max={8} onChange={(towns) => setW({ towns })} />
            <Setting label="Feature size" value={world.scale} min={2} max={12} onChange={(scale) => setW({ scale })} title="Bigger: broader land and seas" />
            <Switch checked={world.island} onChange={(island) => setW({ island })}>Island (water all round)</Switch>
            <Switch checked={world.roads} onChange={(roads) => setW({ roads })}>Roads between towns</Switch>
          </>}
          <span className="k-row"><span className="k-label">Layout</span><span className="k-mono k-small k-muted">#{mode === "cave" ? cave.seed : world.seed}</span><span className="k-spacer" />{reroll}</span>
        </div>
        <div className="gw-stage">
          <div className="gw-frame" style={{ ["--gw-ratio" as string]: picture.width / picture.height }}>
            <div className="gw-map" style={{ ["--gw-cols" as string]: columns, ["--gw-rows" as string]: rows }}>
              <canvas ref={setTarget} aria-label="Generated map" />
              <span className="gw-screens" aria-hidden />
            </div>
          </div>
          <span className="k-row">
            <Chip>{picture.width} × {picture.height} px</Chip>
            <Chip>{columns} × {rows} screens</Chip>
            <Chip tone={tiles > limit ? "warn" : undefined} title="Unique 8 × 8 tiles; GB Studio's limit for one background">{tiles} / {limit} unique tiles</Chip>
            <span className="k-muted k-xs">The catalog's art: paint over it as you like. Cyan lines are screen edges.</span>
          </span>
        </div>
      </div>
    </Dialog>
  );
}
