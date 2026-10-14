/**
 * The Asset Catalog (the store, 2026-10-10), remade as a mosaic of live tiles (the author's pick B, 2026-10-14, after
 * the start screen's neo-grotesk, Metro look): one tile per category, sorted as the side bar sorts a project
 * (Palettes; Backgrounds, Sprites, Tilesets, Fonts, Emotes, Avatars, UI; the stamps' Objects, Repeat tiles, Autotiles,
 * Animated tiles), each sized by what it holds, with a collage of its pieces, a big count and its name. A category
 * opens as flat tiles: art to add to the project as a new PNG or open as a new picture (animated tiles play slowly),
 * palette sets to add whole or a palette at a time, each palette with a little scene painted in it. A search looks
 * through everything. Each shelf says who made it, its license (the License button explains it) and its source.
 */
import { ArrowLeft, Blocks, Check, ExternalLink, FilePlus2, Ghost, Palette as PaletteIcon, Plus, Scale, Search, Store, TreePine, Type, Waves } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toRgba } from "../paint";
import { Button, Chip, Dialog, IconButton, Popover } from "../ui/kit";
import type { Canvas } from "../graphics/pen";
import type { WireAsset } from "../graphics/types";

// The graphics library is local-only until its art is approved: the aisle shows when its catalog is there.
const GRAPHICS_LIBRARY = Object.values(import.meta.glob<{ GRAPHICS: WireAsset[] }>("../graphics/library.ts", { eager: true }))[0];
const GRAPHICS = GRAPHICS_LIBRARY?.GRAPHICS ?? [];
import { LICENSES, hasPalette, storeShelves, type StorePalette, type StoreSet } from "./store";
import { AnimThumb } from "./AnimThumb";
import { stampGroup } from "./stampGroups";
import { PhCheckerboard, PhPuzzlePiece, PxAvatar, PxImage, PxMessageReply, PxSmile } from "../ui/setIcons";
import "./StoreWindow.css";

interface Props {
  projectName: string | null;
  /** The project's palettes, to mark what it has already. */
  projectPalettes: readonly StorePalette[];
  onClose: () => void;
  /** Adds palettes to the project; resolves to how many were written. */
  onAddToProject: (palettes: StorePalette[]) => Promise<number>;
  onAddToMine: (palettes: StorePalette[]) => void;
  /** Puts a graphic in the project as a new PNG (and opens it). */
  onAddArt: (asset: WireAsset, art: Canvas) => Promise<boolean>;
  /** Opens a graphic as a new, unsaved picture. */
  onOpenArt: (asset: WireAsset, art: Canvas) => void;
}

const SHELVES = storeShelves();
const GRAPHICS_CREDIT = { author: "Keeghasa (GB Cartographer)", license: "CC0", source: "https://github.com/Keeghasa/GBCartographer/tree/main/src/graphics" };
/** Shelves made from other people's work carry their own credit (each piece's own line names its maker too). */
const GROUP_CREDITS: Record<string, typeof GRAPHICS_CREDIT> = {
  Fonts: { author: "GGBotNet, datagoblin (adapted)", license: "CC0", source: "https://github.com/Keeghasa/GBCartographer/blob/main/src/graphics/fonts.ts" },
};
/** What the catalog's art is (2026-10-14: the art that ships, made to be painted over). */
const ART_ABOUT = "GB Cartographer's own art, free to use: take it in as it is, or paint over it your own way.";
/** What each Art section holds, in a line. */
const GROUP_INTROS: Record<string, string> = {
  People: "Walking characters in GB Studio's classic six-frame strip: GB Studio sets up their animations by itself.",
  Creatures: "Animals and enemies, each a short looping animation.",
  Things: "Single-frame sprites: signs, crates, hearts, coins.",
  "Animated things": "Two-state things (chests, doors, levers) and short loops (coins, sparkles, explosions).",
  Emotes: "16 × 16 bubbles GB Studio shows above an actor's head.",
  Avatars: "16 × 16 faces for dialogue boxes.",
  UI: "GB Studio's window frame (ui/frame.png) and menu cursor (ui/cursor.png).",
  "Tile sheets": "16 × 16 pieces to build backgrounds from, eight to a row.",
  Scenes: "Whole backgrounds to start from: a title screen, a logo splash, a town and a platformer level.",
  Fonts: "GB Studio font sheets (8 × 8 letters from the space character on): one fixed width, one variable width.",
  "Map screens": "A village, whole and cut into six screens that join at their edges, ready for the Map Room.",
  "Outdoor pieces": "The author's cliffs, trees and water as auto-tiles: paint an area and the cliff gets its face, the forest fills it with single trees round the edge, the water's shores fit and its frames play.",
};
const KIND_NAMES: Record<string, string> = { sprites: "Sprite", emotes: "Emote", avatars: "Avatar", ui: "UI", tilesets: "Tileset", backgrounds: "Background", fonts: "Font" };
/** Sites the store links to, in their own colors (a Source button wears its site's). */
const SITES: { host: RegExp; name: string; color: string }[] = [
  { host: /(^|\.)itch\.io$/, name: "itch.io", color: "#FA5C5C" },
  { host: /(^|\.)opengameart\.org$/, name: "OpenGameArt", color: "#4A6898" },
];
const siteOf = (url: string) => { try { const host = new URL(url).hostname; return SITES.find((site) => site.host.test(host)) ?? null; } catch { return null; } };
/** More art and palettes elsewhere: Game Boy assets on itch.io and OpenGameArt. */
const ELSEWHERE = [
  { url: "https://itch.io/game-assets/tag-gameboy", title: "Game Boy assets on itch.io" },
  { url: "https://opengameart.org/art-search?keys=gameboy", title: "Game Boy art on OpenGameArt.org" },
];
const visit = (url: string) => window.open(url, "_blank", "noreferrer");

/** A button to another site: in its colors when it's one we know, else a plain one. */
function SiteButton({ url, label, title }: { url: string; label?: string; title?: string }) {
  const site = siteOf(url);
  return site
    ? <Button size="sm" variant="brand" icon={<ExternalLink />} title={title ?? url} style={{ ["--k-brand" as string]: site.color }} onClick={() => visit(url)}>{label ?? site.name}</Button>
    : <Button size="sm" variant="ghost" icon={<ExternalLink />} title={title ?? url} onClick={() => visit(url)}>{label ?? "Source"}</Button>;
}

const Strip = ({ colors }: { colors: readonly string[] }) => <span className="app-chips">{colors.map((color, at) => <i key={at} style={{ background: color }} />)}</span>;

/** Who made a shelf, its license (explained on click) and a button to its source. */
function Credit({ author, license, source, shelf }: { author?: string; license?: string; source?: string; shelf?: string }) {
  const terms = license ? LICENSES[license] : undefined;
  return (
    <>
      {author && author !== shelf && <span className="k-muted k-small">by {author}</span>}
      {license && (terms
        ? <Popover trigger={<Button size="sm" variant="ghost" icon={<Scale />} title="What this license lets you do">{license}</Button>}>
            <div className="st-license k-stack k-stack--tight"><b>{license}</b><span className="k-small">{terms.text}</span>
              {terms.link && <Button size="sm" icon={<ExternalLink />} onClick={() => visit(terms.link!)}>Read the license</Button>}</div>
          </Popover>
        : <Chip tone="acc">{license}</Chip>)}
      {source && <SiteButton url={source} />}
    </>
  );
}

/** A picture as an image address (pixels in GB greens, see-through kept), made once per piece. */
const urls = new Map<string, string>();
function pictureUrl(key: string, art: Canvas, palette?: readonly string[]): string {
  let url = urls.get(key);
  if (!url) {
    const canvas = Object.assign(document.createElement("canvas"), { width: art.width, height: art.height });
    const cells = new Uint8Array(Math.ceil(art.width / 8) * Math.ceil(art.height / 8)).fill(palette ? 1 : 0);
    canvas.getContext("2d")!.putImageData(new ImageData(toRgba(art.pixels, cells, art.width, palette ? [{ name: "", colors: [...palette] }] : []), art.width, art.height), 0, 0);
    url = canvas.toDataURL();
    urls.set(key, url);
  }
  return url;
}

/**
 * The little scene each palette is shown with (the author, 2026-10-14: "hard to imagine it sometimes"): a corner of
 * the catalog's village (a house, trees, a path), 64 × 48, painted in the palette's four colors.
 */
let sceneArt: Canvas | null | undefined;
function paletteScene(colors: readonly string[]): string | null {
  if (sceneArt === undefined) {
    const village = GRAPHICS.find((asset) => asset.id === "scene-village")?.make();
    sceneArt = village ? { width: 64, height: 48, pixels: Uint8Array.from({ length: 64 * 48 }, (_, at) => { const v = village.pixels[(36 + Math.floor(at / 64)) * village.width + 28 + (at % 64)]; return v > 3 ? 0 : v; }) } : null;
  }
  return sceneArt ? pictureUrl(`scene:${colors.join()}`, sceneArt, colors) : null;
}

type CategoryId = "palettes" | "backgrounds" | "sprites" | "tilesets" | "fonts" | "emotes" | "avatars" | "ui" | "objects" | "repeat" | "autotiles" | "animated";
/** The categories, in the side bar's order and with its icons. */
const CATEGORIES: { id: CategoryId; name: string; about: string; icon: ReactNode }[] = [
  { id: "palettes", name: "Palettes", about: "Palette sets to put in your scenes' slots, or keep in Mine.", icon: <PaletteIcon /> },
  { id: "backgrounds", name: "Backgrounds", about: "Whole scenes and map screens to start from.", icon: <PxImage size={22} /> },
  { id: "sprites", name: "Sprites", about: "Walking people, things, and short animations.", icon: <Ghost /> },
  { id: "tilesets", name: "Tilesets", about: "16 × 16 pieces to build backgrounds from.", icon: <PhPuzzlePiece size={22} /> },
  { id: "fonts", name: "Fonts", about: "GB Studio font sheets, fixed and variable width.", icon: <Type /> },
  { id: "emotes", name: "Emotes", about: "Bubbles above an actor's head.", icon: <PxSmile size={22} /> },
  { id: "avatars", name: "Avatars", about: "Faces for dialogue boxes.", icon: <PxAvatar size={22} /> },
  { id: "ui", name: "UI", about: "The window frame and the menu cursor.", icon: <PxMessageReply size={22} /> },
  { id: "objects", name: "Objects", about: "Plain stamps: trees, rocks, signs.", icon: <TreePine /> },
  { id: "repeat", name: "Repeat tiles", about: "Seamless patterns that tile any way.", icon: <PhCheckerboard size={22} /> },
  { id: "autotiles", name: "Autotiles", about: "Paint an area and the edges draw themselves.", icon: <Blocks /> },
  { id: "animated", name: "Animated tiles", about: "Water, lava and flowers that play their frames.", icon: <Waves /> },
];
const categoryOf = (asset: WireAsset): CategoryId => asset.kind === "stamps" ? stampGroup({ autotile: asset.autotile, tags: asset.group === "Patterns" ? ["pattern"] : [] }) : asset.kind as CategoryId;
const PALETTE_COUNT = SHELVES.reduce((sum, shelf) => sum + shelf.sets.reduce((n, set) => n + set.palettes.length, 0), 0);
/** How many frames an animated stamp's sheet holds side by side. */
const framesOf = (asset: WireAsset, art: Canvas) => asset.autotile === "xpAnim" ? Math.max(1, Math.round(art.width / 48)) : asset.autotile === "atlasAnim" ? 3 : Math.max(1, Math.floor(art.width / art.height));
const isAnimated = (asset: WireAsset) => asset.autotile === "anim" || asset.autotile === "xpAnim" || asset.autotile === "atlasAnim";

/** A piece's picture in a tile: still, or (an animated tile) playing its frames slowly. */
function Piece({ asset, art, className }: { asset: WireAsset; art: Canvas; className?: string }) {
  const src = pictureUrl(asset.id, art);
  if (isAnimated(asset)) return <AnimThumb src={src} frames={framesOf(asset, art)} className={className} />;
  return <img src={src} alt="" className={className} draggable={false} />;
}

export function StoreWindow({ projectName, projectPalettes, onClose, onAddToProject, onAddToMine, onAddArt, onOpenArt }: Props) {
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const pieces = useMemo(() => GRAPHICS.map((asset) => ({ asset, art: asset.make(), category: categoryOf(asset) })), []);
  const count = (id: CategoryId) => id === "palettes" ? PALETTE_COUNT : pieces.filter((piece) => piece.category === id).length;

  const needle = query.trim().toLowerCase();
  const foundArt = needle ? pieces.filter(({ asset }) => `${asset.name} ${asset.group}`.toLowerCase().includes(needle)) : [];
  const foundPalettes = needle ? SHELVES.map((shelf) => ({ ...shelf, sets: shelf.sets.map((set) => set.name.toLowerCase().includes(needle) ? set : { ...set, palettes: set.palettes.filter((palette) => palette.name.toLowerCase().includes(needle)) }).filter((set) => set.palettes.length) })).filter((shelf) => shelf.sets.length) : [];

  const has = (palette: StorePalette) => hasPalette(projectPalettes, palette);
  async function add(palettes: StorePalette[]) { setBusy(true); await onAddToProject(palettes.filter((palette) => !has(palette))); setBusy(false); }
  function toMine(set: StoreSet) { onAddToMine(set.palettes); setMine(new Set(mine).add(set.id)); }
  async function addArt(asset: WireAsset, art: Canvas) { setBusy(true); if (await onAddArt(asset, art)) setAdded(new Set(added).add(asset.id)); setBusy(false); }
  const home = () => { setCategory(null); setQuery(""); };

  /** The home: a tile per category, sized by what it holds. */
  const mosaic = (
    <div className="stm-mosaic">
      {CATEGORIES.map((item) => {
        const n = count(item.id), size = n >= 30 ? "stm-live--4" : n >= 15 ? "stm-live--3" : n >= 6 ? "stm-live--2" : "";
        const collage = item.id === "palettes"
          ? SHELVES.flatMap((shelf) => shelf.sets.flatMap((set) => set.palettes)).slice(0, 24).map((palette) => <span key={palette.name} className="stm-chip">{palette.colors.map((color, at) => <i key={at} style={{ background: color }} />)}</span>)
          : pieces.filter((piece) => piece.category === item.id).slice(0, 18).map(({ asset, art }) => <img key={asset.id} src={pictureUrl(asset.id, art)} alt="" draggable={false} />);
        return (
          <button key={item.id} type="button" className={`stm-live ${size}`} disabled={!n} onClick={() => setCategory(item.id)} title={n ? `${item.name}: ${item.about}` : `${item.name}: none in the catalog yet`}>
            <span className="stm-collage" aria-hidden>{collage}</span>
            <span className="stm-live-top"><span className="stm-icon">{item.icon}</span><span className="stm-big">{n || "–"}</span></span>
            <span><span className="stm-live-name">{item.name}</span><span className="stm-meta">{n ? item.about : "None yet"}</span></span>
          </button>
        );
      })}
    </div>
  );

  const artTiles = (list: typeof pieces) => (
    <div className="stm-tiles">
      {list.map(({ asset, art }) => {
        const wide = art.width / art.height >= 1.6 && !isAnimated(asset), tall = art.height / art.width >= 1.6, small = art.width <= 16 && art.height <= 16;
        return (
          <article key={asset.id} className={`stm-tile${wide ? " stm-tile--wide" : ""}${tall ? " stm-tile--tall" : ""}`} title={asset.about}>
            <div className="stm-pic"><Piece asset={asset} art={art} className={small ? "stm-small" : undefined} /></div>
            <span className="stm-acts">
              {added.has(asset.id) ? <Chip tone="acc"><Check size={12} /> Added</Chip>
                : <Button size="sm" variant="primary" icon={<FilePlus2 />} disabled={!projectName || busy} title={projectName ? `A new PNG in ${asset.kind === "stamps" ? "Cartographer/stamps" : `assets/${asset.kind}`}/ (never replaces a file), opened to paint` : "Open a project to add art to it"} onClick={() => void addArt(asset, art)}>Add</Button>}
              <Button size="sm" variant="ghost" title="Open it as a new picture (Save asks where it goes)" onClick={() => onOpenArt(asset, art)}>Open</Button>
            </span>
            <b className="stm-tile-name">{asset.name}</b>
            <small className="stm-tile-meta">{KIND_NAMES[asset.kind] ?? "Stamp"} · {art.width} × {art.height}</small>
          </article>
        );
      })}
    </div>
  );

  const paletteShelves = (shelves: typeof SHELVES) => shelves.map((shelf) => (
    <section key={shelf.name} className="stm-shelf">
      <header className="stm-sub"><span className="stm-sub-name">{shelf.name}</span><Credit author={shelf.author} license={shelf.license} source={shelf.source} shelf={shelf.name} /></header>
      {shelf.about && <p className="k-muted k-small stm-about">{shelf.about}</p>}
      <div className="stm-sets">
        {shelf.sets.map((set) => {
          const have = set.palettes.filter(has).length, all = have === set.palettes.length;
          return (
            <article key={set.id} className="stm-set">
              <header className="stm-set-head">
                <span><b className="stm-tile-name">{set.name}</b><small className="stm-tile-meta">{set.palettes.length} palette{set.palettes.length === 1 ? "" : "s"}{have && !all ? ` · ${have} in the project` : ""}</small></span>
                {set.source && <SiteButton url={set.source} title={`Where ${set.name} was first posted: visit to support its author`} />}
              </header>
              <div className="stm-palettes">
                {set.palettes.map((palette) => {
                  const scene = paletteScene(palette.colors);
                  return (
                    <div key={palette.name} className="stm-palette">
                      {scene && <img className="stm-scene" src={scene} alt="" draggable={false} title={`${palette.name}, painted on a little scene`} />}
                      <Strip colors={palette.colors} />
                      <span className="stm-palette-name">{palette.name}</span>
                      {has(palette) ? <Check size={14} className="stm-added" aria-label="In the project" />
                        : <IconButton size="sm" variant="ghost" label={projectName ? `Add ${palette.name} to the project` : "Open a project to add palettes"} disabled={!projectName || busy} onClick={() => void add([palette])}><Plus /></IconButton>}
                    </div>
                  );
                })}
              </div>
              <span className="k-row">
                {all && projectName ? <Chip tone="acc"><Check size={12} /> In the project</Chip>
                  : <Button size="sm" variant="primary" disabled={!projectName || busy} title={projectName ? "Adds every palette of the set the project doesn't have yet" : "Open a project to add palettes"} onClick={() => void add(set.palettes)}>{have ? "Add the rest" : "Add set"}</Button>}
                <Button size="sm" variant="ghost" disabled={mine.has(set.id)} title="Keep the set in Mine (the palette manager), for any project" onClick={() => toMine(set)}>{mine.has(set.id) ? "In Mine" : "To Mine"}</Button>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  ));

  const current = CATEGORIES.find((item) => item.id === category);
  const groupCredit = current?.id === "fonts" ? GROUP_CREDITS.Fonts : GRAPHICS_CREDIT;
  let body: ReactNode;
  if (needle) {
    body = <>
      <button type="button" className="stm-back" onClick={home}><ArrowLeft size={14} /> All of the catalog</button>
      <div className="stm-title"><h1 className="stm-h1"><b>“{query.trim()}”</b></h1><span className="k-muted k-small">{foundArt.length + foundPalettes.reduce((n, shelf) => n + shelf.sets.length, 0)} found</span></div>
      {!foundArt.length && !foundPalettes.length && <p className="k-muted">Nothing matches “{query.trim()}”.</p>}
      {foundArt.length > 0 && artTiles(foundArt)}
      {paletteShelves(foundPalettes)}
    </>;
  } else if (current) {
    body = <>
      <button type="button" className="stm-back" onClick={home}><ArrowLeft size={14} /> All of the catalog</button>
      <div className="stm-title">
        <h1 className="stm-h1"><span className="stm-icon stm-icon--big">{current.icon}</span><b>{current.name}</b></h1>
        {current.id !== "palettes" && <span className="stm-credit"><Credit {...groupCredit} /></span>}
      </div>
      <p className="stm-about">{current.id === "palettes" ? current.about : current.id === "fonts" ? `${current.about} ${GROUP_INTROS.Fonts}` : `${current.about} ${ART_ABOUT}`}</p>
      {current.id === "palettes" ? paletteShelves(SHELVES) : artTiles(pieces.filter((piece) => piece.category === current.id))}
    </>;
  } else {
    body = <>
      <div className="stm-head"><span>Everything in the catalog</span><span>{PALETTE_COUNT} palettes · {pieces.length} pieces of art · all CC0 or public domain</span></div>
      {mosaic}
      <div className="stm-foot"><span className="k-row">{ELSEWHERE.map((site) => <SiteButton key={site.url} url={site.url} title={site.title} />)}</span><span>Nothing here replaces a file in your project</span></div>
    </>;
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !busy) { if (category || needle) home(); else onClose(); } }} full title="Asset Catalog" icon={<Store size={18} />}
      sub={projectName ? `Credited palettes and art to take into ${projectName}, piece by piece` : "Credited palettes and art: open a project to add them to it"}
      headExtra={<label className="stm-search"><Search size={14} /><input className="k-input" placeholder="Find a palette or a piece of art" aria-label="Find" value={query} onChange={(event) => setQuery(event.target.value)} /></label>}>
      <div className="stm">{body}</div>
    </Dialog>
  );
}
