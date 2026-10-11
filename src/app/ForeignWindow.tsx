/**
 * Pictures from other projects (the author, 2026-10-10): open tabs whose file belongs to another GB Studio project
 * (a tab kept from before a project switch, or a copy of the same project). Their tabs wear a plane; Save never
 * writes them into the open project. Here each can open this project's own copy of the same file, be saved into
 * this project as a new picture (never replacing a file; its tile palettes stay behind), or be closed.
 */
import { FileImage, Plane, X } from "lucide-react";
import { Button, Dialog } from "../ui/kit";
import "./ForeignWindow.css";

export interface ForeignPicture {
  id: number;
  name: string;
  /** Where its file is: the other project's folder, and the file inside it. */
  project: string;
  path: string;
  /** This project has a file at the same place. */
  hereToo: boolean;
}

interface Props {
  pictures: ForeignPicture[];
  projectName: string;
  onOpenHere: (id: number) => void;
  onCopyHere: (id: number) => void;
  onCloseTab: (id: number) => void;
  onCloseAll: () => void;
  onClose: () => void;
}

/** The project's folder and its parent ("wiztest/project"), enough to tell projects apart. */
const folderName = (path: string) => path.split(/[\\/]/).filter(Boolean).slice(-2).join("/") || path;

export function ForeignWindow({ pictures, projectName, onOpenHere, onCopyHere, onCloseTab, onCloseAll, onClose }: Props) {
  return (
    <Dialog open wide onOpenChange={(open) => { if (!open) onClose(); }} title="Pictures from other projects" sub={`Open tabs whose file isn't in ${projectName}: Save doesn't write them here`} icon={<Plane size={18} />}
      footer={<>{pictures.length > 1 && <Button icon={<X />} title="Close every tab listed here (unsaved changes ask first)" onClick={onCloseAll}>Close all {pictures.length}</Button>}<span className="k-spacer" /><Button variant="primary" onClick={onClose}>Done</Button></>}>
      {pictures.length === 0
        ? <p className="k-muted k-small">None: every open picture is from {projectName}, or a PNG file of its own.</p>
        : <ul className="fw-list">{pictures.map((picture) => (
          <li key={picture.id}>
            <Plane size={14} className="fw-plane" />
            <span className="fw-name"><b>{picture.name}</b><span className="k-muted k-xs" title={`${picture.project}/${picture.path}`}>from {folderName(picture.project)} · {picture.path}</span></span>
            <span className="k-spacer" />
            {picture.hereToo && <Button size="sm" icon={<FileImage />} title={`Open ${projectName}'s own ${picture.path} in a tab of its own`} onClick={() => onOpenHere(picture.id)}>Open this project's</Button>}
            <Button size="sm" title={`Save this picture into ${projectName} as a new picture (never replacing a file); its tile palettes stay behind`} onClick={() => onCopyHere(picture.id)}>Save into this project</Button>
            <Button size="sm" variant="ghost" icon={<X />} title="Close this tab (unsaved changes ask first)" onClick={() => onCloseTab(picture.id)}>Close tab</Button>
          </li>
        ))}</ul>}
    </Dialog>
  );
}
