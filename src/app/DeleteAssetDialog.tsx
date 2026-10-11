/**
 * Deleting a picture (the author, 2026-10-10): asked every time, with a warning that GB Studio may use the file and
 * the scenes or actors that mention it by name. The files go to GB Cartographer's backups (Backups can put them back).
 */
import { FileImage, Trash2, TriangleAlert } from "lucide-react";
import { Button, Dialog } from "../ui/kit";
import "./CloseWindow.css";

interface Props {
  name: string;
  /** The files that go (project-relative) and the project files that mention it. */
  files: string[];
  uses: string[];
  busy: boolean;
  onDelete: () => void;
  onCancel: () => void;
}

export function DeleteAssetDialog({ name, files, uses, busy, onDelete, onCancel }: Props) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }} title={`Delete ${name}?`} sub="This may be a file your GB Studio game uses" icon={<Trash2 size={18} />}
      footer={<><Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button><span className="k-spacer" /><Button variant="danger" icon={<Trash2 />} disabled={busy} onClick={onDelete}>{busy ? "Deleting…" : "Delete"}</Button></>}>
      <div className="k-stack">
        <div className="k-well k-row" style={{ padding: "10px 12px", alignItems: "flex-start" }}>
          <TriangleAlert size={16} style={{ flex: "none", color: "var(--k-warn)", marginTop: 2 }} />
          <span className="k-small">{uses.length
            ? `GB Studio uses it: ${uses.length === 1 ? "the project file below mentions it and will lose it." : `the ${uses.length} project files below mention it and will lose it.`}`
            : "No scene or actor mentions it, but GB Studio may still use it (events, other projects)."} The files go to GB Cartographer's backups: Backups can put them back.</span>
        </div>
        {uses.length > 0 && <div className="k-stack k-stack--tight">
          <span className="k-eyebrow">Mentioned by</span>
          <ul className="cw-list">{uses.map((use) => <li key={use}><TriangleAlert size={14} /><span className="cw-path k-mono">{use}</span></li>)}</ul>
        </div>}
        <div className="k-stack k-stack--tight">
          <span className="k-eyebrow">Goes to the backups</span>
          <ul className="cw-list">{files.map((file) => <li key={file}><FileImage size={14} /><span className="cw-path k-mono">{file}</span></li>)}</ul>
        </div>
      </div>
    </Dialog>
  );
}
