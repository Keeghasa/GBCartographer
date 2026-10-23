/**
 * The painter's shared types and constants: tools, zoom steps, tints, storage keys, the project's endpoints, and
 * the shape of an open picture (Doc). No React here.
 */
import { GB_SHADES, type Floating, type Mirror, type Palette, type Rect , type Cells } from "../paint";
import type { AutotileKind } from "./autotile";
import type { CollisionTileDef } from "../gb/collisions";

export type ToolId = "pencil" | "eraser" | "spray" | "line" | "rect" | "rectFill" | "ellipse" | "fill" | "fillErase" | "patternFill" | "patternRect" | "eyedropper" | "palette" | "paletteAll" | "select" | "move" | "hand" | "priority" | "stamp" | "text" | "collision";

export const MIRRORS: Mirror[] = ["off", "x", "y", "xy"];
export const MIRROR_LABEL = { off: "Mirror off", x: "Mirror ↔", y: "Mirror ↕", xy: "Mirror ↔↕" } as const;
export const ZOOMS = [0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48] as const;
export const BUILT_IN_TINTS: Palette[] = [
  { name: "GB greens", colors: [...GB_SHADES] },
  { name: "Gray", colors: ["#FFFFFF", "#AAAAAA", "#555555", "#000000"] },
  { name: "Pocket", colors: ["#C4CFA1", "#8B956D", "#4D533C", "#1F1F1F"] },
];
export const TINT_KEY = "gb-cartographer.tint";
export const GRID_KEY = "gb-cartographer.grid";
export const BUDGET_KEY = "gb-cartographer.tile-budget";
/** GB Studio's background tile budgets (gb/limits.ts): Color Only scenes also merge flipped tiles. */
export const BUDGETS = [{ id: "colorOnly", label: "Color Only · 384", limit: 384, flips: true }, { id: "monochrome", label: "GB / Color + Mono · 192", limit: 192, flips: false }] as const;
export const CUSTOM_TINT_KEY = "gb-cartographer.custom-tint";
export const PROJECT_PANEL_KEY = "gb-cartographer.project-panel";
export const PROJECT_KIND_KEY = "gb-cartographer.project-kind";
export const NAMED_SLOTS_KEY = "gb-cartographer.named-slots";
export const SCREENS_KEY = "gb-cartographer.screens";
export const LOOK_KEY = "gb-cartographer.look";
export const PATTERN_KEY = "gb-cartographer.pattern";
/** GB Studio draws dialogue boxes and menus with the eighth background palette. */
export const UI_SLOT = 7;
/** A backup version's time from its name (2026-10-09T23-12-05-123Z.png). */
export const versionTime = (id: string) => Date.parse(id.replace(/^(\d{4}-\d\d-\d\dT\d\d)-(\d\d)-(\d\d)-(\d{3})Z.*$/, "$1:$2:$3.$4Z"));
/** The dev server and the desktop app serve the open GB Studio project (server/endpoints.ts). */
export const PROJECT_URL = "./__cartographer/gbstudio-assets";
export const ASSET_URL = "./__cartographer/gbstudio-asset";
/** What the system file manager is called here. */
export const FILE_MANAGER_LABEL = /Mac/i.test(navigator.userAgent) ? "Show in Finder" : /Win/i.test(navigator.userAgent) ? "Show in Explorer" : "Show in folder";
/** Bumped when the server's previews change, so cached thumbnails are fetched again (2: sprites show their first frame). */
export const PREVIEW_VERSION = 2;
export const ASSET_KINDS = [["backgrounds", "Backgrounds"], ["sprites", "Sprites"], ["tilesets", "Tilesets"], ["fonts", "Fonts"], ["emotes", "Emotes"], ["avatars", "Avatars"], ["ui", "UI (frame, cursor)"], ["stamps", "Stamps (GB Cartographer)"]] as const;
export type AssetKind = typeof ASSET_KINDS[number][0];
/** Backgrounds and sprite sheets carry palette slots GB Studio reads; tilesets and fonts are plain pictures. */
export const hasSlots = (kind: AssetKind) => kind === "backgrounds" || kind === "sprites" || kind === "tilesets";
/** Kinds GB Studio draws as sprites: key green is see-through in the file. */
export const isKeyed = (kind: AssetKind) => kind === "sprites" || kind === "emotes";
/** How long an animated tile shows each frame, everywhere it plays (2026-10-14: much slower than the old half second). */
export const ANIM_FRAME_MS = 1200;
export const UNDO_LIMIT = 60;
export const UNDO_BYTES = 96 * 1024 * 1024;

/** The parts of the File System Access API used here (Chromium and the desktop app; other browsers download). */
export interface FileHandle { name: string; getFile(): Promise<File>; createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }
export type PickerWindow = Window & {
  showOpenFilePicker?: (options: object) => Promise<FileHandle[]>;
  showSaveFilePicker?: (options: object) => Promise<FileHandle>;
  __gbcFlushSession?: () => Promise<boolean>;
  /** The desktop app asks before its window closes: "close" (nothing unsaved, session written) or "ask" (the page shows Unsaved changes). */
  __gbcRequestClose?: () => Promise<"close" | "ask">;
  /** The desktop app's bridge (electron/preload.ts): a native folder dialog, and closing the window after Unsaved changes. */
  gbc?: { platform: string; chooseProject(): Promise<string | null>; closeWindow?(): void; cancelClose?(): void };
};
export const PNG_TYPES = [{ description: "PNG image", accept: { "image/png": [".png"] } }];
/** What Open takes: PNGs and Aseprite files (read only: they open as new PNGs). */
export const OPEN_TYPES = [{ description: "PNG or Aseprite", accept: { "image/png": [".png"], "application/octet-stream": [".aseprite", ".ase"] } }];

/** One PNG under the GB Studio project's assets folder. */
export interface Asset { kind: AssetKind; file: string; name: string; width: number; height: number; mtime: number; /** A stamp's tags (Cartographer/stamps/<name>.png.json). */ tags?: string[]; /** A stamp drawn as an auto-tile (same sidecar): 9 box, W Wang (autotile.ts). */ autotile?: AutotileKind; /** Not taken into GB Studio yet (no .gbsres) or a stamp: it can be renamed here. */ renamable?: boolean }
/** A project palette also carries its file's modification time, sent back with a rewrite (changed-on-disk check). */
export interface Project { name: string; path: string; assets: Asset[]; palettes: (Palette & { mtime?: number })[] }
/** A sprite sheet's frames: 8 × 16 slices placed at frame-local x, y (see server/assets.ts). */
export interface SpriteFrame { tiles: { x: number; y: number; sliceX: number; sliceY: number; flipX: boolean; flipY: boolean }[] }
export interface SpriteAnimation { name: string; frames: SpriteFrame[] }
/** What the server knows about an asset besides its pixels (see assetInfo in server/assets.ts). */
export interface AssetInfo { mtime: number; tileColors: number[]; slots: string[]; /** The scene's parallax layers (backgrounds). */ parallax?: { height: number; speed: number }[]; /** GB Studio's animSpeed (sprite sheets): 60 / (animSpeed + 1) fps; 255 none. */ animSpeed?: number | null; slotScene?: string | null; /** GB Studio's Automatic color: it reads the colors from the PNG, so a save in greens loses them. */ autoColor?: boolean; metaMtime: number | null; animations?: SpriteAnimation[] }
/** A picture to open: a file (with a handle to save back to), or a project asset with its info. */
/** A file to open; `replace` names an open picture (by id) that it reloads in place (same tab, same zoom). */
export interface Opening { file: File; handle?: FileHandle; asset?: Asset; info?: AssetInfo; replace?: number }

/** A background's GB Studio scenes and their collisions (src/gb/collisions.ts): read when opened, painted with the collision brush, written on Save. */
export interface DocCollisions {
  scenes: { file: string; id: string; name: string; type: string; mtime: number; opened: number[]; values: Uint8Array }[];
  /** The scene the brush paints and the overlay shows. */
  scene: number;
  /** Collision tiles of scene types the project's plugins add. */
  types: Record<string, CollisionTileDef[]>;
}
export interface Snapshot { /** Each scene's collisions (a background in scenes). */ collisionValues?: Uint8Array[]; pixels: Uint8Array; cells: Cells; /** Per tile: draws over sprites (GB Studio's priority flag). */ priority?: Uint8Array; /** The picture's palettes (colors are editable, so undo brings them back). */ palettes?: Palette[]; /** Its size then (a resize is an undo step too) and each cell's slot when opened, laid out for that size. */ width?: number; height?: number; opened?: number[] }
export interface Doc extends Snapshot {
  id: number;
  /** Counts every edit (touch): what the tab's thumbnail redraws on. */
  rev?: number;
  name: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  /** A project background's scenes and their collisions (none: not a project background, or not loaded yet). */
  collision?: DocCollisions;
  /** This picture's own copy of the library palettes: their colors can be edited per picture. */
  palettes: Palette[];
  undo: Snapshot[];
  redo: Snapshot[];
  dirty: boolean;
  handle?: FileHandle;
  /**
   * The GB Studio asset this picture was opened from (Save writes it back; `mtime` is the file's time when read).
   * A background or sprite sheet also carries its eight palette slot ids and its sidecar's time: Save writes each
   * tile's palette into the sidecar (a background's tileColors, a sprite's slices' paletteIndex) as a slot.
   */
  asset?: { kind: AssetKind; file: string; name: string; mtime: number; slots?: string[]; /** The scene whose palette list the slots are; null: the project's default palettes. */ slotScene?: string | null; metaMtime?: number | null; /** Each cell's slot when the picture was opened (-1 unknown): only cells moved off it are written back. */ opened?: number[]; /** Each cell's priority flag when opened. */ openedPriority?: number[]; /** A sprite sheet's animations, for the frames strip. */ animations?: SpriteAnimation[]; /** GB Studio's animSpeed for the sheet. */ animSpeed?: number | null; /** The scene's parallax layers (backgrounds). */ parallax?: { height: number; speed: number }[]; /** The project folder it came from: Save refuses to write it into another project. */ project?: string; /** GB Studio's Automatic color is on (Save asks first). */ autoColor?: boolean };
  /** The file changed on disk while this picture had unsaved changes: the times seen, until Reload or Keep mine. */
  changedOnDisk?: { mtime: number; metaMtime: number | null; /** Keep mine: the bar hides; Save still asks before replacing. */ kept?: boolean };
  /** A PNG opened from disk (not a project picture): its file's time when read or saved, to notice other apps saving it. */
  fileTime?: number;
  /** Per tile (backgrounds and tilesets): 1 when it draws over sprites (bit 7 of GB Studio's tileColors). */
  priority?: Uint8Array;
  /** Resized since it was opened or saved: Save writes the new size (a project asset's size is otherwise fixed). */
  resized?: boolean;
  /**
   * The draft layer (retried 2026-10-15): the picture as it was when the draft began. The tools paint the picture as
   * usual; every pixel that now differs from this is the draft, shown at 50 % over the old picture. Commit keeps the
   * draft (one undo back), Wipe puts this back. Only in memory: a resize drops it.
   */
  draft?: { pixels: Uint8Array };
  /** A font sheet: see-through pixels are magenta in the file (a variable-width glyph's unused columns). */
  keyMagenta?: boolean;
  /** A sprite sheet: see-through pixels are GB Studio's key green in the file. */
  keyGreen?: boolean;
  zoom: number;
  sel: Rect | null;
  float: Floating | null;
}
export type Point = { x: number; y: number };
export type Drag =
  | { kind: "stroke"; last: Point; /** Shift held: the line's start and the picture before it. */ lock?: { origin: Point; base: Uint8Array } }
  | { kind: "spray" | "cells"; last: Point }
  | { kind: "priority"; last: Point; on: boolean }
  | { kind: "stamp"; origin: Point; last: Point }
  /** A box auto-tile stamp stretched over a dragged rectangle (redrawn over `base` as the pointer moves). */
  | { kind: "box"; origin: Point; base: Uint8Array; baseCells: Uint16Array }
  /** A tile-sheet auto-tile stamp (Wang, edges, path, wall face) painted (or, with Alt, cleared) tile by tile. */
  | { kind: "auto"; last: Point; erase: boolean }
  | { kind: "atlas"; last: Point; erase: boolean }
  | { kind: "mound"; last: Point; erase: boolean }
  | { kind: "xp"; last: Point; erase: boolean }
  | { kind: "forest"; last: Point; erase: boolean; /** The stroke's unit grid, in tiles (0–3): where the first click put it. */ ox: number; oy: number }
  /** A corner-Wang stamp painted at grid corners (`last` is a corner, in tiles). */
  | { kind: "corner"; last: Point; erase: boolean }
  /** The collision brush painting GB Studio collisions tile by tile (Alt or right-drag clears). */
  | { kind: "collision"; last: Point; erase: boolean }
  | { kind: "shape"; start: Point; base: Uint8Array; /** Dragged off its first pixel (a Pattern fill click floods instead). */ moved?: boolean;
      /** Alt while dragging turns a rectangle or ellipse: its angle (radians), and where the turn began. */ angle?: number; turn?: { end: Point; from: number; angle: number };
      /** Shift+Alt tilts it in 3D: pitch and yaw (radians), and where the tilt began. */ tilt?: { pitch: number; yaw: number }; tilting?: { end: Point; at: Point; pitch: number; yaw: number } }
  | { kind: "marquee"; start: Point }
  | { kind: "move"; start: Point; ox: number; oy: number }
  | { kind: "pan"; x: number; y: number; left: number; top: number };
