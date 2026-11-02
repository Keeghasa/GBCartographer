/**
 * `useWizardSettings` (the author, 2026-11-02): a wizard's settings as one object, remembered per computer and per
 * project, with a small bar of named presets (pick, Save as preset, Delete) and Reset to defaults. The pure parts
 * are in wizardSettings.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bookmark, RotateCcw, Trash2 } from "lucide-react";
import { Button, IconButton, Select, useConfirm, usePrompt } from "../ui/kit";
import { LOCAL_PRESETS_KEY, readLocal, restoreSettings, settingsKey, withLocalPreset, wizardPresets, wizardProject, writeLocal, type WizardSettingsValue } from "./wizardSettings";
import "./useWizardSettings.css";

export function useWizardSettings<T extends WizardSettingsValue>(wizard: string, defaults: T, allowed: Partial<Record<keyof T, readonly unknown[]>> = {}): {
  settings: T;
  /** Changes some settings (kept at once). */
  set: (patch: Partial<T>) => void;
  /** One setting as a useState pair (the setter takes a value or an updater), so a wizard's own state swaps in. */
  field: <K extends keyof T>(key: K) => [T[K], (value: T[K] | ((old: T[K]) => T[K])) => void];
  /** Back to the defaults. */
  reset: () => void;
  /** The presets and reset bar to show in the wizard. */
  bar: ReactNode;
} {
  const project = wizardProject();
  const key = settingsKey(wizard, project);
  // The defaults are read once; a wizard that builds them on each render doesn't reset itself.
  const first = useRef({ defaults, allowed });
  const [settings, setSettings] = useState<T>(() => restoreSettings(first.current.defaults, readLocal(key), first.current.allowed));
  useEffect(() => { writeLocal(key, settings); }, [key, settings]);
  const set = useCallback((patch: Partial<T>) => setSettings((old) => ({ ...old, ...patch })), []);
  const field = <K extends keyof T>(key: K): [T[K], (value: T[K] | ((old: T[K]) => T[K])) => void] => [settings[key],
    (value) => setSettings((old) => ({ ...old, [key]: typeof value === "function" ? (value as (old: T[K]) => T[K])(old[key]) : value }))];
  const reset = useCallback(() => setSettings({ ...first.current.defaults }), []);

  const [presets, setPresets] = useState<[string, WizardSettingsValue][]>([]);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!project) { setPresets(wizardPresets(readLocal(LOCAL_PRESETS_KEY), wizard)); return; }
    let live = true;
    void fetch("./__cartographer/presets", { cache: "no-cache" }).then((response) => response.json())
      .then((reply: { presets?: unknown }) => { if (live) setPresets(wizardPresets(reply.presets, wizard)); })
      .catch(() => { if (live) setError("Couldn't read the project's presets."); });
    return () => { live = false; };
  }, [project, wizard]);

  const store = useCallback(async (name: string, value: WizardSettingsValue | null) => {
    setError(null);
    if (!project) {
      const all = withLocalPreset(readLocal(LOCAL_PRESETS_KEY), wizard, name, value);
      writeLocal(LOCAL_PRESETS_KEY, all);
      setPresets(wizardPresets(all, wizard));
      return true;
    }
    try {
      const response = await fetch("./__cartographer/presets", { method: "POST", body: JSON.stringify({ wizard, name, settings: value }) });
      const reply = await response.json() as { presets?: unknown; error?: string };
      if (!response.ok) throw new Error(reply.error ?? "Couldn't save the preset.");
      setPresets(wizardPresets(reply.presets, wizard));
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    }
  }, [project, wizard]);

  const [prompt, ask] = usePrompt();
  const [confirm, askYes] = useConfirm();
  const save = async () => {
    const name = await ask({ title: "Save as preset", label: "Preset name", placeholder: "Desert cave", initial: picked, confirm: "Save",
      hint: project ? "Kept in the project's Cartographer/presets.json, so it travels with it." : "Kept on this computer (no project open)." });
    if (!name) return;
    if (presets.some(([taken]) => taken === name) && !await askYes(`Replace the preset "${name}"?`, { yes: "Replace" })) return;
    if (await store(name, settings)) setPicked(name);
  };
  const remove = async () => {
    if (!picked || !await askYes(`Delete the preset "${picked}"?`, { yes: "Delete", danger: true })) return;
    if (await store(picked, null)) setPicked("");
  };
  const pick = (name: string) => {
    setPicked(name);
    const found = presets.find(([taken]) => taken === name);
    if (found) setSettings(restoreSettings(first.current.defaults, found[1], first.current.allowed));
  };

  const bar = useMemo(() => (
    <div className="wset k-row">
      <Select label="Preset" placeholder={presets.length ? "Presets" : "No presets yet"} disabled={!presets.length} value={picked}
        onChange={pick} options={presets.map(([name]) => ({ value: name, label: name }))} />
      <Button size="sm" icon={<Bookmark />} onClick={() => void save()}>Save as preset</Button>
      <IconButton size="sm" label="Delete this preset" disabled={!picked} onClick={() => void remove()}><Trash2 /></IconButton>
      <span className="k-spacer" />
      <Button size="sm" icon={<RotateCcw />} onClick={() => { reset(); setPicked(""); }}>Reset to defaults</Button>
      {error && <span className="wset-error">{error}</span>}
      {prompt}{confirm}
    </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [presets, picked, error, prompt, confirm, settings]);

  return { settings, set, field, reset, bar };
}
