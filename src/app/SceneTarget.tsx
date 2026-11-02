/**
 * Send straight to a scene's slots (the author, 2026-11-02): one shared choice for every wizard that makes palettes.
 * Off, or a project background: its GB Studio scene's palette slots get the new palettes (PaintApp's sendToScene asks
 * first, naming the scene, and writes them one slot at a time through the Put in slot path, the scene file backed up).
 */
import { Checkbox, Select } from "../ui/kit";

export interface SceneBackground { file: string; name: string }

export function SceneTarget({ backgrounds, value, onChange, what = "them" }: {
  /** The project's backgrounds; a scene is found from the background it shows. */
  backgrounds: readonly SceneBackground[];
  /** The background file whose scene gets them; "" off. */
  value: string; onChange: (file: string) => void;
  what?: string;
}) {
  if (!backgrounds.length) return null;
  return (
    <span className="k-row">
      <Checkbox checked={Boolean(value)} onChange={(on) => onChange(on ? backgrounds[0].file : "")}>Also put {what} in the slots of the scene showing</Checkbox>
      {value && <Select label="Background whose scene gets them" value={value} onChange={onChange} options={backgrounds.map((background) => ({ value: background.file, label: background.name }))} />}
    </span>
  );
}
