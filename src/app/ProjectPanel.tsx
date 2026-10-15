/**
 * The project panel: a rail of the asset folders (with counts) and the open folder's pictures as thumbnail cards.
 * Clicking the folder on show again hides the cards (the rail stays), like an editor's side bar.
 * The thumbnails come from one preview sheet per folder (server/assets.ts previewSheet); while it loads the cards
 * show empty boxes, and if it can't be made they fetch their own previews.
 * Hidden pictures (the archive button on a card, the author 2026-10-10) go into one "Hidden" folder card at the top
 * of the grid (2026-10-12): hovering it cycles through what's inside, clicking it opens a window that brings them
 * back. Pinned pictures (the pin button) come right after it, before the rest. Which are hidden and pinned is kept
 * per project in the project itself (Cartographer/panel.json), so it travels with it.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ASSET_KINDS, ASSET_URL, PREVIEW_VERSION, type Asset, type AssetKind, type Project } from "./model";
import type { AutotileKind } from "./autotile";
import { SheetThumb, type SheetCell } from "./SheetThumb";
import { KIND_ICONS } from "./tools";
import { Archive, Blocks, FolderClosed, MessageSquareText, Pencil, Pin, TreePine, Waves } from "lucide-react";
import { PhCheckerboard } from "../ui/setIcons";
import { STAMP_GROUPS, stampGroup, type StampGroup } from "./stampGroups";
import { HiddenWindow } from "./HiddenWindow";
import { readStored, store } from "./storage";
import { AutotileToggles } from "./AutotileToggles";
import { AnimThumb } from "./AnimThumb";
import { IconButton } from "../ui/kit";
import { catalogCredit } from "../graphics/library";

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
  /** A font card picked: type with it (the Type tool, this font). */
  onUseFont: (asset: Asset) => void;
  /** A saved stamp's 9 / W auto-tile toggles. */
  onAutotile: (asset: Asset, autotile: AutotileKind | null) => void;
  onMenu: (asset: Asset, x: number, y: number) => void;
}

const assetQuery = (asset: { kind: AssetKind; file: string }) => new URLSearchParams({ kind: asset.kind, file: asset.file });

export function ProjectPanel({ project, kind, open, onKind, onToggle, onMessages, unreadMessages, slotsVersion, stateOf, onOpen, onUseStamp, onUseFont, onAutotile, onMenu }: ProjectPanelProps) {
  const [filter, setFilter] = useState("");
  // Which stamp shelf shows when the folder is stamps (Objects, Repeat tiles, Autotiles, Animated tiles).
  const [group, setGroup] = useState<StampGroup>(() => readStored("gbc-stamp-group", "objects" as StampGroup));
  const [sheet, setSheet] = useState<{ kind: AssetKind; image: HTMLImageElement; cells: Map<string, SheetCell> } | null>(null);
  const [sheetFailed, setSheetFailed] = useState(false);
  // Hidden and pinned pictures live in the project (Cartographer/panel.json, the author's pick 2026-10-12), so they
  // travel with it; this browser's old lists for the project move in the first time it has none.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const panelFor = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    panelFor.current = null;
    // Only a panel that was read lets changes be written (a failed read must never let one change replace the list).
    void fetch("./__cartographer/panel", { cache: "no-cache" }).then((response) => { if (!response.ok) throw new Error(response.statusText); return response.json() as Promise<{ exists?: boolean; hidden?: string[]; pinned?: string[] }>; }).then((panel) => {
      if (!live) return;
      if (panel.exists) { setHidden(new Set(panel.hidden ?? [])); setPinned(new Set(panel.pinned ?? [])); }
      else {
        const old = { hidden: readStored<string[]>(`gbc-hidden:${project.path}`, []), pinned: readStored<string[]>(`gbc-pinned:${project.path}`, []) };
        setHidden(new Set(old.hidden)); setPinned(new Set(old.pinned));
        if (old.hidden.length || old.pinned.length) void fetch("./__cartographer/panel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(old) }).catch(() => null);
      }
      panelFor.current = project.path;
    }).catch(() => { panelFor.current = null; });
    return () => { live = false; };
  }, [project.path]);
  const savePanel = (nextHidden: Set<string>, nextPinned: Set<string>) => {
    setHidden(nextHidden); setPinned(nextPinned);
    if (panelFor.current === project.path) void fetch("./__cartographer/panel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden: [...nextHidden], pinned: [...nextPinned] }) }).catch(() => null);
  };
  const hideKey = (asset: Asset) => `${asset.kind}/${asset.file}`;
  const toggleHidden = (asset: Asset) => {
    const next = new Set(hidden);
    if (next.has(hideKey(asset))) next.delete(hideKey(asset)); else next.add(hideKey(asset));
    savePanel(next, pinned);
  };
  const showAgain = (assets: Asset[]) => {
    const next = new Set(hidden);
    for (const asset of assets) next.delete(hideKey(asset));
    savePanel(next, pinned);
  };
  const togglePinned = (asset: Asset) => {
    const next = new Set(pinned);
    if (next.has(hideKey(asset))) next.delete(hideKey(asset)); else next.add(hideKey(asset));
    savePanel(hidden, next);
  };
  const [hiddenOpen, setHiddenOpen] = useState(false);
  // Hovering the Hidden folder cycles through its pictures.
  const [cycle, setCycle] = useState(0);
  const cycling = useRef<number | undefined>(undefined);
  const startCycle = () => { window.clearInterval(cycling.current); cycling.current = window.setInterval(() => setCycle((at) => at + 1), 650); };
  const stopCycle = () => { window.clearInterval(cycling.current); cycling.current = undefined; setCycle(0); };
  useEffect(() => () => window.clearInterval(cycling.current), []);

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

  const label = kind === "stamps" ? STAMP_GROUPS.find(([id]) => id === group)![1] : ASSET_KINDS.find(([id]) => id === kind)?.[1] ?? "";
  const wanted = filter.trim().toLowerCase();
  const matching = project.assets.filter((asset) => asset.kind === kind && (kind !== "stamps" || stampGroup(asset) === group) && (!wanted || asset.name.toLowerCase().includes(wanted)));
  // Hidden ones go into the Hidden folder; pinned ones first, then the rest.
  const hiddenHere = matching.filter((asset) => hidden.has(hideKey(asset)));
  const visible = matching.filter((asset) => !hidden.has(hideKey(asset)));
  const shown = [...visible.filter((asset) => pinned.has(hideKey(asset))), ...visible.filter((asset) => !pinned.has(hideKey(asset)))];
  /** A picture's thumbnail: cut from the folder's preview sheet, or its own preview while the sheet can't be had. */
  const thumbOf = (asset: Asset, fit: CSSProperties) => asset.kind === "stamps" && (asset.autotile === "anim" || asset.autotile === "atlasAnim" || asset.autotile === "xpAnim") ? <AnimThumb frames={asset.autotile === "atlasAnim" || asset.autotile === "xpAnim" ? 3 : undefined} className="gbp-asset-thumb" style={{ ...fit, aspectRatio: asset.autotile === "atlasAnim" ? "2 / 3" : asset.autotile === "xpAnim" ? "3 / 4" : "1" }} src={`${ASSET_URL}-preview?${assetQuery(asset)}&v=${Math.round(asset.mtime)}&pv=${PREVIEW_VERSION}&s=${slotsVersion}`} />
    : sheet?.kind === asset.kind && sheet.cells.has(asset.file)
    ? <SheetThumb sheet={sheet.image} cell={sheet.cells.get(asset.file)!} style={fit} />
    : !sheetFailed && sheet?.kind !== asset.kind ? <span className="gbp-asset-thumb" aria-hidden="true" style={fit} />
    : <img className="gbp-asset-thumb" style={fit} loading="lazy" decoding="async" alt="" src={`${ASSET_URL}-preview?${assetQuery(asset)}&v=${Math.round(asset.mtime)}&pv=${PREVIEW_VERSION}&s=${slotsVersion}`} />;
  const square = { aspectRatio: "1" };
  const folderShows = hiddenHere.length ? hiddenHere[cycle % hiddenHere.length] : undefined;
  return (
    <>
      <nav className="k-panel app-rail" aria-label="Asset folders">
        {ASSET_KINDS.filter(([id]) => id !== "stamps").map(([id, name]) => { const Icon = KIND_ICONS[id]; const count = project.assets.filter((asset) => asset.kind === id).length; const on = kind === id && open; return (
          <IconButton key={id} variant="ghost" pressed={on} aria-label={`${name} (${count})`} label={`${name} · ${count}${on ? " · click to hide" : ""}`} onClick={() => onKind(id)}><Icon size={18} /><span className="app-badge">{count}</span></IconButton>
        ); })}
        {/* The stamps, on four shelves of their own (GB Cartographer's, in Cartographer/stamps), in the middle of the
            rail's free space: the hide bar is split, above and below them (the author, 2026-10-13). */}
        <button type="button" className="app-rail-fill" aria-label={open ? "Hide the pictures" : "Show the pictures"} title={open ? "Hide the pictures" : "Show the pictures"} onClick={onToggle} />
        <hr className="app-rail-rule" />
        {STAMP_GROUPS.map(([id, name]) => {
          const Icon = { objects: TreePine, repeat: PhCheckerboard, autotiles: Blocks, animated: Waves }[id];
          const count = project.assets.filter((asset) => asset.kind === "stamps" && stampGroup(asset) === id).length, on = kind === "stamps" && group === id && open;
          return <IconButton key={id} variant="ghost" pressed={on} aria-label={`${name} (${count})`} label={`${name} (stamps) · ${count}${on ? " · click to hide" : ""}`} onClick={() => { if (kind === "stamps" && group !== id) { setGroup(id); store("gbc-stamp-group", id); if (!open) onKind("stamps"); return; } setGroup(id); store("gbc-stamp-group", id); onKind("stamps"); }}><Icon size={18} /><span className="app-badge">{count}</span></IconButton>;
        })}
        <hr className="app-rail-rule" />
        <button type="button" className="app-rail-fill" aria-label={open ? "Hide the pictures" : "Show the pictures"} title={open ? "Hide the pictures" : "Show the pictures"} onClick={onToggle} />
        <IconButton variant="ghost" aria-label={`Messages${unreadMessages ? ` (${unreadMessages} new)` : ""}`} label={`Messages: everything GB Cartographer said${unreadMessages ? ` · ${unreadMessages} new` : ""}`} onClick={onMessages}><MessageSquareText size={18} />{unreadMessages > 0 && <span className="app-badge">{unreadMessages > 99 ? "99+" : unreadMessages}</span>}</IconButton>
      </nav>
      {open && <aside className="k-panel app-project" aria-label="GB Studio project">
        <div className="app-project-head"><span className="k-eyebrow" title={project.path}>{project.name}</span></div>
        <h2 className="k-heading">{label}</h2>
        <input type="search" className="k-input" placeholder={`Filter ${label.toLowerCase()}`} aria-label={`Filter ${label.toLowerCase()} by name`} value={filter} onChange={(event) => setFilter(event.target.value)} />
        <div className="app-cards gbp-assets" role="list">
          {folderShows && (
            <span role="listitem" className="app-card-slot">
              <button type="button" className="k-card k-card--button app-card app-card--folder" title={`${hiddenHere.length} hidden ${hiddenHere.length === 1 ? "picture" : "pictures"} (only here; the files stay). Click to see them or bring them back.`} onClick={() => setHiddenOpen(true)} onMouseEnter={startCycle} onMouseLeave={stopCycle} onFocus={startCycle} onBlur={stopCycle}>
                <span className="app-folder-thumb">{thumbOf(folderShows, square)}<FolderClosed className="app-folder-badge" size={16} /></span>
                <b>Hidden</b>
                <small>{hiddenHere.length} {hiddenHere.length === 1 ? "picture" : "pictures"}</small>
              </button>
            </span>
          )}
          {shown.map((asset) => {
            const state = stateOf(asset);
            // The thumbnail box takes the picture's own shape (kept between 4:5 and 2:1), so the picture fills it.
            const fit = { aspectRatio: String(Math.min(2, Math.max(0.8, asset.width / Math.max(1, asset.height)))) };
            const stamp = asset.kind === "stamps", font = asset.kind === "fonts";
            const isPinned = pinned.has(hideKey(asset));
            // A piece taken from the Asset Catalog names its maker (matched by its kind and name).
            const credit = catalogCredit(asset.kind, asset.name);
            const card = (
              <button key={asset.file} aria-pressed={state.active} onContextMenu={(event) => { event.preventDefault(); onMenu(asset, event.clientX, event.clientY); }} className={`k-card k-card--button app-card ${state.open && !state.active ? "open" : ""}`} title={`${asset.file} · ${asset.width} × ${asset.height} px${state.open ? " · open" : ""}${stamp ? " · click to stamp with it" : ""}`} onClick={() => stamp ? onUseStamp(asset) : font ? onUseFont(asset) : onOpen(asset)}>
                {thumbOf(asset, fit)}
                <b className={state.dirty ? "dirty" : ""}>{asset.name}</b>
                {credit && <small className="app-card-by" title={`${credit.author} · ${credit.license}`}>by {credit.author}</small>}
                <small>{asset.width} × {asset.height}</small>
              </button>
            );
            return (
              <span key={asset.file} role="listitem" className="app-card-slot">{card}
                <span className="app-card-actions">
                  {stamp && <AutotileToggles stamp={asset} onAutotile={onAutotile} />}
                  {(stamp || font) && <button type="button" className="app-stamp-edit" title={`Edit ${asset.name}`} aria-label={`Edit ${asset.name}`} onClick={() => onOpen(asset)}><Pencil size={11} /></button>}
                  <button type="button" className="app-stamp-edit" aria-pressed={isPinned} title={isPinned ? `Unpin ${asset.name}` : `Pin ${asset.name}: it stays at the top of the grid`} aria-label={isPinned ? `Unpin ${asset.name}` : `Pin ${asset.name}`} onClick={() => togglePinned(asset)}><Pin size={11} /></button>
                  <button type="button" className="app-stamp-edit" title={`Hide ${asset.name}: it goes into the Hidden folder at the top (only here; the file stays)`} aria-label={`Hide ${asset.name}`} onClick={() => toggleHidden(asset)}><Archive size={11} /></button>
                </span>
              </span>
            );
          })}
          {shown.length === 0 && !folderShows && <p className="k-muted k-small" style={{ gridColumn: "1 / -1" }}>No {label.toLowerCase()} {wanted ? "match" : "in this project"}.</p>}
        </div>
      </aside>}
      {hiddenOpen && <HiddenWindow label={label} assets={project.assets.filter((asset) => asset.kind === kind && hidden.has(hideKey(asset)))} thumb={(asset) => thumbOf(asset, square)} onShow={(assets) => { showAgain(assets); if (project.assets.every((asset) => asset.kind !== kind || !hidden.has(hideKey(asset)) || assets.includes(asset))) setHiddenOpen(false); }} onClose={() => setHiddenOpen(false)} />}
    </>
  );
}
