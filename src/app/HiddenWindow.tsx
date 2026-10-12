/**
 * The Hidden folder's window (the author, 2026-10-12): the pictures hidden in one project folder, as cards, each with
 * a button that brings it back to the grid (and Show all). Hiding only tidies the panel: the files stay as they are.
 */
import type { ReactNode } from "react";
import { ArchiveRestore, FolderClosed } from "lucide-react";
import { Button, Dialog } from "../ui/kit";
import type { Asset } from "./model";
import "./HiddenWindow.css";

interface Props {
  /** The folder's name, e.g. "Backgrounds". */
  label: string;
  assets: Asset[];
  thumb: (asset: Asset) => ReactNode;
  onShow: (assets: Asset[]) => void;
  onClose: () => void;
}

export function HiddenWindow({ label, assets, thumb, onShow, onClose }: Props) {
  return (
    <Dialog open wide tall onOpenChange={(open) => { if (!open) onClose(); }} title={`Hidden ${label.toLowerCase()}`} sub={`${assets.length} hidden here; the files stay as they are`} icon={<FolderClosed size={18} />}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><span className="k-spacer" /><Button icon={<ArchiveRestore />} disabled={!assets.length} onClick={() => onShow(assets)}>Show all</Button></>}>
      {assets.length ? (
        <div className="hw-grid" role="list">
          {assets.map((asset) => (
            <div key={asset.file} role="listitem" className="k-card hw-card">
              {thumb(asset)}
              <b title={asset.file}>{asset.name}</b>
              <small>{asset.width} × {asset.height}</small>
              <Button size="sm" icon={<ArchiveRestore />} title={`Bring ${asset.name} back to the grid`} onClick={() => onShow([asset])}>Show</Button>
            </div>
          ))}
        </div>
      ) : <p className="k-muted k-small">Nothing is hidden here any more.</p>}
    </Dialog>
  );
}
