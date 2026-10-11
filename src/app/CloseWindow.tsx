/**
 * Closing the desktop app with unsaved changes (the author, 2026-10-10): lists every file Save would change and
 * offers to save them into the GB Studio project, to keep the changes in GB Cartographer only (they open again
 * next time, as closing always did), or to discard them. Pictures that aren't project files are listed apart:
 * Save to GB Studio project leaves them in GB Cartographer. Closing one tab with unsaved changes asks here too, without
 * the keep option (a closed tab's edits go; the author, 2026-10-10).
 */
import { FileImage, Palette as PaletteIcon, Save, Trash2 } from "lucide-react";
import { Button, Dialog } from "../ui/kit";
import "./CloseWindow.css";

export interface ClosingChanges {
  /** Files in the GB Studio project that Save would write: the path in the project, and what changes. */
  project: { path: string; detail: string; palette?: boolean; /** The picture as it is now (a data URL). */ thumb?: string }[];
  /** Unsaved pictures that aren't project files. */
  loose: { name: string; thumb?: string }[];
}

interface Props {
  changes: ClosingChanges;
  busy: boolean;
  /** Closing this one picture's tab, not the window. */
  tab?: string;
  onSave: () => void;
  /** Close and keep the changes in GB Cartographer (the window only). */
  onKeep?: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function CloseWindow({ changes, busy, tab, onSave, onKeep, onDiscard, onCancel }: Props) {
  const files = changes.project.length;
  const loose = tab !== undefined && files === 0;
  const footer = <>
    <Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
    <span className="k-spacer" />
    <Button variant="danger" icon={<Trash2 />} disabled={busy} title="Close without saving: the unsaved changes are gone (the project's files stay as they are)" onClick={onDiscard}>Discard changes</Button>
    {onKeep && <Button disabled={busy} title="Close without writing into the project: the pictures open again, unsaved, next time" onClick={onKeep}>Save to GB Cartographer only</Button>}
    {loose && <Button variant="primary" icon={<Save />} disabled={busy} title="Save this picture as a PNG file, then close the tab" onClick={onSave}>{busy ? "Saving…" : "Save as…"}</Button>}
    {files > 0 && <Button variant="primary" icon={<Save />} disabled={busy} title="Write these files into the GB Studio project (old versions go to Backups), then close" onClick={onSave}>{busy ? "Saving…" : "Save to GB Studio project"}</Button>}
  </>;
  return (
    <Dialog open wide onOpenChange={(open) => { if (!open && !busy) onCancel(); }} title={tab ? `Close ${tab}?` : "Unsaved changes"} sub={tab ? "It has unsaved changes" : "Before GB Cartographer closes"} icon={<Save size={18} />} footer={footer}>
      <div className="k-stack">
        {files > 0 && <div className="k-stack k-stack--tight">
          <span className="k-eyebrow">Save to GB Studio project changes {files === 1 ? "this file" : `these ${files} files`}</span>
          <ul className="cw-list">{changes.project.map((item) => (
            <li key={item.path}>{item.thumb ? <img className="cw-thumb" src={item.thumb} alt="" /> : item.palette ? <PaletteIcon size={14} /> : <FileImage size={14} />}<span className="cw-path k-mono" title={item.path}>{item.path}</span><span className="k-muted k-xs">{item.detail}</span></li>
          ))}</ul>
        </div>}
        {changes.loose.length > 0 && <div className="k-stack k-stack--tight">
          <span className="k-eyebrow">{tab ? "Not a project file" : "Not in this project (kept in GB Cartographer unless discarded)"}</span>
          <ul className="cw-list">{changes.loose.map((item) => <li key={item.name}>{item.thumb ? <img className="cw-thumb" src={item.thumb} alt="" /> : <FileImage size={14} />}<span className="cw-path k-mono">{item.name}</span></li>)}</ul>
        </div>}
      </div>
    </Dialog>
  );
}
