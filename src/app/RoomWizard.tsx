/**
 * The Interior wizard (the author, 2026-11-02): a room in the catalog's indoor tiles, built like the map generators
 * (sliders on the left, the room on the right, redrawn as they move, screen edges marked; the same Open as picture
 * and Make background). Size in 16-px cells inside the walls, the door's wall and place, windows, a rug and
 * furniture placed by the seed (src/app/room.ts).
 */
import { Dices, Sofa } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { countUniqueTiles, toRgba } from "../paint";
import { Button, Chip, IconButton, Segmented, Slider, Switch } from "../ui/kit";
import type { Generated } from "./generators";
import { ROOM_DEFAULTS, ROOM_FLOORS, drawRoom, type DoorSide, type RoomFloor, type RoomSettings } from "./room";
import { defaultName } from "./names";
import { NameInput } from "./NameInput";
import { WizardPage } from "./WizardPage";
import { useWizardSettings } from "./useWizardSettings";
import "./GeneratorWizard.css";
import "./RoomWizard.css";

const newSeed = () => Math.floor(Math.random() * 1_000_000);

function Setting({ label, value, unit = "", min, max, onChange, title }: { label: string; value: number; unit?: string; min: number; max: number; onChange: (value: number) => void; title?: string }) {
  return (
    <div className="gw-setting" title={title}>
      <span className="gw-setting-head"><span className="k-label">{label}</span><span className="k-mono k-small">{value}{unit}</span></span>
      <Slider label={label} value={value} min={min} max={max} onChange={onChange} />
    </div>
  );
}

export function RoomWizard({ projectName, limit, takenNames, onClose, onOpen, onSave }: {
  /** The open project's name (null: only Open as picture). */
  projectName: string | null;
  /** The scene's unique-tile limit, for the tile chip. */
  limit: number;
  /** Names the project's backgrounds already have. */
  takenNames: string[];
  onClose: () => void;
  onOpen: (picture: Generated, name: string) => void;
  onSave: (picture: Generated, name: string) => Promise<boolean>;
}) {
  // Remembered per project with the seed, and presets (the author, 2026-11-02).
  const ws = useWizardSettings("room", { ...ROOM_DEFAULTS, seed: newSeed() } as RoomSettings & Record<string, unknown>);
  const room: RoomSettings = ws.settings;
  const [name, setName] = useState(() => defaultName("Room", takenNames));
  const [busy, setBusy] = useState(false);
  const set = (change: Partial<RoomSettings>) => ws.set(change);
  const picture = useMemo(() => drawRoom(room), [room]);
  const tiles = useMemo(() => countUniqueTiles(picture.pixels, picture.width, picture.height, false), [picture]);
  const columns = Math.ceil(picture.width / 160), rows = Math.ceil(picture.height / 144);

  const [target, setTarget] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!target) return;
    Object.assign(target, { width: picture.width, height: picture.height });
    const cells = new Uint16Array(Math.ceil(picture.width / 8) * Math.ceil(picture.height / 8));
    target.getContext("2d")!.putImageData(new ImageData(toRgba(picture.pixels, cells, picture.width, []), picture.width, picture.height), 0, 0);
  }, [picture, target]);

  const valid = /^[\w ()\-.]+$/.test(name.trim());
  async function save() {
    setBusy(true);
    let done = false;
    try { done = await onSave(picture, name.trim()); } finally { setBusy(false); }
    if (done) onClose();
  }
  const sideways = room.door === "left" || room.door === "right";

  return (
    <WizardPage tools={ws.bar} title="Interior" icon={<Sofa size={18} />} busy={busy} onClose={onClose}
      line={["In the catalog's indoor tiles", "sized in 16 px cells · sliders redraw it live"]}
      footer={<>
        <span className="k-spacer" />
        <Button onClick={() => { onOpen(picture, name.trim() || "Room"); onClose(); }} disabled={busy}>Open as picture</Button>
        <Button variant="primary" disabled={!projectName || !valid || busy} title={!projectName ? "Open a GB Studio project first" : valid ? `Makes assets/backgrounds/${name.trim()}.png (never replaces a file)` : "Give it a name (letters, digits, spaces, - _ ( ) .)"} onClick={() => void save()}>{busy ? "Making…" : "Make background"}</Button>
      </>}>
      <div className="gw">
        <div className="gw-controls k-stack">
          <div className="k-stack k-stack--tight">
            <span className="k-label">Name</span>
            <NameInput kind="Room" value={name} onChange={setName} taken={takenNames} />
          </div>
          <Setting label="Width" value={room.width} unit=" cells" min={2} max={38} onChange={(width) => set({ width })} title="Floor cells (16 px) across, inside the walls" />
          <Setting label="Depth" value={room.height} unit=" cells" min={2} max={32} onChange={(height) => set({ height })} title="Floor cells (16 px) from the back wall to the front" />
          <div className="k-stack k-stack--tight">
            <span className="k-label">Floor</span>
            <Segmented fill size="sm" label="Floor" value={room.floor} onChange={(floor) => set({ floor: floor as RoomFloor })} options={ROOM_FLOORS} />
          </div>
          <div className="k-stack k-stack--tight">
            <span className="k-label">Door</span>
            <Segmented fill size="sm" label="Door wall" value={room.door} onChange={(door) => set({ door: door as DoorSide })}
              options={[{ value: "top", label: "Back" }, { value: "bottom", label: "Front" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }]} />
          </div>
          <Setting label={sideways ? "Door from the back" : "Door from the left"} value={room.doorAt} unit="%" min={0} max={100} onChange={(doorAt) => set({ doorAt })} />
          <Switch checked={room.windows} onChange={(windows) => set({ windows })}>Windows in the back wall</Switch>
          <Switch checked={room.rug} onChange={(rug) => set({ rug })}>A rug in the middle</Switch>
          <Setting label="Furniture" value={room.furniture} min={0} max={12} onChange={(furniture) => set({ furniture })} title="Pieces from the catalog's indoor tiles; the way in stays clear" />
          <span className="k-row"><span className="k-label">Layout</span><span className="k-mono k-small k-muted">#{room.seed}</span><span className="k-spacer" /><IconButton label="New layout (another seed)" onClick={() => set({ seed: newSeed() })}><Dices /></IconButton></span>
        </div>
        <div className="gw-stage">
          <div className="gw-frame" style={{ ["--gw-ratio" as string]: picture.width / picture.height }}>
            <div className="gw-map rw-map" style={{ ["--gw-cols" as string]: picture.width / 160, ["--gw-rows" as string]: picture.height / 144 }}>
              <canvas ref={setTarget} aria-label="Generated room" />
              <span className="gw-screens" aria-hidden />
            </div>
          </div>
          <span className="k-row">
            <Chip>{picture.width} × {picture.height} px</Chip>
            <Chip>{columns} × {rows} screens</Chip>
            <Chip tone={tiles > limit ? "warn" : undefined} title="Unique 8 × 8 tiles; GB Studio's limit for one background">{tiles} / {limit} unique tiles</Chip>
            <span className="k-muted k-xs">The catalog's indoor tiles: paint over them as you like. Cyan lines are screen edges.</span>
          </span>
        </div>
      </div>
    </WizardPage>
  );
}
