/**
 * The collision brush's strip above the picture (the author's pick, 2026-10-11): which scene (when several show the
 * background) and which of its scene type's collision tiles to paint, drawn as GB Studio draws them. Click picks one;
 * Shift-click adds or drops a one-way side, so they combine. A background GB Studio hasn't put in a scene gets a note.
 */
import { Eraser } from "lucide-react";
import { useEffect, useRef } from "react";
import { Select } from "../ui/kit";
import { iconPixels, type CollisionTileDef } from "../gb/collisions";
import type { DocCollisions } from "./model";

/** A collision tile's icon in its color, 16 × 16. */
export function CollisionIcon({ def }: { def: CollisionTileDef }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, 8, 8);
    context.fillStyle = def.color.slice(0, 7);
    iconPixels(def.icon).forEach((on, at) => { if (on) context.fillRect(at % 8, Math.floor(at / 8), 1, 1); });
  }, [def]);
  return <canvas ref={canvas} width={8} height={8} className="app-collision-icon" aria-hidden="true" />;
}

const TYPE_NAMES: Record<string, string> = { TOPDOWN: "Top-down", PLATFORM: "Platformer", ADVENTURE: "Adventure", SHMUP: "Shoot 'em up", POINTNCLICK: "Point and click", LOGO: "Logo" };

export function CollisionStrip({ collision, isBackground, defs, picked, onPick, onScene }: {
  collision: DocCollisions | undefined; isBackground: boolean; defs: CollisionTileDef[]; picked: string[];
  onPick: (keys: string[]) => void; onScene: (index: number) => void;
}) {
  if (!collision?.scenes.length) {
    return (
      <div className="k-card app-strip app-strip--alert" role="note">
        <span className="app-strip-label">{isBackground
          ? "Collisions belong to a GB Studio scene, and GB Studio hasn't put this background in one yet. Add it to a scene in GB Studio first, then open it here again."
          : "Collisions belong to a project background's GB Studio scene: open a background to paint them."}</span>
      </div>
    );
  }
  const scene = collision.scenes[collision.scene];
  const pick = (def: CollisionTileDef, add: boolean) => {
    if (!add || !def.multi) return onPick([def.key]);
    const sides = picked.filter((key) => defs.find((item) => item.key === key)?.multi);
    onPick(sides.includes(def.key) ? sides.filter((key) => key !== def.key) : [...sides, def.key]);
  };
  return (
    <div className="k-card app-strip app-collisions" role="group" aria-label="Collision brush">
      {collision.scenes.length > 1
        ? <Select label="Scene" value={String(collision.scene)} onChange={(value) => onScene(Number(value))} options={collision.scenes.map((item, index) => ({ value: String(index), label: `${item.name} · ${TYPE_NAMES[item.type] ?? item.type}` }))} />
        : <span className="app-strip-label" title={scene.file}>{scene.name} · {TYPE_NAMES[scene.type] ?? scene.type}</span>}
      <div className="app-collision-picks" role="group" aria-label="Collision tile">
        {defs.map((def) => (
          <button key={def.key} type="button" className="k-btn k-btn--sm" aria-pressed={picked.includes(def.key)} title={`${def.name ?? def.key}${def.multi ? " · Shift-click to combine one-way sides" : ""}`} onClick={(event) => pick(def, event.shiftKey)}>
            <CollisionIcon def={def} />{def.name ?? def.key}
          </button>
        ))}
        <button type="button" className="k-btn k-btn--sm" aria-pressed={picked.length === 0} title="Clear collisions (or Alt-drag / right-drag with any pick)" onClick={() => onPick([])}><Eraser size={13} />Clear</button>
      </div>
    </div>
  );
}
