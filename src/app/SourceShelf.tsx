/**
 * The shelf a wizard starts from (the author's pick, 2026-10-24, review page "Your own models and pictures", A):
 * "+ Add your own" first, then the files you added to this project (kept in Cartographer/models or
 * Cartographer/pictures, so they're here next time on any computer), then the samples that come with the app. One is
 * picked at a time; yours can be removed (they go to the backups). With no project open, your file loads but isn't
 * kept.
 */
import { Box, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton, useConfirm } from "../ui/kit";
import "./SourceShelf.css";

export type SourceKind = "models" | "pictures";
export interface SourceEntry { kind: SourceKind; name: string; file: string; files: string[]; mtime: number; size: number }
export interface Sample { id: string; label: string; /** A picture to show on the tile (none: an icon). */ thumb?: string; credit?: { text: string; href: string } }

const url = (kind: SourceKind, entry: SourceEntry, inner?: string) => `./__cartographer/source?${new URLSearchParams({ kind, file: entry.file, ...(inner ? { inner } : {}) })}`;

/** The project's sources of a kind (none: no project, or none yet). */
export async function listSources(kind: SourceKind): Promise<SourceEntry[]> {
  try {
    const response = await fetch(`./__cartographer/sources?kind=${kind}`, { cache: "no-cache" });
    return response.ok ? ((await response.json()) as { sources?: SourceEntry[] }).sources ?? [] : [];
  } catch { return []; }
}

/** Copies files into the project: a picture each; a model's main file first, the rest into its folder. */
export async function storeSources(kind: SourceKind, files: File[]): Promise<SourceEntry | null> {
  const main = /\.(glb|gltf|fbx|obj|dae|usdz|usda|3mf|stl|ply)$/i;
  const ordered = kind === "models" ? [...files].sort((a, b) => Number(main.test(b.name)) - Number(main.test(a.name))) : files.slice(0, 1);
  let entry: SourceEntry | null = null;
  for (const file of ordered) {
    const query = new URLSearchParams({ kind, name: file.name, ...(entry && kind === "models" ? { into: entry.file } : {}) });
    const response = await fetch(`./__cartographer/source?${query}`, { method: "POST", body: await file.arrayBuffer() });
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean; source?: SourceEntry; error?: string };
    if (!response.ok || !result.source) throw new Error(result.error ?? response.statusText);
    entry = result.source;
  }
  return entry;
}

/** A project source's files, fetched back as File objects the loaders take. */
export async function fetchSource(kind: SourceKind, entry: SourceEntry): Promise<File[]> {
  return Promise.all((kind === "models" ? entry.files : [entry.file]).map(async (inner) => {
    const response = await fetch(url(kind, entry, kind === "models" ? inner : undefined), { cache: "no-cache" });
    if (!response.ok) throw new Error(`${inner}: ${response.statusText}`);
    return new File([await response.blob()], inner);
  }));
}

export function SourceShelf({ kind, samples, selected, projectName, accept, multiple, onSample, onProject, onLoose, say, refresh }: {
  kind: SourceKind; samples: Sample[];
  /** "sample:<id>" or "project:<file>". */
  selected: string | null;
  projectName: string | null;
  /** The file input's accept list. */
  accept: string; multiple?: boolean;
  onSample: (sample: Sample) => void;
  /** One of the project's: its files, fetched or just added. */
  onProject: (entry: SourceEntry, files: File[]) => void;
  /** No project open: the file loads but isn't kept. */
  onLoose: (files: File[]) => void;
  say: (text: string) => void;
  /** Changes whenever the shelf should reread the project's list (a drop elsewhere added one). */
  refresh?: number;
}) {
  const [entries, setEntries] = useState<SourceEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [confirmDialog, confirmBox] = useConfirm();
  useEffect(() => { if (projectName) void listSources(kind).then(setEntries); else setEntries([]); }, [kind, projectName, refresh]);

  async function add(files: File[]) {
    if (!files.length) return;
    if (!projectName) return onLoose(files);
    setBusy(true);
    try {
      const entry = await storeSources(kind, files);
      if (entry) { setEntries(await listSources(kind)); onProject(entry, files); say(`${entry.name} is in ${projectName} now (Cartographer/${kind}).`); }
    } catch (error) {
      say(`Could not add it: ${(error as Error).message}`);
    } finally { setBusy(false); }
  }
  async function pick(entry: SourceEntry) {
    setBusy(true);
    try { onProject(entry, await fetchSource(kind, entry)); }
    catch (error) { say(`${entry.name} could not be read: ${(error as Error).message}`); }
    finally { setBusy(false); }
  }
  async function remove(entry: SourceEntry) {
    if (!await confirmBox(`Take ${entry.name} out of ${projectName}? Its file${entry.files.length === 1 ? " goes" : "s go"} to the backups.`, { yes: "Take it out", danger: true })) return;
    await fetch(`./__cartographer/source?${new URLSearchParams({ kind, file: entry.file })}`, { method: "DELETE" });
    setEntries(await listSources(kind));
  }

  const tile = (key: string, picked: boolean, body: ReactNode, label: string, tag: string, onClick: () => void, extra?: ReactNode) => (
    <div key={key} className={`ss-tile${picked ? " is-picked" : ""}`}>
      <button type="button" className="ss-pick" aria-pressed={picked} disabled={busy} title={label} onClick={onClick}>{body}<span className="ss-label">{label}</span><span className="ss-tag">{tag}</span></button>
      {extra}
    </div>
  );
  return (
    <div className="ss" role="group" aria-label={kind === "models" ? "Models" : "Pictures"}>
      <div className="ss-head"><span className="k-eyebrow">{kind === "models" ? "Model" : "Picture"}</span><span className="k-muted k-xs">{projectName ? `yours are kept in Cartographer/${kind}` : "open a project to keep your own"}</span></div>
      <div className="ss-grid">
        <input ref={input} type="file" accept={accept} multiple={multiple} hidden onChange={(event) => { void add([...(event.target.files ?? [])]); event.target.value = ""; }} />
        <button type="button" className="ss-tile ss-add" disabled={busy} title={projectName ? `Copies the file${multiple ? "s" : ""} into ${projectName}'s Cartographer/${kind} folder, so ${multiple ? "they're" : "it's"} here next time` : "Loads your file (open a project to keep it)"} onClick={() => input.current?.click()}><Plus size={16} /><span>Add your<br />own</span></button>
        {entries.map((entry) => tile(`project:${entry.file}`, selected === `project:${entry.file}`,
          kind === "pictures" ? <img className="ss-thumb" src={url(kind, entry)} alt="" draggable={false} /> : <span className="ss-icon"><Box size={22} /></span>,
          entry.name, "yours", () => void pick(entry),
          <IconButton size="sm" variant="ghost" className="ss-remove" label={`Take ${entry.name} out of the project (to the backups)`} onClick={() => void remove(entry)}><X /></IconButton>))}
        {samples.map((sample) => tile(`sample:${sample.id}`, selected === `sample:${sample.id}`,
          sample.thumb ? <img className="ss-thumb" src={sample.thumb} alt="" draggable={false} /> : <span className="ss-icon"><Box size={22} /></span>,
          sample.label, "sample", () => onSample(sample)))}
      </div>
      {samples.find((sample) => `sample:${sample.id}` === selected)?.credit && (() => { const credit = samples.find((sample) => `sample:${sample.id}` === selected)!.credit!; return <a className="k-xs ss-credit" href={credit.href} target="_blank" rel="noreferrer">{credit.text}</a>; })()}
      {confirmDialog}
    </div>
  );
}
