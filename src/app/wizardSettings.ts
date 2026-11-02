/**
 * The wizards' settings, kept (the author, 2026-11-02): reopening a wizard picks up where you left off, per computer
 * and per project (localStorage, keyed by wizard + project path, like the other view preferences), and named presets
 * ("Desert cave", "Snowy overworld") travel with the project in Cartographer/presets.json (server/own.ts), or stay in
 * localStorage with no project open. A wizard's settings are one plain object of numbers, strings, booleans and
 * arrays of those; a picked file or a running animation is never part of it. The pure parts are here; the hook and
 * its bar are in useWizardSettings.tsx.
 */
export type WizardSettingsValue = Record<string, unknown>;

/** The project the wizards remember for (PaintApp sets it); null with no project open. */
let currentProject: string | null = null;
export function setWizardProject(path: string | null) { currentProject = path; }
export function wizardProject() { return currentProject; }

export const settingsKey = (wizard: string, project: string | null) => `gbc-wizard:${wizard}:${project ?? "(no project)"}`;
export const LOCAL_PRESETS_KEY = "gbc-wizard-presets";

const sameShape = (fallback: unknown, value: unknown): boolean => {
  if (Array.isArray(fallback)) return Array.isArray(value) && (fallback.length === 0 || value.every((item) => sameShape(fallback[0], item)));
  if (fallback === null) return value === null;
  if (typeof fallback === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  return typeof value === typeof fallback && (typeof value !== "number" || Number.isFinite(value));
};

/**
 * The defaults with every saved value that still fits laid over them: unknown keys are dropped and a value of the
 * wrong type keeps its default, so an older or hand-edited save never breaks a wizard. `allowed` narrows a string
 * setting to its choices (a choice that's gone keeps the default).
 */
export function restoreSettings<T extends WizardSettingsValue>(defaults: T, saved: unknown, allowed: Partial<Record<keyof T, readonly unknown[]>> = {}): T {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { ...defaults };
  const out: WizardSettingsValue = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = (saved as WizardSettingsValue)[key];
    const choices = allowed[key as keyof T];
    if (value !== undefined && sameShape(defaults[key], value) && (!choices || choices.includes(value))) out[key] = value;
  }
  return out as T;
}

export function readLocal(key: string): unknown {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) as unknown : null;
  } catch {
    return null;
  }
}
export function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window: not kept */ }
}

/** One wizard's presets out of the whole presets object (server or local), names sorted. */
export function wizardPresets(all: unknown, wizard: string): [string, WizardSettingsValue][] {
  const named = all && typeof all === "object" ? (all as Record<string, unknown>)[wizard] : null;
  if (!named || typeof named !== "object" || Array.isArray(named)) return [];
  return Object.entries(named as Record<string, unknown>)
    .filter((entry): entry is [string, WizardSettingsValue] => Boolean(entry[1]) && typeof entry[1] === "object" && !Array.isArray(entry[1]))
    .sort(([a], [b]) => a.localeCompare(b));
}

/** The local presets with one saved (settings) or deleted (null); the same rules as the project's file. */
export function withLocalPreset(all: unknown, wizard: string, name: string, settings: WizardSettingsValue | null): Record<string, Record<string, WizardSettingsValue>> {
  const next = { ...(all && typeof all === "object" && !Array.isArray(all) ? all as Record<string, Record<string, WizardSettingsValue>> : {}) };
  const named = { ...next[wizard] };
  if (settings) named[name] = settings; else delete named[name];
  if (Object.keys(named).length) next[wizard] = named; else delete next[wizard];
  return next;
}
