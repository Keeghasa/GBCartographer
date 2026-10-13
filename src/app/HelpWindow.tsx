import { Info, Keyboard } from "lucide-react";
import { createContext, isValidElement, useContext, useState, type ReactNode } from "react";
import { Button, Dialog, Kbd } from "../ui/kit";
import { TOOLS } from "./tools";
import "./HelpWindow.css";

/** The words a piece of help says (for the filter). */
function words(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(words).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return words(node.props.children);
  return "";
}
const Filter = createContext("");

/** One line of help: an optional icon, the name, its keys, and what it does. Hidden when the filter doesn't find it. */
function Row({ icon, name, keys = [], children }: { icon?: ReactNode; name: string; keys?: string[]; children: ReactNode }) {
  const wanted = useContext(Filter);
  const hidden = Boolean(wanted) && !`${name} ${keys.join(" ")} ${words(children)}`.toLowerCase().includes(wanted);
  return (
    <div className="hp-row" hidden={hidden}>
      <span className="hp-icon">{icon}</span>
      <b>{name}</b>
      <span className="hp-keys">{keys.map((key) => <Kbd key={key}>{key}</Kbd>)}</span>
      <p>{children}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="hp-section"><h3 className="k-eyebrow">{title}</h3><div className="hp-rows">{children}</div></section>;
}

/** The ? window: every tool with its key and the long explanation, the other keys, and what Save writes. */
export function HelpWindow({ onClose, onAbout }: { onClose: () => void; onAbout: () => void }) {
  const [filter, setFilter] = useState("");
  return (
    <Filter.Provider value={filter.trim().toLowerCase()}>
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} wide tall title="Tools and keys" icon={<Keyboard size={18} />}
      headExtra={<Button variant="ghost" size="sm" icon={<Info />} onClick={onAbout}>About · v{__APP_VERSION__}</Button>}>
      <div className="k-stack k-stack--loose">
        <input type="search" className="k-input" autoFocus placeholder="Find a tool or key (say “stamp” or “Ctrl+Z”)" aria-label="Find a tool or key" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <Section title="Tools">
          {TOOLS.map(([id, label, Icon, keys, , long]) => <Row key={id} icon={<Icon size={16} />} name={label} keys={[keys]}>{long}</Row>)}
        </Section>
        <Section title="While painting">
          <Row name="Shades" keys={["1–4", "0"]}>Pick a shade. 0 is see-through, in a picture that has see-through pixels.</Row>
          <Row name="Brush size" keys={["[", "]"]}>Smaller or bigger: pixels, or tiles with the palette brush.</Row>
          <Row name="Mirror" keys={["Shift+M"]}>Paint both halves at once: off, left-right, top-bottom, both.</Row>
          <Row name="Linked tiles" keys={["K"]}>Painting a tile paints every identical copy of it too (one-color tiles aren't linked). One undo step per stroke.</Row>
          <Row name="Seamless view">The tile under the pointer (or the selection) repeated 3 × 3 above the picture, to check that it tiles cleanly.</Row>
        </Section>
        <Section title="Selection">
          <Row name="Copy, cut, paste" keys={["Ctrl+C", "Ctrl+X", "Ctrl+V"]}>Work on the selection.</Row>
          <Row name="Select all" keys={["Ctrl+A"]}>Selects the whole picture.</Row>
          <Row name="Drop it" keys={["Esc"]}>Drops the selection.</Row>
          <Row name="Flip, turn" keys={["F", "Shift+F", "T"]}>Flip the selection (or the whole picture) left-right or top-bottom; turn the selection clockwise.</Row>
          <Row name="Outdoor pieces">Asset Catalog → Outdoor pieces, painted as auto-tiles: the mound ledge (M) wraps any plateau of 16 px cells with its rock face; a forest (T) paints 32 px tree units, the clump inside and single trees round the edge; water (~) fits its shores the RPG Maker way and plays its three frames while in hand, as does the Animated tile (Save writes frame 1). Off the picture counts as more of the area, so an area running off the edge shows no border there. Alt clears.</Row>
          <Row name="Saved stamps" keys={["Right-click"]}>Right-click inside a selection to use it as the stamp, or to save it as a stamp in the project's Cartographer/stamps folder (with its tile palettes, on whole tiles). The Stamp tool shows the saved ones above the picture; the Stamps folder in the project panel opens one to edit.</Row>
        </Section>
        <Section title="Files and undo">
          <Row name="Open, save, export" keys={["Ctrl+O", "Ctrl+S", "Ctrl+E"]}>Open PNGs (or Aseprite files, which open as new PNGs), save, export a copy.</Row>
          <Row name="Undo, redo" keys={["Ctrl+Z", "Ctrl+Shift+Z"]}>Undo also brings back palette colors changed in the sidebar.</Row>
          <Row name="Zoom" keys={["Ctrl+=", "Ctrl+-"]}>Zoom in and out.</Row>
          <Row name="Fit" keys={["Ctrl+0"]}>The biggest zoom that shows the whole picture (or click the zoom % in the header).</Row>
          <Row name="Pin, hide">The buttons on a card (on hover): pin keeps it at the top of the grid; hide puts it in the Hidden folder at the top, which shows what's inside on hover and brings them back on click. Only in this panel: the files stay.</Row>
          <Row name="Hide the panels" keys={["`", "~"]}>Hides both side panels for room to paint, and brings them back. The empty part of the left rail and the gap beside the right panel hide one each.</Row>
        </Section>
        <Section title="Tabs">
          <Row name="Next, previous" keys={["Ctrl+Tab", "Ctrl+PgDn", "Ctrl+PgUp"]}>The next and previous picture (Shift+Ctrl+Tab goes back).</Row>
          <Row name="Close" keys={["Alt+W", "Middle-click"]}>Closes the picture (Ctrl+W too, in the desktop app); middle-click a tab to close it. The mouse wheel scrolls the tab strip.</Row>
          <Row name="Close others, close all" keys={["Right-click"]}>Right-click a tab (or use the list at the end of the tab strip). Saved pictures close; unsaved ones are asked about in one window.</Row>
        </Section>
        <Section title="Palettes">
          <Row name="Put in slot, rename, duplicate" keys={["Right-click"]}>Right-click a palette in the list: put it in one of the scene's slots (type to filter), rename it, or duplicate it into the project.</Row>
          <Row name="Fill a slot" keys={["Right-click"]}>Right-click a scene slot to pick any project palette for it (type to filter).</Row>
          <Row name="Copy palettes">The button beside the scene slots puts this background's eight palettes in another background's scene (the same palettes, no copies).</Row>
        </Section>
        <section className="hp-section" hidden={Boolean(filter.trim())}>
          <h3 className="k-eyebrow">What Save writes</h3>
          <div className="k-well hp-save">
            <p>Into a GB Studio project, Save writes only:</p>
            <ul>
              <li>the PNG (same size, or the new size after Resize), and new PNGs from New, the wizards, the Map Room, the Asset Catalog or Duplicate (never replacing a file)</li>
              <li>a background's tile palettes (<code>tileColors</code>) and a sprite sheet's slice palettes (<code>paletteIndex</code>)</li>
              <li>palette files from the palette manager</li>
              <li>when you put a palette in a slot: the scene's palette list or the project's default palettes; when you copy a background's palettes: the other scene's palette list</li>
              <li>a scene's collisions (<code>collisions</code> in its scene.gbsres), painted with the collision brush</li>
              <li>its own folder, <code>Cartographer/</code>: saved stamps and Map Room maps</li>
              <li>Delete (asked every time) moves a picture's files into the backups</li>
            </ul>
            <p className="k-muted">Nothing else. The old file is backed up first (Backups… in the project menu).</p>
          </div>
        </section>
      </div>
    </Dialog>
    </Filter.Provider>
  );
}
