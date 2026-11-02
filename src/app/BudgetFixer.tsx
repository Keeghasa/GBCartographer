/**
 * Tile budget fixer (W6): gets a picture under GB Studio's tile limit by merging near-duplicate tiles one step at a
 * time. A copy of the picture is worked on: pick the merges (all checked at first), see each one before and after,
 * merge, undo inside the window, and only "Apply to picture" hands the pixels back (the parent makes it one undo step).
 * The author, 2026-11-02: a heat map of where the tiles go, "Fix all" down to a target in one undo step, and a
 * choice between the GB limit (192) and Color Only (384, flipped copies count once), which the count and merges follow.
 */
import { LOGO_TILES, UNIQUE_TILE_LIMITS, logoHelps } from "../gb/limits";
import { ArrowRight, CircleCheck, Sparkles, Undo2, Wand2 } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { countUniqueTiles, tileUsage, toRgba } from "../paint";
import { Button, Chip, Checkbox, Field, Meter, Segmented, Slider, Switch } from "../ui/kit";
import { applyMerges, fixAll, mergeSteps, stepTile, tilePixels, type MergeStep } from "./budgetSteps";
import { WizardPage } from "./WizardPage";
import { useWizardSettings } from "./useWizardSettings";
import "./BudgetFixer.css";

export interface BudgetFixerProps {
  /** The open picture (a copy is worked on; nothing changes until Apply). */
  picture: { name: string; pixels: Uint8Array; cells: Uint16Array; width: number; height: number; palettes: { name: string; colors: string[] }[] };
  /** The budget it opens with: the tile limit and whether flipped tiles merge (Color Only). */
  limit: number; flips: boolean;
  onClose: () => void;
  /** Applies the merged pixels to the picture (the parent makes it one undo step). */
  onApply: (pixels: Uint8Array) => void;
}

/** Rows drawn at most; the rest still merge when checked. */
const SHOWN = 200;
/** Undo steps kept inside the window. */
const HISTORY = 50;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The heat map's steps: tiles used once are hot (each costs a whole tile on its own), tiles shared by many cool. */
const HEAT: { upTo: number; rgb: string; alpha: number; label: string }[] = [
  { upTo: 1, rgb: "235, 64, 52", alpha: 150, label: "Used once" },
  { upTo: 2, rgb: "245, 160, 40", alpha: 120, label: "Twice" },
  { upTo: 4, rgb: "230, 220, 70", alpha: 90, label: "3–4" },
  { upTo: 8, rgb: "90, 200, 140", alpha: 80, label: "5–8" },
  { upTo: Infinity, rgb: "60, 130, 230", alpha: 80, label: "More" },
];

/** The heat map's colour (RGBA) for a tile shown `uses` times. */
export function heatColor(uses: number): number[] {
  const step = HEAT.find((item) => uses <= item.upTo)!;
  return [...step.rgb.split(", ").map(Number), step.alpha];
}

/** The heat map: one pixel per tile, stretched over the picture (pixelated). */
function Heat({ uses, columns, rows }: { uses: Uint16Array; columns: number; rows: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const data = new ImageData(columns, rows);
    uses.forEach((count, cell) => data.data.set(heatColor(count), cell * 4));
    canvas.current?.getContext("2d")!.putImageData(data, 0, 0);
  }, [uses, columns, rows]);
  return <canvas ref={canvas} className="bf-heat" width={columns} height={rows} aria-hidden />;
}

/** An 8 × 8 tile, drawn 4× and pixelated by CSS. */
const Thumb = memo(function Thumb({ rgba, label }: { rgba: Uint8ClampedArray; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { canvas.current?.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(rgba), 8, 8), 0, 0); }, [rgba]);
  return <canvas ref={canvas} className="bf-thumb" width={8} height={8} role="img" aria-label={label} title={label} />;
});

/** The whole picture with one tile outlined; `patch` (that tile's new look) is drawn over it for the "after". */
function Shot({ image, tile, patch, heat, label }: { image: ImageData; tile: number | null; patch?: Uint8ClampedArray | null; heat?: Uint16Array | null; label: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const patched = useRef<number | null>(null);
  const { width, height } = image;
  const cw = Math.ceil(width / 8);
  const at = (cell: number) => [(cell % cw) * 8, Math.floor(cell / cw) * 8] as const;
  // The whole picture, once per change of the picture.
  useEffect(() => { canvas.current?.getContext("2d")!.putImageData(image, 0, 0); patched.current = null; }, [image]);
  // The merged tile on top; the last one is put back first (only its 8 × 8 is redrawn).
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    if (patched.current !== null) { const [x, y] = at(patched.current); context.putImageData(image, 0, 0, x, y, 8, 8); patched.current = null; }
    if (patch && tile !== null) { const [x, y] = at(tile); context.putImageData(new ImageData(new Uint8ClampedArray(patch), 8, 8), x, y); patched.current = tile; }
  }, [image, patch, tile]);
  const [x, y] = tile === null ? [0, 0] : at(tile);
  // The heat map covers whole tiles, so it runs a little past a picture whose size isn't a multiple of 8.
  const rows = Math.ceil(height / 8);
  return (
    <figure className="bf-shot">
      <figcaption className="k-eyebrow">{label}</figcaption>
      <div className="bf-frame">
        <div className="bf-canvas" style={{ width: `min(100%, ${(200 * width) / height}px)`, aspectRatio: `${width} / ${height}` }}>
          <canvas ref={canvas} width={width} height={height} />
          {heat && <div className="bf-heat-box" style={{ width: `${(cw * 8 * 100) / width}%`, height: `${(rows * 8 * 100) / height}%` }}><Heat uses={heat} columns={cw} rows={rows} /></div>}
          {tile !== null && <span className="bf-outline" style={{ left: `${(x / width) * 100}%`, top: `${(y / height) * 100}%`, width: `${(8 / width) * 100}%`, height: `${(8 / height) * 100}%` }} />}
        </div>
      </div>
    </figure>
  );
}

/** The two tile budgets to choose between. */
type Budget = "gb" | "colorOnly";

export function BudgetFixer({ picture, limit: openLimit, flips: openFlips, onClose, onApply }: BudgetFixerProps) {
  const { width, height, cells, palettes } = picture;
  // The budget the window opened with is the default; the other one is GB Studio's own limit.
  const [budget, setBudget] = useState<Budget>(openFlips ? "colorOnly" : "gb");
  const gbLimit = openFlips ? UNIQUE_TILE_LIMITS.monochrome : openLimit;
  const colorOnlyLimit = openFlips ? openLimit : UNIQUE_TILE_LIMITS.colorOnly;
  const flips = budget === "colorOnly";
  const limit = flips ? colorOnlyLimit : gbLimit;
  // Remembered per project, with presets (the author, 2026-11-02); the budget follows the scene it opened for.
  const ws = useWizardSettings("budget", { heatOn: false, maxDiff: 3 });
  const [heatOn, setHeatOn] = ws.field("heatOn");
  // Fix all's target; null follows the limit.
  const [target, setTarget] = useState<number | null>(null);
  const [working, setWorking] = useState(() => picture.pixels.slice());
  const [history, setHistory] = useState<Uint8Array[]>([]);
  const [maxDiff, setMaxDiff] = ws.field("maxDiff");
  // The candidate list and what it was built from (a stale list can't be merged).
  const [found, setFound] = useState<{ steps: MergeStep[]; pixels: Uint8Array; maxDiff: number; flips: boolean } | null>(null);
  const [unchecked, setUnchecked] = useState<ReadonlySet<number>>(() => new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [note, setNote] = useState("");

  // The tile comparisons, once per slider change, budget change or merge, a beat after the last one.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFound({ steps: mergeSteps(working, width, height, flips, maxDiff), pixels: working, maxDiff, flips });
      setUnchecked(new Set());
    }, 60);
    return () => window.clearTimeout(timer);
  }, [working, width, height, flips, maxDiff]);

  const busy = !found || found.pixels !== working || found.maxDiff !== maxDiff || found.flips !== flips;
  const steps = useMemo(() => found?.steps ?? [], [found]);
  const checked = useMemo(() => steps.filter((step) => !unchecked.has(step.from)), [steps, unchecked]);
  const now = useMemo(() => countUniqueTiles(working, width, height, flips), [working, width, height, flips]);
  const after = useMemo(() => {
    if (busy || !checked.length) return now;
    const copy = working.slice();
    applyMerges(copy, width, checked);
    return countUniqueTiles(copy, width, height, flips);
  }, [busy, checked, now, working, width, height, flips]);

  const image = useMemo(() => new ImageData(new Uint8ClampedArray(toRgba(working, cells, width, palettes)), width, height), [working, cells, width, height, palettes]);
  // A tile as it looks in `place`'s palette (the merged tile keeps its cell's palette).
  const look = (tile: Uint8Array, place: number) => toRgba(tile, Uint16Array.of(cells[place] ?? 0), 8, palettes);
  // Thumbnails once per list (a list is only ever built from the current pixels).
  const shown = useMemo(() => steps.slice(0, SHOWN), [steps]);
  const thumbs = useMemo(() => new Map(shown.map((step) => [step.from, { from: look(tilePixels(working, width, height, step.from), step.from), into: look(stepTile(working, width, height, step), step.from) }])), [shown]);
  // Where the tiles go: per tile, how many tiles share its pattern (flipped copies too, in Color Only).
  const heat = useMemo(() => heatOn ? tileUsage(working, width, height, flips, 0).uses : null, [heatOn, working, width, height, flips]);
  const goal = Math.min(target ?? limit, Math.max(now, 1));

  const current = shown.find((step) => step.from === (hovered ?? selected)) ?? shown[0] ?? null;
  const cw = Math.ceil(width / 8);
  const where = (tile: number) => `Tile ${tile % cw + 1}, ${Math.floor(tile / cw) + 1}`;
  const flipWord = (flip = 0) => ["", ", flipped left-right", ", flipped upside down", ", flipped both ways"][flip];

  const toggle = (from: number, on: boolean) => setUnchecked((old) => { const next = new Set(old); if (on) next.delete(from); else next.add(from); return next; });
  const keep = (next: Uint8Array) => {
    setHistory((old) => [...old.slice(1 - HISTORY), working]);
    setWorking(next);
    setSelected(null);
    setHovered(null);
  };
  const merge = () => {
    if (busy || !checked.length) return;
    const next = working.slice();
    const applied = applyMerges(next, width, checked);
    if (!applied) return;
    keep(next);
    setNote(`Merged ${plural(applied, "tile")}${applied < checked.length ? `; ${checked.length - applied} more wait for the next round (they touched a tile just merged)` : ""}.`);
  };
  // Fix all: merges down to the target in one go; one undo step undoes the whole batch.
  const fix = () => {
    if (now <= goal) return;
    const next = working.slice();
    const result = fixAll(next, width, height, flips, goal);
    if (!result.merged) { setNote("Nothing left to merge: every tile is shared."); return; }
    keep(next);
    setNote(`Merged ${plural(result.merged, "tile")} in one go: ${result.count} unique now${result.reached ? "" : `, not down to ${goal} (every tile left is shared)`}. Undo brings them all back.`);
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(history.slice(0, -1));
    setWorking(last);
    setSelected(null);
    setNote("Undid the last merge step.");
  };

  const under = now <= limit;
  return (
    <WizardPage tools={ws.bar} title="Tile budget fixer" icon={<Sparkles size={18} />} onClose={onClose}
      line={["One safe step at a time", `${picture.name} · under GB Studio's tile limit`]}
      footer={<>
        <span className="k-muted k-small">{history.length ? `${plural(history.length, "merge step")} made here` : "Nothing changes in the picture until you apply"}</span>
        <span className="k-spacer" />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!history.length} onClick={() => { onApply(working); onClose(); }}>Apply to picture</Button>
      </>}>
      <div className="k-stack">
        <div className="k-row">
          <Segmented<Budget> label="Tile budget" value={budget} onChange={(next) => { setBudget(next); setTarget(null); }} options={[
            { value: "gb", label: `GB · ${gbLimit} tiles`, title: "GB and GB + Color scenes: every different tile counts" },
            { value: "colorOnly", label: `Color Only · ${colorOnlyLimit} tiles`, title: "Color Only scenes: flipped copies (left-right, upside down or both) count once" },
          ]} />
          <span className="k-spacer" />
          <Switch checked={heatOn} onChange={setHeatOn}>Show where the tiles go</Switch>
        </div>
        <Meter label="Now" value={now} of={limit} tone={now > limit ? "bad" : undefined} title={flips ? "Unique tiles (flipped copies count once, as in a Color Only scene)" : "Unique tiles"} />
        <Meter label="After" value={after} of={limit} tone={after > limit ? "bad" : undefined} title="If the checked merges are made" />
        {logoHelps(picture.width, picture.height, limit) && <Meter label="Logo" value={now} of={LOGO_TILES} tone={now > LOGO_TILES ? "bad" : undefined} title="As a Logo scene (static: no text, menus or actors) GB Studio lets one screen use every tile, up to 360" />}
        <Field label={`Merge tiles that differ by at most ${plural(maxDiff, "pixel")}`}
          hint={busy ? "Comparing tiles…" : steps.length ? `${plural(steps.length, "tile")} used once ${steps.length === 1 ? "is" : "are"} this close to another${flips ? " (or a flip of it)" : ""}; undo brings them back` : `No tile used once is within ${plural(maxDiff, "pixel")} of another`}>
          <Slider label="Pixels that may differ" value={maxDiff} onChange={setMaxDiff} min={1} max={16} />
        </Field>
        <Field label={`Fix all in one go, down to ${plural(goal, "tile")}`} hint="Closest tiles first, allowing more differing pixels only when needed; one undo brings the whole batch back">
          <div className="k-row">
            <span className="bf-target"><Slider label="Target tile count" value={goal} onChange={setTarget} min={1} max={Math.max(now, limit, 1)} /></span>
            <Button icon={<Wand2 />} disabled={now <= goal} onClick={fix}>Fix all</Button>
          </div>
        </Field>
        {under && <div className="bf-under"><CircleCheck size={16} />Under the limit — nothing more needed</div>}

        <div className="bf-body">
          <div className="k-stack k-stack--tight">
            <div className="k-row">
              <span className="k-eyebrow">Merges</span>
              {steps.length > 0 && <Chip>{checked.length} of {steps.length} checked</Chip>}
              <span className="k-spacer" />
              <Button size="sm" variant="ghost" disabled={!steps.length} onClick={() => setUnchecked(checked.length ? new Set(steps.map((step) => step.from)) : new Set())}>{checked.length ? "Uncheck all" : "Check all"}</Button>
            </div>
            <div className="bf-list k-well" role="list" aria-busy={busy} onMouseLeave={() => setHovered(null)}>
              {shown.map((step) => {
                const thumb = thumbs.get(step.from);
                return (
                  <div key={step.from} role="listitem" className={`bf-row${current?.from === step.from ? " is-on" : ""}`} onMouseEnter={() => setHovered(step.from)} onClick={() => setSelected(step.from)} onFocus={() => setSelected(step.from)}>
                    <Checkbox checked={!unchecked.has(step.from)} onChange={(on) => toggle(step.from, on)}><span className="bf-where">{where(step.from)}</span></Checkbox>
                    <span className="k-spacer" />
                    {thumb && <><Thumb rgba={thumb.from} label={`${where(step.from)} now`} /><ArrowRight size={14} className="k-muted" /><Thumb rgba={thumb.into} label={`Becomes a copy of ${where(step.into).toLowerCase()}${flipWord(step.flip)}`} /></>}
                    <span className="bf-diff k-small">{plural(step.diff, "px")} differ</span>
                  </div>
                );
              })}
              {!steps.length && <p className="bf-empty k-muted k-small">{busy ? "Comparing tiles…" : under ? "Nothing to merge." : "Nothing this close: allow more differing pixels."}</p>}
              {steps.length > SHOWN && <p className="bf-empty k-muted k-xs">{steps.length - SHOWN} more not shown; checked ones merge too.</p>}
            </div>
            <div className="k-row">
              <Button disabled={busy || !checked.length} onClick={merge}>Merge checked</Button>
              <Button icon={<Undo2 />} disabled={!history.length} onClick={undo}>Undo last step</Button>
            </div>
            {note && <span className="k-muted k-xs" role="status">{note}</span>}
          </div>
          <div className="k-stack k-stack--tight">
            <Shot image={image} tile={current?.from ?? null} heat={heat} label={current ? <>Before · {where(current.from)}</> : "The picture"} />
            {heat && <span className="bf-legend k-xs k-muted">{HEAT.map((step) => <span key={step.label}><i style={{ background: `rgb(${step.rgb})` }} />{step.label}</span>)}</span>}
            {current && <Shot image={image} tile={current.from} patch={thumbs.get(current.from)?.into} label={<>After · a copy of {where(current.into).toLowerCase()}{flipWord(current.flip)}</>} />}
          </div>
        </div>
      </div>
    </WizardPage>
  );
}
