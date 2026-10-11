/**
 * The project panel: a rail of the asset folders (with counts) and the open folder's pictures as thumbnail cards.
 * Clicking the folder on show again hides the cards (the rail stays), like an editor's side bar.
 * The thumbnails come from one preview sheet per folder (server/assets.ts previewSheet); while it loads the cards
 * show empty boxes, and if it can't be made they fetch their own previews.
 * Hidden pictures (the archive button on a card, the author 2026-10-10) sink to the bottom as grey cards without a
 * picture; the button again brings one back. Which are hidden is kept per project in this browser, not in the project.
 */
import { useEffect, useState } from "react";
import { ASSET_KINDS, ASSET_URL, PREVIEW_VERSION, type Asset, type AssetKind, type Project } from "./model";
import type { AutotileKind } from "./autotile";
import { SheetThumb, type SheetCell } from "./SheetThumb";
import { KIND_ICONS } from "./tools";
import { Archive, ArchiveRestore, MessageSquareText, Pencil } from "lucide-react";
import { readStored, store } from "./storage";
import { AutotileToggles } from "./AutotileToggles";
import { AnimThumb } from "./AnimThumb";
import { Chip, IconButton } from "../ui/kit";

interface ProjectPanelProps {
  project: Project;
  kind: AssetKind;
  /** Whether the cards are showing (the rail always is). */
  open: boolean;
  onKind: (kind: AssetKind) => void;
  /** The empty part of the rail: hides or shows the cards. */
  onToggle: () => void;
  /** The Messages window (the button at the foot of the rail), and how many messages came since it was last opened. */
  onMessages: () => void;
  unreadMessages: number;
  /** Bumped when palette slots change, so the thumbnails are drawn again. */
  slotsVersion: number;
  /** How a picture stands in the painter: not open, open, or the one on show; and whether it has unsaved changes. */
  stateOf: (asset: Asset) => { open: boolean; active: boolean; dirty: boolean };
  onOpen: (asset: Asset) => void;
  /** A saved stamp's card: a click takes it as the stamp in hand (its hover pencil opens it to edit instead). */
  onUseStamp: (asset: Asset) => void;
  /** A saved stamp's 9 / W auto-tile toggles. */
  onAutotile: (asset: Asset, autotile: AutotileKind | null) => void;
  onMenu: (asset: Asset, x: number, y: number) => void;
}

const assetQuery = (asset: { kind: AssetKind; file: string }) => new URLSearchParams({ kind: asset.kind, file: asset.file });

export function ProjectPanel({ project, kind, open, onKind, onToggle, onMessages, unreadMessages, slotsVersion, stateOf, onOpen, onUseStamp, onAutotile, onMenu }: ProjectPanelProps) {
  const [filter, setFilter] = useState("");
  const [sheet, setSheet] = useState<{ kind: AssetKind; image: HTMLImageElement; cells: Map<string, SheetCell> } | null>(null);
  const [sheetFailed, setSheetFailed] = useState(false);
  const hiddenKey = `gbc-hidden:${project.path}`;
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(readStored<string[]>(hiddenKey, [])));
  useEffect(() => setHidden(new Set(readStored<string[]>(hiddenKey, []))), [hiddenKey]);
  const hideKey = (asset: Asset) => `${asset.kind}/${asset.file}`;
  const toggleHidden = (asset: Asset) => {
    const next = new Set(hidden);
    if (next.has(hideKey(asset))) next.delete(hideKey(asset)); else next.add(hideKey(asset));
    setHidden(next);
    store(hiddenKey, [...next]);
  };

  // The sheet of the folder on show: fetched again when its pictures, palettes or slots change.
  const sheetKey = `${project.path}|${kind}|${project.assets.filter((asset) => asset.kind === kind).map((asset) => `${asset.file}:${Math.round(asset.mtime)}`).join(",")}|${slotsVersion}`;
  useEffect(() => {
    let live = true;
    setSheetFailed(false);
    const failed = () => { if (live) setSheetFailed(true); };
    void fetch(`./__cartographer/gbstudio-preview-sheet?kind=${kind}`, { cache: "no-cache" }).then((response) => response.ok ? response.json() as Promise<{ stamp: string; cells: SheetCell[] }> : null).then((result) => {
      if (!live) return;
      if (!result) return failed();
      const image = new Image();
      image.onerror = failed;
      image.onload = () => { if (live) setSheet({ kind, image, cells: new Map(result.cells.map((cell) => [cell.file, cell])) }); };
      image.src = `./__cartographer/gbstudio-preview-sheet.png?kind=${kind}&stamp=${result.stamp}`;
    }).catch(failed);
    return () => { live = false; };
  }, [sheetKey]);

  const label = ASSET_KINDS.find(([id]) => id === kind)?.[1] ?? "";
  const wanted = filter.trim().toLowerCase();
  const matching = project.assets.filter((asset) => asset.kind === kind && (!wanted || asset.name.toLowerCase().includes(wanted)));
  // Hidden ones last, in their own order.
  const shown = [...matching.filter((asset) => !hidden.has(hideKey(asset))), ...matching.filter((asset) => hidden.has(hideKey(asset)))];
  return (
    <>
      <nav className="k-panel app-rail" aria-label="Asset folders">
        {ASSET_KINDS.map(([id, name]) => { const Icon = KIND_ICONS[id]; const count = project.assets.filter((asset) => asset.kind === id).length; const on = kind === id && open; return (
          <IconButton key={id} variant="ghost" pressed={on} aria-label={`${name} (${count})`} label={`${name} · ${count}${on ? " · click to hide" : ""}`} onClick={() => onKind(id)}><Icon size={18} /><span className="app-badge">{count}</span></IconButton>
        ); })}
        <button type="button" className="app-rail-fill" aria-label={open ? "Hide the pictures" : "Show the pictures"} title={open ? "Hide the pictures" : "Show the pictures"} onClick={onToggle} />
        <IconButton variant="ghost" aria-label={`Messages${unreadMessages ? ` (${unreadMessages} new)` : ""}`} label={`Messages: everything GB Cartographer said${unreadMessages ? ` · ${unreadMessages} new` : ""}`} onClick={onMessages}><MessageSquareText size={18} />{unreadMessages > 0 && <span className="app-badge">{unreadMessages > 99 ? "99+" : unreadMessages}</span>}</IconButton>
      </nav>
      {open && <aside className="k-panel app-project" aria-label="GB Studio project">
        <div className="app-project-head"><span className="k-eyebrow" title={project.path}>{project.name}</span><Chip>{label}</Chip></div>
        <input type="search" className="k-input" placeholder={`Filter ${label.toLowerCase()}`} aria-label={`Filter ${label.toLowerCase()} by name`} value={filter} onChange={(event) => setFilter(event.target.value)} />
        <div className="app-cards gbp-assets" role="list">
          {shown.map((asset) => {
            const state = stateOf(asset);
            // The thumbnail box takes the picture's own shape (kept between 4:5 and 2:1), so the picture fills it.
            const fit = { aspectRatio: String(Math.min(2, Math.max(0.8, asset.width / Math.max(1, asset.height)))) };
            const stamp = asset.kind === "stamps";
            const isHidden = hidden.has(hideKey(asset));
            const card = (
              <button key={asset.file} aria-pressed={state.active} onContextMenu={(event) => { event.preventDefault(); onMenu(asset, event.clientX, event.clientY); }} className={`k-card k-card--button app-card ${state.open && !state.active ? "open" : ""}${isHidden ? " is-hidden" : ""}`} title={`${asset.file} · ${asset.width} × ${asset.height} px${state.open ? " · open" : ""}${stamp ? " · click to stamp with it" : ""}`} onClick={() => stamp ? onUseStamp(asset) : onOpen(asset)}>
                {isHidden ? <span className="gbp-asset-thumb app-card-blank" aria-hidden="true" style={fit} />
                  : stamp && asset.autotile === "anim" ? <AnimThumb className="gbp-asset-thumb" style={{ ...fit, aspectRatio: "1" }} src={`${ASSET_URL}-preview?${assetQuery(asset)}&v=${Math.round(asset.mtime)}&pv=${PREVIEW_VERSION}&s=${slotsVersion}`} />
                  : sheet?.kind === asset.kind && sheet.cells.has(asset.file)
                  ? <SheetThumb sheet={sheet.image} cell={sheet.cells.get(asset.file)!} style={fit} />
                  : !sheetFailed && sheet?.kind !== asset.kind ? <span className="gbp-asset-thumb" aria-hidden="true" style={fit} />
                  : <img className="gbp-asset-thumb" style={fit} loading="lazy" decoding="async" alt="" src={`${ASSET_URL}-preview?${assetQuery(asset)}&v=${Math.round(asset.mtime)}&pv=${PREVIEW_VERSION}&s=${slotsVersion}`} />}
                <b className={state.dirty ? "dirty" : ""}>{asset.name}</b>
                <small>{asset.width} × {asset.height}</small>
              </button>
            );
            return (
              <span key={asset.file} role="listitem" className="app-card-slot">{card}
                <span className="app-card-actions">
                  {stamp && !isHidden && <AutotileToggles stamp={asset} onAutotile={onAutotile} />}
                  {stamp && !isHidden && <button type="button" className="app-stamp-edit" title={`Edit ${asset.name}`} aria-label={`Edit ${asset.name}`} onClick={() => onOpen(asset)}><Pencil size={11} /></button>}
                  <button type="button" className="app-stamp-edit" aria-pressed={isHidden} title={isHidden ? `Bring ${asset.name} back` : `Hide ${asset.name}: it moves to the bottom, greyed out (only here; the file stays)`} aria-label={isHidden ? `Show ${asset.name}` : `Hide ${asset.name}`} onClick={() => toggleHidden(asset)}>{isHidden ? <ArchiveRestore size={11} /> : <Archive size={11} />}</button>
                </span>
              </span>
            );
          })}
          {shown.length === 0 && <p className="k-muted k-small" style={{ gridColumn: "1 / -1" }}>No {label.toLowerCase()} {wanted ? "match" : "in this project"}.</p>}
        </div>
      </aside>}
    </>
  );
}
