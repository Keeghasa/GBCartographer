/**
 * Closing the desktop app with unsaved changes (the author, 2026-10-10): lists every file Save would change and
 * offers to save them into the GB Studio project, to keep the changes as a draft in GB Cartographer (Save Draft) (they open again
 * next time, as closing always did), or to discard them. Pictures that aren't project files are listed apart:
 * Save to GB Studio leaves them in GB Cartographer. Closing one tab with unsaved changes asks here too, without
 * the keep option (a closed tab's edits go; the author, 2026-10-10), and so do Close all / Close others (2026-10-12):
 * Save writes the project pictures and closes them; pictures from outside the project stay open.
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
  /** Closing these pictures' tabs (their names), not the window. */
  tabs?: string[];
  onSave: () => void;
  /** Close and keep the changes in GB Cartographer (the window only). */
  onKeep?: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function CloseWindow({ changes, busy, tabs, onSave, onKeep, onDiscard, onCancel }: Props) {
  const files = changes.project.length;
  const tab = tabs?.length === 1 ? tabs[0] : undefined;
  const loose = tab !== undefined && files === 0;
  const footer = <>
    <Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
    <span className="k-spacer" />
    <Button variant="danger" icon={<Trash2 />} disabled={busy} title="Close without saving: the unsaved changes are gone (the project's files stay as they are)" onClick={onDiscard}>Discard changes</Button>
    {onKeep && <Button disabled={busy} title="Keep the changes as a draft in GB Cartographer (in the project's Cartographer folder) without writing the GB Studio files; they open again next time, on any computer" onClick={onKeep}>Save Draft</Button>}
    {loose && <Button variant="primary" icon={<Save />} disabled={busy} title="Save this picture as a PNG file, then close the tab" onClick={onSave}>{busy ? "Saving…" : "Save as…"}</Button>}
    {files > 0 && <Button variant="primary" icon={<Save />} disabled={busy} title={`Write ${files === 1 ? "this file" : "these files"} into the GB Studio project (old versions go to Backups) and GB Cartographer's own records with them, then close`} onClick={onSave}>{busy ? "Saving…" : "Save to GB Studio"}</Button>}
  </>;
  return (
    <Dialog open wide onOpenChange={(open) => { if (!open && !busy) onCancel(); }} title={tab ? `Close ${tab}?` : tabs ? `Close ${tabs.length} pictures?` : "Unsaved changes"} sub={tab ? "It has unsaved changes" : tabs ? "They have unsaved changes" : "Before GB Cartographer closes"} icon={<Save size={18} />} footer={footer}>
      <div className="k-stack">
        {files > 0 && <div className="k-stack k-stack--tight">
          <span className="k-eyebrow">Save to GB Studio changes {files === 1 ? "this file" : `these ${files} files`}</span>
          <ul className="cw-list">{changes.project.map((item) => (
            <li key={item.path}>{item.thumb ? <img className="cw-thumb" src={item.thumb} alt="" /> : item.palette ? <PaletteIcon size={14} /> : <FileImage size={14} />}<span className="cw-path k-mono" title={item.path}>{item.path}</span><span className="k-muted k-xs">{item.detail}</span></li>
          ))}</ul>
        </div>}
        {changes.loose.length > 0 && <div className="k-stack k-stack--tight">
          <span className="k-eyebrow">{tab ? "Not a project file" : tabs ? "Not project files (Save leaves them open; Discard closes them)" : "Not in this project (kept in GB Cartographer unless discarded)"}</span>
          <ul className="cw-list">{changes.loose.map((item) => <li key={item.name}>{item.thumb ? <img className="cw-thumb" src={item.thumb} alt="" /> : <FileImage size={14} />}<span className="cw-path k-mono">{item.name}</span></li>)}</ul>
        </div>}
      </div>
    </Dialog>
  );
}
