/** The paint tools: one button per tool, the view and painting toggles, and the brush size for the tool in hand. */
import { Contrast, Dna, FlipHorizontal, FlipVertical, Grid2x2, Minus, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { PATTERNS, inPattern, type Mirror, type Pattern } from "../paint";
import { type ToolId } from "./model";

/** One mirror axis switched on or off, the other kept. */
const toggleMirror = (mirror: Mirror, axis: "x" | "y"): Mirror => { const x = mirror === "x" || mirror === "xy", y = mirror === "y" || mirror === "xy"; const nx = axis === "x" ? !x : x, ny = axis === "y" ? !y : y; return nx && ny ? "xy" : nx ? "x" : ny ? "y" : "off"; };
import { TILE_TOOLS, TOOLS } from "./tools";
import { Button, IconButton } from "../ui/kit";
import { PhCheckerboard } from "../ui/setIcons";

interface Props {
  tool: ToolId; onTool: (tool: ToolId) => void;
  seamless: boolean; onSeamless: (on: boolean) => void;
  /** The draft layer: on while the open picture has one. */
  draft: boolean; onDraft: () => void;
  /** Commit the draft (shown under Draft while it has new pixels). */
  draftChanged: boolean; onCommit: () => void;
  linked: boolean; onLinked: (on: boolean) => void;
  mirror: Mirror; onMirror: (mirror: Mirror) => void;
  /** Invert: the selection's (or the picture's) shades turned over, lightest ↔ darkest. */
  onInvert: () => void;
  pattern: Pattern; onPattern: () => void;
  cellBrush: number; onCellBrush: (size: number) => void;
  brush: number; onBrush: (size: number) => void;
  /** The shade in hand (0–3) and the four colors it is shown in (the picked palette, or the look). */
  shade: number; shades: readonly string[];
}

/**
 * What a fill pattern makes (the author, 2026-10-12): the pattern tiled across 16 × 16 pixels, pixel for pixel, in the
 * shade in hand over a contrasting one, in the colors of the palette in use. Click cycles the pattern, like D.
 */
function PatternSwatch({ pattern, label, shade, shades, onPattern }: { pattern: Pattern; label: string; shade: number; shades: readonly string[]; onPattern: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ink = shade >= 0 && shade <= 3 ? shade : 3, paper = ink === 0 ? 3 : 0;
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
      context.fillStyle = shades[inPattern(pattern, x, y) ? ink : paper] ?? "#000";
      context.fillRect(x, y, 1, 1);
    }
  }, [pattern, ink, paper, shades.join()]);
  return (
    <button type="button" className="k-btn app-pattern" title={`${label}: what a fill makes, 16 × 16 px (click for the next pattern, or D)`} aria-label={`Fill pattern preview: ${label}`} onClick={onPattern}>
      <canvas ref={canvas} width={16} height={16} />
    </button>
  );
}

export function ToolColumn({ tool, onTool, draft, onDraft, draftChanged, onCommit, seamless, onSeamless, linked, onLinked, mirror, onMirror, onInvert, pattern, onPattern, cellBrush, onCellBrush, brush, onBrush, shade, shades }: Props) {
  const patternLabel = PATTERNS.find((item) => item.id === pattern)?.label;
  return (
    <aside className="k-panel app-tools gbp-tools" role="toolbar" aria-label="Paint tools">
      {TOOLS.filter(([id]) => !TILE_TOOLS.includes(id)).map(([id, label, Icon, keys]) => <IconButton key={id} label={label} keys={keys} pressed={tool === id} onClick={() => onTool(id)}><Icon size={17} /></IconButton>)}
      <hr />
      {/* The tile tools on their own (the author, 2026-10-14): palette brush and fill, priority, collision. */}
      {TOOLS.filter(([id]) => TILE_TOOLS.includes(id)).map(([id, label, Icon, keys]) => <IconButton key={id} label={label} keys={keys} pressed={tool === id} onClick={() => onTool(id)}><Icon size={17} /></IconButton>)}
      <hr />
      <IconButton label="Seamless view: the tile under the pointer (or the selection) repeated 3 × 3" aria-label="Seamless view" pressed={seamless} onClick={() => onSeamless(!seamless)}><Grid2x2 size={17} /></IconButton>
      <IconButton label="Linked tiles: painting a tile paints every identical copy" keys="K" aria-label="Linked tiles" pressed={linked} onClick={() => onLinked(!linked)}><Dna size={17} /></IconButton>
      {/* Mirror as two toggles (the author, 2026-10-13): left-right and top-bottom, both on for all four quarters. */}
      <IconButton label="Mirror left-right: paint both halves at once (Shift+M steps through off, ↔, ↕, both)" keys="Shift+M" aria-label="Mirror left-right" pressed={mirror === "x" || mirror === "xy"} onClick={() => onMirror(toggleMirror(mirror, "x"))}><FlipHorizontal size={17} /></IconButton>
      <IconButton label="Mirror top-bottom: paint the top and bottom halves at once" aria-label="Mirror top-bottom" pressed={mirror === "y" || mirror === "xy"} onClick={() => onMirror(toggleMirror(mirror, "y"))}><FlipVertical size={17} /></IconButton>
      <IconButton label="Invert: the selection's shades turned over (lightest ↔ darkest), or the whole picture's" keys="Ctrl+I" aria-label="Invert" onClick={onInvert}><Contrast size={17} /></IconButton>
      {(tool === "patternFill" || tool === "patternRect") && <IconButton label={`Fill pattern: ${patternLabel}`} keys="D" aria-label={`Fill pattern: ${patternLabel}`} pressed={pattern !== "solid"} onClick={onPattern}><PhCheckerboard size={17} /></IconButton>}
      <hr />
      {tool === "palette" || tool === "priority" ? (
        <span className="app-size" role="group" aria-label="Palette brush size">
          <IconButton label="Smaller palette brush" keys="[" variant="ghost" disabled={cellBrush <= 1} onClick={() => onCellBrush(cellBrush - 1)}><Minus /></IconButton>
          {cellBrush}×{cellBrush}
          <IconButton label="Bigger palette brush" keys="]" variant="ghost" disabled={cellBrush >= 3} onClick={() => onCellBrush(cellBrush + 1)}><Plus /></IconButton>
        </span>
      ) : (
        <span className="app-size" role="group" aria-label="Brush size">
          <IconButton label="Smaller brush" keys="[" variant="ghost" disabled={brush <= 1} onClick={() => onBrush(brush - 1)}><Minus /></IconButton>
          {brush} px
          <IconButton label="Bigger brush" keys="]" variant="ghost" disabled={brush >= 16} onClick={() => onBrush(brush + 1)}><Plus /></IconButton>
        </span>
      )}
      {/* The draft layer under the brush size, full width (the author, 2026-10-15). */}
      <Button size="sm" block className="app-draft" pressed={draft} title="Draft layer: the old picture fades so what you paint stands out; Commit or Wipe it in the strip" onClick={onDraft}>Draft</Button>
      {draft && <Button size="sm" block variant="primary" className="app-draft" disabled={!draftChanged} title="Keep the draft as part of the picture (one undo takes it back)" onClick={onCommit}>Commit</Button>}
      {(tool === "patternFill" || tool === "patternRect") && <PatternSwatch pattern={pattern} label={patternLabel ?? pattern} shade={shade} shades={shades} onPattern={onPattern} />}
    </aside>
  );
}
