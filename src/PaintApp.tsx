/**
 * GB Cartographer: a small painter for GB Studio pictures (backgrounds, sprite sheets, tilesets) and any Game Boy PNG.
 * Each open file is one flat picture in the four GB shades; tiles (8 × 8) may wear a palette from the project.
 * A tint only changes how the plain tiles look while painting. Saving writes one flat PNG, and for a project
 * picture also its tile palettes (see server/endpoints.ts).
 */
import { Box, Settings as SettingsIcon, Check, Layers, Eraser, Pause, Play, FileImage, Mountain, Pickaxe, Store as StoreIcon, ChevronDown, Clock, Copy, ImagePlus, FolderArchive, FolderSearch, FolderX, Gamepad2, History, Info, MessageSquare, RotateCcw, FilePlus, FolderOpen, FolderTree, Grid3x3, Magnet, Map as MapIcon, Minus, SwatchBook, Plus, Redo2, Rocket, Save, Undo2, X, Plane, CopyPlus, Trash2, BrickWall, CopyX, SquareX, Pencil } from "lucide-react";
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { LogoMark } from "./ui/LogoMark";
import { applyFont, loadFont, type FontChoice } from "./ui/theme";
import PaletteManager, { addToMine } from "./PaletteManager";
import BackupsWindow from "./BackupsWindow";
import { attachMiddlePan, attachWheelZoom, nextStep } from "./ui/wheelZoom";
import { CELL, CLEAR, GB_SHADES, KEY_GREEN, KEY_MAGENTA, assignSlots, spriteShades, cellsWide, clipRect, colorize, countUniqueTiles, drop, fillRect, PATTERNS, type Pattern, mergeNearTiles, tileUsage, type TileUsage, dropCells, flipFloat, gbcCorrect, LOOK_SHADES, type Look, lift, liftCells, onTiles, rotateFloat, paletteSlots, timeVariant, quantize, shadeLut, toRgba, type Floating, type Mirror, type Palette } from "./paint";
import { ANIM_FRAME_MS, ASSET_URL, BUDGETS, BUDGET_KEY, BUILT_IN_TINTS, CUSTOM_TINT_KEY, FILE_MANAGER_LABEL, GRID_KEY, MIRRORS, NAMED_SLOTS_KEY, SCREENS_KEY, LOOK_KEY, PATTERN_KEY, PNG_TYPES, OPEN_TYPES, PROJECT_KIND_KEY, PROJECT_PANEL_KEY, PROJECT_URL, TINT_KEY, UI_SLOT, UNDO_BYTES, UNDO_LIMIT, ZOOMS, hasSlots, isKeyed, versionTime, type Asset, type AssetInfo, type AssetKind, type Doc, type FileHandle, type Opening, type PickerWindow, type Point, type Project, type ToolId } from "./app/model";
import { copyName } from "./app/names";
import { PATTERN_TAG } from "./app/stampGroups";
import { TOOLS } from "./app/tools";
import { readStored, sessionStore, store } from "./app/storage";
import { HelpWindow } from "./app/HelpWindow";
import { AboutWindow } from "./app/AboutWindow";
import { HealthWindow } from "./app/HealthWindow";
import { SpriteOnBackground } from "./app/SpriteOnBackground";
import { DialoguePreview } from "./app/DialoguePreview";
import { MapRoom } from "./app/MapRoom";
import { FitWindow } from "./app/FitWindow";
import { PictureWizard } from "./app/PictureWizard";
import { DnsWizard } from "./app/DnsWizard";
import { BudgetFixer } from "./app/BudgetFixer";
import { CheckupWizard } from "./app/CheckupWizard";
import { PaletteSetWizard } from "./app/PaletteSetWizard";
import { GeneratorWizard, type GeneratorMode } from "./app/GeneratorWizard";
import { StoreWindow } from "./app/StoreWindow";
import { WizardGallery, type WizardCard } from "./app/WizardGallery";
import { SnapshotWindow } from "./app/SnapshotWindow";
import { SettingsWindow } from "./app/SettingsWindow";
import type { Generated } from "./app/generators";
import type { FitResult } from "./app/pictureFit";

/** A finished picture from a wizard: shades, each tile's palette (1-based, 0 none) and those palettes. */
type FittedPicture = Pick<FitResult, "width" | "height" | "pixels" | "cells" | "palettes"> & { /** The palettes' own names (else "<name> 1"…). */ names?: string[] };
import { NewPictureWindow, ResizeWindow, type NewPicture } from "./app/NewPictureWindow";
import { Button, Chip, IconButton, Kbd, Menu, MenuAt, TabList, Tabs, Tooltip, useConfirm, usePrompt, type MenuEntry } from "./ui/kit";
import "./app/shell.css";
import { StartScreen } from "./app/StartScreen";
import { ProjectPanel } from "./app/ProjectPanel";
import { encodeGif } from "./gb/gif";
import { framesOf, saveFile } from "./app/files";
import { ToolColumn } from "./app/ToolColumn";
import { PicturePane } from "./app/PicturePane";
import { usePainting } from "./app/usePainting";
import { PhCheckerboard, PhPiggyBank, PhSticker, PxCloudMoon, PxGamepad, PxHeart, PxLightbulb, PxWizard } from "./ui/setIcons";
import { PalettesPane } from "./app/PalettesPane";
import { FramesStrip } from "./app/FramesStrip";
import { StampsStrip } from "./app/StampsStrip";
import { TextStrip, type TextSettings } from "./app/TextStrip";
import { readFontSheet, renderText, type FontSheet } from "./app/textTool";
import { encodeText, fetchFontMap, glyphOf, textWidth } from "./gb/font";
import { SaveStampDialog, type StampSave } from "./app/SaveStampDialog";
import { CloseWindow, type ClosingChanges } from "./app/CloseWindow";
import type { CaveTiles } from "./app/generators";
import { DeleteAssetDialog } from "./app/DeleteAssetDialog";
import { MessagesWindow, Toasts, useMessages } from "./app/Messages";
import { ForeignWindow, type ForeignPicture } from "./app/ForeignWindow";
import { TIMES, palettesWithTimes, timeColors, useTimeOfDay } from "./app/useTimeOfDay";
import { ATLAS_W, autotileOf as autotileKind, type AutotileKind } from "./app/autotile";
import { collisionBrush, collisionLook, DEFAULT_COLLISIONS, iconPixels, SCENE_TYPE_COLLISIONS, type CollisionTileDef } from "./gb/collisions";
import { CollisionStrip } from "./app/CollisionStrip";
import { inflateZlib, isAseprite, readAseprite } from "./gb/aseprite";
import { applyUnsaved, fingerprint, unsavedOf, type UnsavedPicture } from "./app/unsaved";

/**
 * A new picture's id: never one used before in this page (2026-10-14: a reused id let a reload still in flight for a
 * closed tab land on the new tab that took its id), and above every open one (the counter restarts when the module
 * reloads in development).
 */
let lastDocId = 0;
const newDocId = (docs: readonly { id: number }[]) => (lastDocId = Math.max(lastDocId, docs.reduce((top, item) => Math.max(top, item.id), 0)) + 1);

export default function PaintApp() {
  const docs = useRef<Doc[]>([]);
  /** The active tab's id as of the latest change (the session timer's writeSession is from an older render). */
  const activeRef = useRef(-1);
  const [, bump] = useReducer((count: number) => count + 1, 0);
  const [activeId, setActiveId] = useState(0);
  activeRef.current = activeId;
  const [tool, setToolState] = useState<ToolId>("pencil");
  const [shade, setShade] = useState(3);
  const [brush, setBrush] = useState(1);
  /** The palette brush's size in tiles (1, 2 × 2 or 3 × 3). */
  const [cellBrush, setCellBrush] = useState(1);
  const [mirror, setMirror] = useState<Mirror>("off");
  const [grid, setGrid] = useState<0 | 8 | 16>(() => readStored(GRID_KEY, 8));
  const [budgetId, setBudgetId] = useState<string>(() => readStored(BUDGET_KEY, "colorOnly"));
  const [tileCount, setTileCount] = useState(0);
  const [snap, setSnap] = useState(false);
  /** Outlines every 160 × 144 area of the picture: one Game Boy screen. */
  const [screens, setScreens] = useState<boolean>(() => readStored(SCREENS_KEY, false));
  /** How the picture shows while painting: plain, or like an original, Pocket or Color Game Boy screen. */
  const [look, setLook] = useState<Look>(() => readStored(LOOK_KEY, "plain"));
  /** The tile budget view: tiles used once and tiles that nearly match another, over the picture. */
  const [budgetView, setBudgetView] = useState(false);
  /** Linked tiles: painting one tile paints every identical copy (one-color tiles are not linked). */
  const [linked, setLinked] = useState(false);
  /** Seamless view: the tile under the pointer (or the selection) repeated 3 × 3 above the picture. */
  const [seamless, setSeamless] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const seamlessCanvas = useRef<HTMLCanvasElement>(null);
  /** The repeat tile's copies around the picture (a pattern stamp, the author 2026-10-13). */
  const repeatCanvas = useRef<HTMLCanvasElement>(null);
  /** The fill pattern for Flood fill and Filled rectangle (D cycles it). */
  const [pattern, setPattern] = useState<Pattern>(() => readStored(PATTERN_KEY, "solid"));
  // The Pattern fill tool's pattern (never solid: the other fills are; the author, 2026-10-13).
  const PATTERNED = PATTERNS.filter((item) => item.id !== "solid");
  const patternInUse = pattern === "solid" ? PATTERNED[0].id : pattern;
  const cyclePattern = () => { const next = PATTERNED[(PATTERNED.findIndex((item) => item.id === patternInUse) + 1) % PATTERNED.length]; setPattern(next.id); store(PATTERN_KEY, next.id); say(`Pattern: ${next.label}`); };
  const [usage, setUsage] = useState<{ key: string; usage: TileUsage } | null>(null);
  const usageCanvas = useRef<HTMLCanvasElement>(null);
  const priorityCanvas = useRef<HTMLCanvasElement>(null);
  const collisionCanvas = useRef<HTMLCanvasElement>(null);
  /** Atlas water in hand: its frames played over every painted cell (the author, 2026-10-12; Save writes frame 1). */
  const atlasAnimCanvas = useRef<HTMLCanvasElement>(null);
  /** The draft layer's new pixels, drawn at 50 % over the old picture. */
  const draftCanvas = useRef<HTMLCanvasElement>(null);
  const [atlasPlaying, setAtlasPlaying] = useState(false);
  /** The animated stamp's frames over the picture stopped (the author, 2026-10-13: a button to stop them); kept per computer. */
  const [animStopped, setAnimStopped] = useState(() => readStored("gbc-anim-stopped", false));
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [activePalette, setActivePalette] = useState(0);
  const [tint, setTint] = useState(() => readStored(TINT_KEY, "GB greens"));
  const [customTint, setCustomTint] = useState<string[]>(() => readStored(CUSTOM_TINT_KEY, [...GB_SHADES]));
  const [copiedColors, setCopiedColors] = useState<string[] | null>(null);
  const [paletteFilter, setPaletteFilter] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  /** Whether the page is served by something that can open a project (the dev server or the desktop app). */
  const [served, setServed] = useState(false);
  const [showPalettes, setShowPalettes] = useState(false);
  // A palette for the palette manager to show first (Project health's Open on a palette).
  const [paletteFocus, setPaletteFocus] = useState<string | undefined>();
  const [showStore, setShowStore] = useState(false);
  const [showWizards, setShowWizards] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  /** The start screen was left (a project opened, or pictures were opened without one). */
  const [startDone, setStartDone] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showForeign, setShowForeign] = useState(false);
  /** Yes / no questions in a kit dialog (in place of the browser's confirm box). */
  const [confirmDialog, confirmBox] = useConfirm();
  const [promptDialog, askText] = usePrompt();
  /** The right-hand panel (swatches, Palettes and Picture tabs): the thin handle beside it hides and shows it. */
  const [showSide, setShowSide] = useState(() => readStored("gbc-side", true));
  /** Delete… on a picture: what goes and what mentions it, while the confirm is up. */
  const [deleting, setDeleting] = useState<{ asset: Asset; files: string[]; uses: string[]; busy: boolean } | null>(null);
  const [showHealth, setShowHealth] = useState(false);
  const [showPictureWizard, setShowPictureWizard] = useState(false);
  /** The wizard open (W2…W8 from the Wizards menu), if any. */
  /** Unsaved changes when the desktop window closes: what would change, and whether Save is running. */
  const [closing, setClosing] = useState<{ changes: ClosingChanges; busy: boolean; /** Closing these tabs, not the window. */ tabs?: Doc[] } | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [wizard, setWizard] = useState<"dns" | "paletteSet" | "budget" | "checkup" | GeneratorMode | null>(null);
  /** A wizard waiting for a project picture with palette slots to open (Dawn, sunset and night picked with none open). */
  const [wizardAfterOpen, setWizardAfterOpen] = useState<"dns" | null>(null);
  const [stampSave, setStampSave] = useState<{ hint: string; resolve: (save: StampSave | null) => void } | null>(null);
  const [showDialogue, setShowDialogue] = useState(false);
  const [showMapRoom, setShowMapRoom] = useState(false);
  /** Fit to GB Studio's colors: the picture as shown (its colors), when open. */
  const [fitting, setFitting] = useState<Uint8ClampedArray | null>(null);
  /** Try the sprite sheet's animation on one of the project's backgrounds: its frames, drawn when opened. */
  const [onBackground, setOnBackground] = useState<HTMLCanvasElement[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showResize, setShowResize] = useState(false);
  /** Whether the user was warned this session that GB Studio is open (it may overwrite project JSON when it saves). */
  const gbStudioWarned = useRef(false);
  /** Projects whose GB Studio version note was shown this session. */
  const versionNoted = useRef(new Set<string>());
  /** True while Save runs: the changed-on-disk check waits, since Save itself changes the files. */
  const saving = useRef(false);
  const shadeInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [recent, setRecent] = useState<{ name: string; path: string }[]>([]);
  // Whether this build has the demo project with its art (builds from GitHub don't, until its artists say yes).
  const [hasDemo, setHasDemo] = useState(false);
  /** The right-click menu on a picture card: where it opened and for which asset. */
  const [assetMenu, setAssetMenu] = useState<{ x: number; y: number; asset: Asset } | null>(null);
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; doc: Doc } | null>(null);
  /** The project menu (open another, the demo, recent, close), anchored under the button that opened it. */
  const [projectMenu, setProjectMenu] = useState<{ x: number; y: number } | null>(null);
  /** The "Put in slot" menu for a palette of the open picture (its index in the picture's palettes, from 1). */
  /** The Backups window, open on a file (a path inside the project) or on the newest backup. */
  const [backups, setBackups] = useState<{ file?: string } | null>(null);
  /** The Export menu: a copy of the file, or an image to share (as shown or in greens, scaled). */
  const [exportMenu, setExportMenu] = useState<{ x: number; y: number } | null>(null);
  /** The palette right-click popup: `palette` is a palette number; with `slot`, it fills that slot instead (2026-10-12). */
  const [slotMenu, setSlotMenu] = useState<{ x: number; y: number; palette: number; slot?: number } | null>(null);
  const [slotQuery, setSlotQuery] = useState("");
  /** Copy palettes (2026-10-12): the background picker for the open background's eight slots. */
  const [copyMenu, setCopyMenu] = useState<{ x: number; y: number } | null>(null);
  /** The text tool: font, words and look, and the floating text it made (while it floats). */
  const [textSettings, setTextSettings] = useState<TextSettings>({ font: "", text: "Hello!", ink: 3, invert: false, box: false });
  const textFloat = useRef<Floating | null>(null);
  const fontSheets = useRef(new Map<string, FontSheet>());
  /** The selection's right-click menu: use or save it as a stamp, copy. */
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number } | null>(null);
  /** Time-of-day versions ("DWC-2-Computer D") save as their base palette's slot when the base is in the slots. */
  const [namedSlots, setNamedSlots] = useState<boolean>(() => readStored(NAMED_SLOTS_KEY, false));
  const namedSlotsRef = useRef(namedSlots);
  namedSlotsRef.current = namedSlots;
  /** Bumped when palette slots change, so thumbnails are drawn again. */
  const [slotsVersion, setSlotsVersion] = useState(0);
  const projectRef = useRef<Project | null>(null);
  /** The frames strip: which animation and frame of the open sprite sheet is current, and whether it plays. */
  const [frame, setFrame] = useState({ animation: 0, index: 0 });
  const [playing, setPlaying] = useState(false);
  /** The font sample: a sentence drawn with the open font sheet's glyphs (ASCII from 32, 16 glyphs a row). */
  const [sampleText, setSampleText] = useState("The quick brown fox jumps over the lazy dog. 0123456789");
  const sampleCanvas = useRef<HTMLCanvasElement>(null);
  const frameCanvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [sideTab, setSideTab] = useState<"palettes" | "picture">("palettes");
  const [font, setFont] = useState<FontChoice>(() => loadFont());
  const [showProject, setShowProject] = useState<boolean>(() => readStored(PROJECT_PANEL_KEY, true));
  const [projectKind, setProjectKind] = useState<AssetKind>(() => readStored(PROJECT_KIND_KEY, "backgrounds"));
  // Messages: toasts at the bottom left, and every message of the session for the Messages window.
  const messages = useMessages();
  const [showMessages, setShowMessages] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const brushRef = useRef<HTMLDivElement>(null);
  const clip = useRef<Floating | null>(null);
  /** The palettes of the picture a clip was copied from, so its tile palettes land on the same palettes when pasted. */
  const clipPalettes = useRef<Palette[]>([]);
  const lastRecolor = useRef(0);
  /** Counts edits, so work that follows the pixels (the tile budget view) knows when to look again. */
  const editCount = useRef(0);
  const spaceDown = useRef(false);
  const paintTool = useRef<ToolId>("pencil");
  const palettesRef = useRef<Palette[]>([]);
  const palettesReady = useRef<Promise<void> | null>(null);
  const sessionTimer = useRef(0);

  const doc = docs.current.find((item) => item.id === activeId) ?? null;
  const tintColors = tint === "Custom" ? customTint : [...BUILT_IN_TINTS, ...palettes].find((item) => item.name === tint)?.colors ?? GB_SHADES;
  const docPalettes = doc?.palettes ?? palettes;
  // On a sprite sheet a palette's color 0 is see-through, so its colors 1-3 dress the shades.
  const shown = (colors: readonly string[]) => doc?.keyGreen ? spriteShades(colors) : colors;
  // The Picture tab's time of day: each palette drawn as its dawn / sunset / night version (view only).
  const timeOfDay = useTimeOfDay();
  const luts = [tintColors, ...docPalettes.map((palette) => shown(timeColors(palette, palettes, timeOfDay.view)))].map((colors) => shadeLut(colors));
  const picked = activePalette ? docPalettes[activePalette - 1] : undefined;
  const swatchColors = picked ? shown(picked.colors) : tintColors;
  const clonePalettes = (list: readonly Palette[]): Palette[] => list.map(({ name, colors, id }) => ({ name, colors: [...colors], ...(id ? { id } : {}) }));
  const blank = (target: Doc) => target.hasAlpha ? CLEAR : 0;
  /** A picture that may take see-through pixels: a loose PNG or a stamp (GB Studio itself only keeps them on sprites and emotes, already see-through). */
  const canSeeThrough = (target: Doc) => !target.asset || target.asset.kind === "stamps";
  // The collision brush: the picked collision tiles of the scene being edited (GB Studio's value and mask).
  const [collisionPick, setCollisionPick] = useState<string[]>(["solid"]);
  const [showCollisions, setShowCollisions] = useState<boolean>(() => readStored("gbc-collisions", false));
  const collisionDefs = (target: Doc | null): CollisionTileDef[] => {
    const scene = target?.collision?.scenes[target.collision.scene];
    if (!scene) return [];
    return (target!.collision!.types[scene.type] ?? SCENE_TYPE_COLLISIONS[scene.type] ?? DEFAULT_COLLISIONS);
  };
  const { takeStamp, setStamp, heldStamp: stampInHand, pointerDown, pointerMove, pointerUp } = usePainting({
    doc, tool, shade, brush, cellBrush, mirror, pattern: patternInUse, linked, snap, seamless, activePalette, hoverCell,
    wrapRef, scrollerRef, readoutRef, brushRef, spaceDown, paintTool,
    setShade, setActivePalette, setHoverCell, setToolState, say, pushUndo, touch, bump, floatSelection, dropFloat, moveFloat, clonePalettes, blank,
    onSelectionMenu: (x, y) => setSelectionMenu({ x, y }),
    onPlaceText: (point) => void placeText(point),
    collisionBrush: () => collisionBrush(collisionDefs(doc).filter((def) => collisionPick.includes(def.key))),
    paletteBlocked: () => {
      // A project picture with slots: only palettes loaded into them paint (Save couldn't write the others).
      const slots = doc?.asset?.slots;
      if (!doc || !slots?.length || !activePalette || paletteSlots(doc.palettes, slots, namedSlots).has(activePalette)) return null;
      const name = doc.palettes[activePalette - 1]?.name ?? "That palette";
      return `${name} isn't in ${doc.asset?.slotScene ? `${doc.asset.slotScene}'s` : "the project's default"} palette slots, so GB Studio can't show it on these tiles. Put it in a slot first (right-click it in the list).`;
    },
  });

  /** A message: it slides in at the bottom left (Messages.tsx) and is kept for the Messages window. */
  function say(message: string) {
    messages.say(message);
  }

  function setTool(next: ToolId) {
    // Picking the stamp with a selection makes the selection the stamp.
    if (next === "stamp" && doc?.sel) { takeStamp(doc, doc.sel); heldStamp.current = null; }
    if (doc && next !== "select" && next !== "move" && next !== "hand") dropFloat(doc);
    if (next !== "eyedropper" && next !== "hand") paintTool.current = next;
    setToolState(next);
  }

  // ---- session -------------------------------------------------------------------------------------------------

  function writeSession() {
    window.clearTimeout(sessionTimer.current);
    const value = {
      active: docs.current.findIndex((item) => item.id === activeRef.current),
      docs: docs.current.map(({ name, width, height, pixels, cells, priority, hasAlpha, palettes, dirty, handle, asset, keyGreen, keyMagenta, resized, zoom, float, collision }) => {
        // A floating piece is kept dropped in place, with its tile palettes.
        const flat = pixels.slice(), flatCells = cells.slice();
        if (float) { drop(flat, width, height, float); dropCells(flatCells, width, height, float); }
        return { name, width, height, pixels: flat, cells: flatCells, priority, hasAlpha, palettes, dirty, handle, asset, keyGreen, keyMagenta, resized, zoom, collision };
      }),
    };
    void syncUnsaved();
    return sessionStore("readwrite", (objects) => objects.put(value, "open")).then(() => true);
  }

  // ---- what travels with the project (Cartographer/, server/own.ts; the author's picks 2026-10-12) ---------------

  /** Unsaved project pictures written to Cartographer/unsaved: "kind/file" → fingerprint of what was written. */
  const unsavedKept = useRef<{ project: string; kept: Map<string, string> } | null>(null);
  const unsavedBusy = useRef(false);
  /** A sync asked for while one ran: it runs again when that one ends (so the last change is never skipped). */
  const unsavedAgain = useRef(false);
  const ownLoadedFor = useRef<string | null>(null);
  const sessionLoaded = useRef<Promise<void>>(Promise.resolve());

  /** Writes each unsaved project picture that changed since last time, and takes away the ones no longer unsaved. */
  async function syncUnsaved() {
    const here = projectRef.current?.path;
    if (!here || unsavedKept.current?.project !== here) return;
    if (unsavedBusy.current) { unsavedAgain.current = true; return; }
    unsavedBusy.current = true;
    try {
      const kept = unsavedKept.current.kept, live = new Set<string>();
      for (const item of docs.current) {
        if (!item.asset || (item.asset.project && item.asset.project !== here) || !item.dirty) continue;
        const key = `${item.asset.kind}/${item.asset.file}`;
        live.add(key);
        const print = fingerprint(item);
        if (kept.get(key) === print) continue;
        const flat = item.float ? { ...item, pixels: item.pixels.slice(), cells: item.cells.slice() } : item;
        if (item.float) { drop(flat.pixels, item.width, item.height, item.float); dropCells(flat.cells, item.width, item.height, item.float); }
        const response = await fetch(`./__cartographer/unsaved?${assetQuery(item.asset)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(unsavedOf(flat)) }).catch(() => null);
        if (response?.ok) kept.set(key, print);
      }
      for (const key of [...kept.keys()]) {
        if (live.has(key)) continue;
        const [kind, ...rest] = key.split("/");
        const response = await fetch(`./__cartographer/unsaved?${new URLSearchParams({ kind, file: rest.join("/") })}`, { method: "DELETE" }).catch(() => null);
        if (response?.ok) kept.delete(key);
      }
    } finally {
      unsavedBusy.current = false;
    }
    if (unsavedAgain.current) { unsavedAgain.current = false; await syncUnsaved(); }
  }

  /**
   * A project just opened: its own choices (the Time-of-day switch; this browser's old setting moves in the first
   * time) and its pictures' unsaved changes from Cartographer/unsaved, opened as unsaved pictures (a picture already
   * open here with its own unsaved changes keeps them).
   */
  async function loadOwn(path: string) {
    const own = await fetch("./__cartographer/own-settings", { cache: "no-cache" }).then((response) => response.json() as Promise<{ settings?: { timeOfDay?: boolean } }>).catch(() => null);
    if (projectRef.current?.path !== path) return;
    if (typeof own?.settings?.timeOfDay === "boolean") setNamedSlots(own.settings.timeOfDay);
    else void fetch("./__cartographer/own-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeOfDay: readStored(NAMED_SLOTS_KEY, false) }) }).catch(() => null);
    await sessionLoaded.current;
    const listed = await fetch("./__cartographer/unsaved", { cache: "no-cache" }).then((response) => response.json() as Promise<{ pictures?: { kind: string; file: string; data: UnsavedPicture }[] }>).catch(() => null);
    if (projectRef.current?.path !== path) return;
    const kept = new Map<string, string>();
    unsavedKept.current = { project: path, kept };
    let opened = 0;
    for (const { kind, file, data } of listed?.pictures ?? []) {
      const key = `${kind}/${file}`;
      kept.set(key, "");
      const mine = (item: Doc) => item.asset?.kind === kind && item.asset.file === file && item.asset.project === path;
      let target = docs.current.find(mine);
      if (target?.dirty) continue;
      const asset = projectRef.current?.assets.find((item) => item.kind === kind && item.file === file);
      if (!asset) continue;
      if (!target) { await openAsset(asset); target = docs.current.find(mine); }
      if (target && applyUnsaved(target, data)) { opened += 1; if (target.asset && data.assetMtime && target.asset.mtime > data.assetMtime + 1) target.changedOnDisk = { mtime: target.asset.mtime, metaMtime: target.asset.metaMtime ?? null }; }
    }
    if (opened) { say(`${opened} picture${opened === 1 ? "" : "s"} with unsaved changes kept in this project opened again.`); bump(); }
    void syncUnsaved();
  }

  /** The Time-of-day palettes switch, kept in the project (it changes what Save writes). */
  function setTimeOfDay(on: boolean) {
    setNamedSlots(on);
    if (projectRef.current) void fetch("./__cartographer/own-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeOfDay: on }) }).catch(() => null);
    else store(NAMED_SLOTS_KEY, on);
  }

  function scheduleSession() {
    window.clearTimeout(sessionTimer.current);
    sessionTimer.current = window.setTimeout(() => void writeSession(), 800);
  }

  function touch(target: Doc) {
    editCount.current += 1;
    target.dirty = true;
    scheduleSession();
    bump();
  }

  // ---- undo and the floating selection ---------------------------------------------------------------------------

  function pushUndo(target: Doc) {
    target.undo.push({ pixels: target.pixels.slice(), cells: target.cells.slice(), palettes: clonePalettes(target.palettes), ...(target.priority ? { priority: target.priority.slice() } : {}), ...(target.collision ? { collisionValues: target.collision.scenes.map((scene) => scene.values.slice()) } : {}), width: target.width, height: target.height, ...(target.asset?.opened ? { opened: target.asset.opened.slice() } : {}) });
    while (target.undo.length > UNDO_LIMIT || (target.undo.length > 1 && target.undo.length * target.pixels.length > UNDO_BYTES)) target.undo.shift();
    target.redo = [];
  }


  // ---- the draft layer (retried 2026-10-15: new pixels at 50 % over the old picture) ---------------------------------
  /** The draft, while the picture still matches it in size (a resize drops it). */
  const draftOf = (target: Doc) => target.draft && target.draft.pixels.length === target.pixels.length ? target.draft : undefined;
  /** How many pixels differ from the picture the draft began on (a floating piece counts once dropped). */
  function draftChanges(target: Doc): number {
    const base = draftOf(target);
    if (!base) return 0;
    let count = 0;
    for (let at = 0; at < target.pixels.length; at += 1) if (target.pixels[at] !== base.pixels[at]) count += 1;
    return count;
  }
  function toggleDraft() {
    if (!doc) return say("Open a picture first.");
    if (!draftOf(doc)) {
      dropFloat(doc);
      doc.draft = { pixels: doc.pixels.slice() };
      bump();
      return say("Draft layer on: what you paint shows at 50 % over the picture; Commit keeps it, Wipe takes it back.");
    }
    if (draftChanges(doc)) return say("Commit or wipe the draft first (the strip above the picture).");
    delete doc.draft;
    bump();
  }
  /** Commit: the draft becomes part of the picture; one undo goes back to before the draft. */
  function commitDraft(target: Doc) {
    const base = draftOf(target);
    delete target.draft;
    if (!base) return bump();
    dropFloat(target);
    const changed = draftChanges({ ...target, draft: base });
    if (changed) {
      target.undo.push({ pixels: base.pixels, cells: target.cells.slice(), palettes: clonePalettes(target.palettes), ...(target.priority ? { priority: target.priority.slice() } : {}), width: target.width, height: target.height });
      while (target.undo.length > UNDO_LIMIT || (target.undo.length > 1 && target.undo.length * target.pixels.length > UNDO_BYTES)) target.undo.shift();
      target.redo = [];
    }
    touch(target);
    say(changed ? `Draft committed: ${changed} pixel${changed === 1 ? "" : "s"} kept (undo takes them back).` : "Draft layer off: nothing had changed.");
  }
  /** Wipe: the picture goes back to how it was when the draft began; the draft stays on for another go. */
  function wipeDraft(target: Doc) {
    const base = draftOf(target);
    if (!base) return;
    dropFloat(target);
    if (!draftChanges(target)) return bump();
    pushUndo(target);
    target.pixels.set(base.pixels);
    touch(target);
    say("Draft wiped: the picture is as it was when the draft began.");
  }

  /** Flattens the floating piece into the picture where it sits. */
  function dropFloat(target: Doc) {
    if (!target.float) return;
    drop(target.pixels, target.width, target.height, target.float);
    dropCells(target.cells, target.width, target.height, target.float);
    target.float = null;
  }

  function stepHistory(from: "undo" | "redo") {
    if (!doc || !doc[from].length) return;
    dropFloat(doc);
    doc[from === "undo" ? "redo" : "undo"].push({ pixels: doc.pixels, cells: doc.cells, palettes: clonePalettes(doc.palettes), ...(doc.priority ? { priority: doc.priority } : {}), ...(doc.collision ? { collisionValues: doc.collision.scenes.map((scene) => scene.values.slice()) } : {}), width: doc.width, height: doc.height, ...(doc.asset?.opened ? { opened: doc.asset.opened } : {}) });
    const { palettes, collisionValues, width, height, opened, ...rest } = doc[from].pop()!;
    Object.assign(doc, rest);
    // A resize undone or redone: the picture takes that size again (and its view fits it).
    if (width && height && (width !== doc.width || height !== doc.height)) Object.assign(doc, { width, height, resized: true, zoom: fitZoom(width, height) });
    if (opened && doc.asset) doc.asset.opened = opened;
    // A snapshot from before the priority flags existed: keep them, sized to the picture's cells again.
    if (doc.priority && doc.priority.length !== doc.cells.length) doc.priority = new Uint8Array(doc.cells.length);
    if (collisionValues && doc.collision) collisionValues.forEach((values, index) => { if (doc.collision!.scenes[index]) doc.collision!.scenes[index].values = values; });
    // Palette colors come back too; a restored list that predates a palette added since keeps the newer ones.
    if (palettes) palettes.forEach((palette, index) => { if (doc.palettes[index]) doc.palettes[index] = palette; });
    doc.sel = null;
    touch(doc);
  }

  /** Lifts the selection so it can move; `copy` leaves the picture underneath as it is. */
  function floatSelection(target: Doc, copy: boolean): Floating | null {
    if (target.float) {
      if (copy) drop(target.pixels, target.width, target.height, target.float);
      return target.float;
    }
    const rect = clipRect(target.sel ?? { x: 0, y: 0, w: target.width, h: target.height }, target.width, target.height);
    if (!rect) return null;
    pushUndo(target);
    target.float = lift(target.pixels, target.width, rect, copy ? undefined : blank(target));
    // On tile edges the tiles' palettes go along (the tiles left behind wear none).
    if (onTiles(rect)) target.float.cells = liftCells(target.cells, target.width, rect, copy ? undefined : 0);
    target.sel = rect;
    return target.float;
  }

  function moveFloat(target: Doc, x: number, y: number) {
    if (!target.float) return;
    target.float.x = x;
    target.float.y = y;
    target.sel = { x, y, w: target.float.w, h: target.float.h };
  }

  function clearSelection() {
    if (!doc?.sel) return;
    if (doc.float) doc.float = null;
    else {
      pushUndo(doc);
      fillRect(doc.pixels, doc.width, doc.height, doc.sel, blank(doc));
    }
    doc.sel = null;
    touch(doc);
  }

  function copySelection() {
    if (!doc?.sel) return false;
    const rect = clipRect(doc.sel, doc.width, doc.height);
    clip.current = doc.float ? { ...doc.float, pixels: doc.float.pixels.slice(), ...(doc.float.cells ? { cells: doc.float.cells.slice() } : {}) } : rect ? { ...lift(doc.pixels, doc.width, rect), ...(onTiles(rect) ? { cells: liftCells(doc.cells, doc.width, rect) } : {}) } : null;
    clipPalettes.current = clonePalettes(doc.palettes);
    return clip.current !== null;
  }

  function pasteClip() {
    const scroller = scrollerRef.current, wrap = wrapRef.current;
    if (!doc || !clip.current || !scroller || !wrap) return;
    dropFloat(doc);
    pushUndo(doc);
    // The top-left corner of what is in view, on a tile boundary.
    const view = scroller.getBoundingClientRect(), box = wrap.getBoundingClientRect();
    const corner = (edge: number, size: number) => Math.min(Math.max(0, Math.ceil((edge / doc.zoom) / CELL) * CELL), Math.max(0, size - CELL));
    // Tile palettes land on the same palettes in this picture (matched by GB Studio id, else name and colors; added if missing).
    const cells = clip.current.cells?.map((wear) => {
      const palette = wear ? clipPalettes.current[wear - 1] : undefined;
      if (!palette) return 0;
      let index = doc.palettes.findIndex((own) => (palette.id && own.id === palette.id) || (!palette.id && own.name === palette.name && own.colors.join() === palette.colors.join()));
      if (index < 0) index = doc.palettes.push({ ...palette, colors: [...palette.colors] }) - 1;
      return index + 1;
    });
    doc.float = { ...clip.current, pixels: clip.current.pixels.slice(), ...(cells ? { cells } : {}), x: corner(view.left - box.left, doc.width), y: corner(view.top - box.top, doc.height) };
    doc.sel = { x: doc.float.x, y: doc.float.y, w: doc.float.w, h: doc.float.h };
    setToolState("select");
    touch(doc);
  }

  // ---- files -------------------------------------------------------------------------------------------------------

  function fitZoom(width: number, height: number): number {
    const scroller = scrollerRef.current;
    // A window that is not laid out yet (opened in the background) has no size: go by the window then.
    const room = Math.min(((scroller?.clientWidth || window.innerWidth - 270) - 64) / width, ((scroller?.clientHeight || window.innerHeight - 130) - 64) / height);
    return [...ZOOMS].reverse().find((step) => step <= room) ?? ZOOMS[0];
  }

  async function openFiles(files: Opening[]) {
    await palettesReady.current;
    if (files.length) setStartDone(true);
    let last = 0;
    for (const { file, handle, asset, info, replace } of files) {
      try {
        // An Aseprite file (L17): its visible layers drawn, frames side by side; it opens as a new PNG, never saved over.
        const ase = isAseprite(file.name) ? await readAseprite(new Uint8Array(await file.arrayBuffer()), inflateZlib) : null;
        const bitmap = ase ?? await createImageBitmap(file, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        if (ase) context.putImageData(new ImageData(ase.rgba, ase.width, ase.height), 0, 0);
        else context.drawImage(bitmap as ImageBitmap, 0, 0);
        const keyGreen = asset ? isKeyed(asset.kind) : false;
        // Fonts: magenta marks a variable-width glyph's unused columns (GB Studio reads it as see-through); it stays magenta.
        const keyMagenta = asset?.kind === "fonts";
        const picture = quantize(context.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.width, bitmap.height, palettesRef.current, keyGreen, keyMagenta);
        // A background's tile colors (GB Studio's per-tile palettes) dress the cells when the scene's palettes are known.
        const dressed = info?.tileColors.length ? assignSlots(picture.cells, info.tileColors, info.slots, picture.palettes) : 0;
        const old = replace !== undefined ? docs.current.findIndex((item) => item.id === replace) : -1;
        // The tab this was reloading for was closed while the file was read: nothing to replace, and no new tab.
        if (replace !== undefined && old < 0) continue;
        const id = old >= 0 ? replace! : newDocId(docs.current);
        if (old < 0) last = id;
        // Backgrounds and tilesets: each tile's priority flag (bit 7: draws over sprites).
        const flags = asset && info && (asset.kind === "backgrounds" || asset.kind === "tilesets") ? Array.from({ length: picture.cells.length }, (_, cell) => (info.tileColors[cell] ?? 0) >= 0 && (info.tileColors[cell] ?? 0) & 0x80 ? 1 : 0) : null;
        const own = ase ? undefined : handle;
        const opened: Doc = { id, ...(own && !asset ? { fileTime: file.lastModified } : {}), name: asset?.name ?? (ase ? file.name.replace(/\.(aseprite|ase)$/i, ".png") : file.name), width: bitmap.width, height: bitmap.height, pixels: picture.pixels, cells: picture.cells, ...(flags ? { priority: Uint8Array.from(flags) } : {}), hasAlpha: picture.hasAlpha || keyGreen || asset?.kind === "stamps", palettes: picture.palettes, undo: [], redo: [], dirty: Boolean(ase), handle: own, asset: asset && info ? { kind: asset.kind, file: asset.file, name: asset.name, mtime: info.mtime, ...(hasSlots(asset.kind) ? { slots: info.slots, slotScene: info.slotScene ?? null, metaMtime: info.metaMtime, opened: info.tileColors.map((value) => value < 0 ? -1 : value & 7), ...(flags ? { openedPriority: flags } : {}) } : {}), ...(asset.kind === "sprites" && info.animations?.length ? { animations: info.animations, animSpeed: info.animSpeed ?? null } : {}), ...(asset.kind === "backgrounds" && info.parallax?.length ? { parallax: info.parallax } : {}), project: projectRef.current?.path, ...(info.autoColor ? { autoColor: true } : {}) } : undefined, keyGreen: keyGreen || undefined, ...(keyMagenta ? { keyMagenta: true } : {}), zoom: old >= 0 ? docs.current[old].zoom : fitZoom(bitmap.width, bitmap.height), sel: null, float: null };
        if (old >= 0) {
          // Reloaded from disk (2026-10-14): what was on screen stays one undo away, with the history before it.
          const before = docs.current[old];
          pushUndo(before);
          opened.undo = before.undo;
          docs.current[old] = opened;
        }
        else docs.current.push(opened);
        if (asset?.kind === "backgrounds") void loadCollisions(opened);
        if (old >= 0) continue;
        const made = picture.palettes.length - palettesRef.current.length;
        if (ase) say(`${file.name}: opened from Aseprite as ${opened.name}, ${ase.frameWidth} × ${ase.height}${ase.notes.length ? ` (${ase.notes.join("; ")})` : ""}. Save writes a new PNG; the .aseprite file stays as it is.`);
        else if (info?.autoColor) say(`${asset?.name ?? file.name} uses GB Studio's Automatic color: GB Studio reads its colors from the PNG itself. Saving here writes the four greens and loses them; Save asks first.`);
        else if (picture.snapped) say(`${file.name}: ${picture.snapped} color${picture.snapped === 1 ? "" : "s"} read as the same shade as another color in their tile (GB Studio reads colors by their green), so they show alike, as in GB Studio.`);
        else if (made) say(`${file.name}: tiles in colors outside the library keep them as ${made} palette${made === 1 ? "" : "s"} of the file.${made > 8 ? " GB Studio allows 8 a scene: Picture tab → Fit to 8 palettes shows what fitting changes." : ""} Save writes the greens GB Studio reads the colors as.`);
        else if (dressed) say(`${asset?.name}: ${dressed} tile${dressed === 1 ? "" : "s"} wear the palettes GB Studio gives them.`);
        else if (picture.near) say(`${file.name}: ${picture.near} color${picture.near === 1 ? "" : "s"} a hair off the GB greens read as those greens.`);
      } catch {
        say(`${file.name} could not be read as a picture.`);
      }
    }
    if (last) setActiveId(last);
    scheduleSession();
    bump();
  }

  async function pickFiles() {
    const picker = (window as PickerWindow).showOpenFilePicker;
    if (picker) {
      try {
        const handles = await picker.call(window, { multiple: true, types: OPEN_TYPES });
        await openFiles(await Promise.all(handles.map(async (handle) => ({ file: await handle.getFile(), handle }))));
      } catch {
        // The picker was closed.
      }
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,.aseprite,.ase";
    input.multiple = true;
    input.onchange = () => void openFiles([...input.files ?? []].map((file) => ({ file })));
    input.click();
  }

  const assetQuery = (asset: { kind: AssetKind; file: string }) => new URLSearchParams({ kind: asset.kind, file: asset.file });

  /** Reads the open GB Studio project (its pictures and palettes), or notes that none is open. */
  async function loadProject(): Promise<void> {
    const asJson = <T,>(response: Response) => response.ok && response.headers.get("content-type")?.includes("json") ? response.json() as Promise<T> : null;
    const ping = await fetch("./__cartographer/ping", { cache: "no-cache" }).then((response) => asJson<{ ok?: boolean; project?: { path: string; versionNote?: string | null } | null; recent?: { name: string; path: string }[]; demo?: boolean }>(response)).catch(() => null);
    setServed(Boolean(ping?.ok));
    // A project made with a GB Studio version this wasn't tested with: say so once per project and session.
    if (ping?.project?.versionNote && !versionNoted.current.has(ping.project.path)) {
      versionNoted.current.add(ping.project.path);
      say(ping.project.versionNote);
    }
    setRecent(ping?.recent ?? []);
    setHasDemo(Boolean(ping?.demo));
    const opened = ping?.ok && ping.project ? await fetch(PROJECT_URL, { cache: "no-cache" }).then((response) => asJson<{ ok?: boolean } & Project>(response)).catch(() => null) : null;
    if (opened?.ok) {
      palettesRef.current = opened.palettes.filter((palette) => palette.colors?.length === 4);
      projectRef.current = { name: opened.name, path: opened.path, assets: opened.assets, palettes: opened.palettes };
      setProject(projectRef.current);
      setStartDone(true);
      if (ownLoadedFor.current !== opened.path) { ownLoadedFor.current = opened.path; void loadOwn(opened.path); }
    } else {
      ownLoadedFor.current = null;
      palettesRef.current = [];
      projectRef.current = null;
      setProject(null);
    }
    setPalettes(palettesRef.current);
  }

  /** Opens a project folder by path (a Recent entry). */
  /** Pictures opened from the current project (older sessions did not record the project: they count too). */
  const projectDocs = () => docs.current.filter((item) => item.asset && (!item.asset.project || item.asset.project === projectRef.current?.path));

  /**
   * Before the project changes: unsaved pictures of the current project are saved (or, if the user says so,
   * discarded). Returns false when the user backs out.
   */
  async function readyToLeaveProject(): Promise<boolean> {
    const dirty = projectDocs().filter((item) => item.dirty);
    if (!dirty.length) return true;
    const names = dirty.map((item) => item.name).join(", ");
    if (await confirmBox(`Save your changes to ${names} before leaving ${projectRef.current?.name ?? "this project"}?`)) {
      await save(false);
      return !projectDocs().some((item) => item.dirty);
    }
    return await confirmBox(`Leave ${projectRef.current?.name ?? "this project"} and discard the changes to ${names}?`, { yes: "Discard and leave", danger: true });
  }

  /** After the project changed: the old project's pictures close (their files belong to that project). */
  /** Closes the pictures of a project that is no longer open (`always`: also when the same folder reopened, e.g. a reset demo). */
  function closeDocsOf(oldPath: string | undefined, always = false) {
    if (!oldPath || (!always && oldPath === projectRef.current?.path)) return;
    const keep = docs.current.filter((item) => !(item.asset && (!item.asset.project || item.asset.project === oldPath)));
    if (keep.length === docs.current.length) return;
    docs.current = keep;
    if (!keep.some((item) => item.id === activeId)) setActiveId(keep[0]?.id ?? 0);
    scheduleSession();
    bump();
  }

  /** Opens a project folder by path (a Recent entry). */
  async function openProjectPath(path: string) {
    if (path === projectRef.current?.path) return;
    if (!await readyToLeaveProject()) return;
    const oldPath = projectRef.current?.path;
    const response = await fetch("./__cartographer/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) return say(result.error ?? response.statusText);
    palettesReady.current = loadProject();
    await palettesReady.current;
    closeDocsOf(oldPath);
    setShowProject(true);
  }

  /** Closes the project: back to the start screen; its pictures close too. */
  async function closeProject() {
    if (!projectRef.current || !await readyToLeaveProject()) return;
    const oldPath = projectRef.current.path;
    await fetch("./__cartographer/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: "" }) });
    palettesReady.current = loadProject();
    await palettesReady.current;
    closeDocsOf(oldPath);
    setStartDone(false);
  }

  /** Asks for a GB Studio project folder: the desktop app's folder dialog, or a typed path on the dev server. `demo` opens a copy of the shipped demo instead. */
  async function chooseProject(demo = false, reset = false) {
    const native = (window as PickerWindow).gbc;
    if (reset && !await confirmBox("Start the demo project over? Your painted copy is moved to the backups folder (nothing is deleted), and a fresh copy of the demo opens.", { yes: "Start over", danger: true })) return;
    if (!await readyToLeaveProject()) return;
    const oldPath = projectRef.current?.path;
    try {
      if (demo) {
        const response = await fetch("./__cartographer/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ demo: true, ...(reset ? { reset: true } : {}) }) });
        const result = await response.json() as { ok?: boolean; error?: string };
        if (!response.ok || !result.ok) return say(result.error ?? response.statusText);
      } else if (native) {
        if (!await native.chooseProject()) return;
      } else {
        const path = await askText({ title: "Open a GB Studio project", label: "Path of its .gbsproj file, or the folder that holds it", initial: project?.path ?? "", confirm: "Open" });
        if (!path) return;
        const response = await fetch("./__cartographer/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
        const result = await response.json() as { ok?: boolean; error?: string };
        if (!response.ok || !result.ok) return say(result.error ?? response.statusText);
      }
      palettesReady.current = loadProject();
      await palettesReady.current;
      closeDocsOf(oldPath, reset);
      if (reset) setSlotsVersion((value) => value + 1);
      setShowProject(true);
    } catch (error) {
      say(`Could not open the project: ${(error as Error).message}`);
    }
  }

  /**
   * Before project JSON is written: if GB Studio seems to be running, ask once per session. GB Studio keeps the
   * project in memory and writes it back when it saves, which would undo changes made here.
   */
  async function okToWriteProjectJson(): Promise<boolean> {
    if (gbStudioWarned.current) return true;
    const status = await fetch("./__cartographer/gbstudio-running", { cache: "no-cache" }).then((response) => response.ok ? response.json() as Promise<{ running?: boolean }> : null).catch(() => null);
    if (!status?.running) return true;
    gbStudioWarned.current = true;
    return await confirmBox("GB Studio looks open. It keeps the project in memory and may overwrite palettes and tile colors written here when it saves. Close it, or reload the project there afterwards.\n\nWrite anyway?");
  }

  /** Doc palettes (by GB Studio id) whose colors or name differ from the project's: the active picture's copy wins. */
  function editedProjectPalettes(): { id: string; name: string; colors: string[] }[] {
    const byId = new Map(palettesRef.current.filter((item) => item.id).map((item) => [item.id!, item]));
    const edited = new Map<string, { id: string; name: string; colors: string[] }>();
    for (const item of [...docs.current].sort((a, b) => (a === doc ? -1 : b === doc ? 1 : 0))) {
      for (const own of item.palettes) {
        const base = own.id ? byId.get(own.id) : undefined;
        if (!own.id || !base || edited.has(own.id)) continue;
        if (base.colors.join() !== own.colors.join() || base.name !== own.name) edited.set(own.id, { id: own.id, name: own.name, colors: [...own.colors] });
      }
    }
    return [...edited.values()];
  }

  /**
   * Writes a palette into the project (new without `id`, else rewritten in place), then rereads the project and
   * passes new colors on to open pictures whose copy of that palette was unchanged. Resolves to the palette's id.
   */
  async function writeProjectPalette(palette: { id?: string; name: string; colors: string[] }): Promise<string | null> {
    try {
      const mtime = palette.id ? projectRef.current?.palettes.find((item) => item.id === palette.id)?.mtime : undefined;
      const post = (force: boolean) => fetch("./__cartographer/gbstudio-palette", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...palette, ...(mtime !== undefined ? { mtime } : {}), force }) });
      let response = await post(false);
      if (response.status === 409) {
        if (!await confirmBox(`${palette.name} changed on disk since the project was read (GB Studio or another app saved it). Replace it with these colors?`)) return null;
        response = await post(true);
      }
      const result = await response.json() as { ok?: boolean; error?: string; id?: string };
      if (!response.ok || !result.ok || !result.id) {
        say(`Could not write the palette: ${result.error ?? response.statusText}`);
        return null;
      }
      const before = new Map(palettesRef.current.filter((item) => item.id).map((item) => [item.id!, item.colors.join()]));
      await loadProject();
      for (const item of docs.current) {
        for (const own of item.palettes) {
          if (own.id !== result.id || before.get(result.id) !== own.colors.join()) continue;
          own.colors = [...palette.colors];
          own.name = palette.name;
        }
        if (!palette.id) item.palettes.push({ id: result.id, name: palette.name, colors: [...palette.colors] });
      }
      scheduleSession();
      bump();
      return result.id;
    } catch (error) {
      say(`Could not write the palette: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Renames a project palette in its file (by id: GB Studio's scenes and palette events refer to palettes by id,
   * checked in GB Studio 4.3.2, so nothing else changes). Its colors stay as they are in the project.
   */
  async function renameProjectPalette(palette: Palette) {
    const stored = projectRef.current?.palettes.find((item) => item.id === palette.id);
    if (!palette.id || !stored) return say(`${palette.name} is not in the project.`);
    const variants = (projectRef.current?.palettes ?? []).filter((item) => timeVariant(item.name)?.base === stored.name).map((item) => item.name);
    const name = await askText({ title: `Rename ${stored.name}`, label: "Name", initial: stored.name, confirm: "Rename",
      hint: variants.length ? `Its time-of-day versions (${variants.join(", ")}) keep their names: they pair with this palette by name, so rename them to match.` : "Scenes and events keep using it: GB Studio finds palettes by id." });
    if (!name || name === stored.name) return;
    if (!await okToWriteProjectJson()) return;
    const id = await writeProjectPalette({ id: palette.id, name, colors: [...stored.colors] });
    if (!id) return;
    for (const item of docs.current) for (const own of item.palettes) if (own.id === id) own.name = name;
    scheduleSession();
    bump();
    say(`Renamed ${stored.name} to ${name}.`);
  }

  /**
   * Copy palettes (the author, 2026-10-12): the open background's eight slots go into another background's scene,
   * as slot assignments (the same palettes; the scene's paletteIds, backed up). Asks first, says which scene.
   */
  async function copySlotsTo(target: Asset) {
    const source = doc?.asset;
    if (!source?.slots?.length) return;
    const ids = [...source.slots];
    const info = await fetch(`./__cartographer/gbstudio-asset-info?${assetQuery(target)}`, { cache: "no-cache" }).then((response) => response.ok ? response.json() as Promise<{ slots: string[]; slotScene: string | null }> : null).catch(() => null);
    if (!info) return say(`Could not read ${target.name}.`);
    if (!info.slotScene) return say(`No GB Studio scene shows ${target.name} yet, so it uses the project's default palettes. Add it to a scene in GB Studio first.`);
    if (info.slots.join() === ids.join()) return say(`${info.slotScene} already has the same eight palettes.`);
    const names = ids.map((id, slot) => `${slot + 1} ${palettesRef.current.find((item) => item.id === id)?.name ?? "—"}`).join(", ");
    if (!await confirmBox(`Put ${source.name}'s eight palettes in ${info.slotScene}'s slots?

${names}. ${target.name}'s tiles keep their slot numbers, so they show these palettes. The scene file is backed up first.`, { yes: "Copy palettes" })) return;
    if (!await okToWriteProjectJson()) return;
    const post = (expected: string[]) => fetch(`./__cartographer/gbstudio-palette-slots?file=${encodeURIComponent(target.file)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, expected }) });
    let response = await post(info.slots);
    if (response.status === 409) {
      const { current } = await response.json() as { current?: string };
      if (!await confirmBox(`${info.slotScene}'s palettes changed on disk since they were read (GB Studio or another app saved it). Replace them anyway?`, { yes: "Replace" })) return;
      response = await post(current?.split(",") ?? info.slots);
    }
    const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; scene?: string };
    if (!response.ok || !result.ok) return say(`Could not copy the palettes: ${result.error ?? response.statusText}`);
    await rereadSlots();
    setSlotsVersion((version) => version + 1);
    scheduleSession();
    bump();
    say(`${result.scene ?? info.slotScene} now has ${source.name}'s eight palettes.`);
  }

  /** A new project palette with a palette's colors (as they are in the project) and a "copy" name. */
  async function duplicateProjectPalette(palette: Palette) {
    const stored = projectRef.current?.palettes.find((item) => item.id === palette.id);
    if (!palette.id || !stored) return say(`${palette.name} is not in the project.`);
    const taken = new Set((projectRef.current?.palettes ?? []).map((item) => item.name.toLowerCase()));
    let name = `${stored.name} copy`;
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${stored.name} copy ${n}`;
    if (!await okToWriteProjectJson()) return;
    if (await writeProjectPalette({ name, colors: [...stored.colors] })) say(`Added ${name} to the project.`);
  }

  /** Opens a project asset as a picture (or shows it, when it is already open). */
  async function openAsset(asset: Asset) {
    // A repeat tile is drawn with its copies around it: the seamless 3 × 3 view comes on (the author, 2026-10-13).
    if (asset.kind === "stamps" && asset.tags?.includes(PATTERN_TAG)) setSeamless(true);
    const open = docs.current.find((item) => item.asset?.kind === asset.kind && item.asset.file === asset.file);
    if (open) return setActiveId(open.id);
    try {
      const [png, info] = await Promise.all([
        fetch(`${ASSET_URL}?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.ok ? response.blob() : Promise.reject(new Error(response.statusText))),
        fetch(`${ASSET_URL}-info?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.ok ? response.json() as Promise<AssetInfo> : Promise.reject(new Error(response.statusText))),
      ]);
      await openFiles([{ file: new File([png], asset.file, { type: "image/png" }), asset, info }]);
    } catch (error) {
      say(`Could not open ${asset.name}: ${(error as Error).message}`);
    }
  }

  /**
   * Puts a backed-up version back into the project, then shows it: an open picture of that file (or of its sidecar)
   * reloads, the project's thumbnails and palettes are read again, and open pictures reread their slots.
   */
  async function restoreFromBackup(file: string, version: string, expected: number | null = null): Promise<boolean> {
    const match = /^assets\/(backgrounds|sprites|tilesets|fonts)\/([^/]+\.png)(\.gbsres)?$/i.exec(file);
    const open = match ? docs.current.find((item) => item.asset?.kind === match[1] && item.asset.file === match[2] && (!item.asset.project || item.asset.project === projectRef.current?.path)) : undefined;
    if (open?.dirty && !await confirmBox(`${open.name} has unsaved changes. Restoring replaces them with the backup. Go on?`)) return false;
    if (!file.endsWith(".png") && !await okToWriteProjectJson()) return false;
    try {
      const send = (force: boolean) => fetch("./__cartographer/backup-restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file, version, expected, force }) });
      let response = await send(false);
      if (response.status === 409) {
        if (!await confirmBox(`${file.split("/").pop()} changed on disk after the Backups window read it (GB Studio may have saved it). Restore the backup over it anyway? The newer file goes to the backups first.`, { yes: "Restore anyway" })) return false;
        response = await send(true);
      }
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) { say(`Could not restore ${file}: ${result.error ?? response.statusText}`); return false; }
    } catch (error) {
      say(`Could not restore ${file}: ${(error as Error).message}`);
      return false;
    }
    await loadProject();
    if (open) await reloadAsset(open);
    await rereadSlots();
    setSlotsVersion((value) => value + 1);
    say(`Restored ${file.split("/").pop()} from ${new Date(versionTime(version)).toLocaleString()}: put back… up.`);
    return true;
  }

  /** Reads an open project picture again from disk, in place (a restore, or GB Studio changed it). */
  async function reloadAsset(target: Doc): Promise<boolean> {
    const asset = target.asset;
    if (!asset) return false;
    try {
      const [png, info] = await Promise.all([
        fetch(`${ASSET_URL}?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.ok ? response.blob() : Promise.reject(new Error(response.statusText))),
        fetch(`${ASSET_URL}-info?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.ok ? response.json() as Promise<AssetInfo> : Promise.reject(new Error(response.statusText))),
      ]);
      const listed = projectRef.current?.assets.find((item) => item.kind === asset.kind && item.file === asset.file);
      await openFiles([{ file: new File([png], asset.file, { type: "image/png" }), asset: listed ?? { kind: asset.kind, file: asset.file, name: asset.name } as Asset, info, replace: target.id }]);
      return true;
    } catch (error) {
      say(`Could not reload ${asset.name}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * A new blank picture: written into the project as a new PNG (then opened from there), or kept here as an
   * untitled picture that Save asks a place for. Resolves true when it was made.
   */
  async function createPicture({ kind, name, width, height, pixels: start }: NewPicture): Promise<boolean> {
    const keyed = kind ? isKeyed(kind) : false;
    const pixels = start && start.length === width * height ? start.slice() : new Uint8Array(width * height).fill(keyed ? CLEAR : 0);
    const cells = new Uint8Array(cellsWide(width) * Math.ceil(height / CELL));
    if (!kind) {
      const id = newDocId(docs.current);
      docs.current.push({ id, name: `${name.replace(/\.png$/i, "")}.png`, width, height, pixels, cells, hasAlpha: pixels.includes(CLEAR), palettes: clonePalettes(palettesRef.current), undo: [], redo: [], dirty: true, zoom: fitZoom(width, height), sel: null, float: null });
      setActiveId(id);
      scheduleSession();
      bump();
      return true;
    }
    const canvas = document.createElement("canvas");
    Object.assign(canvas, { width, height });
    canvas.getContext("2d")!.putImageData(new ImageData(toRgba(pixels, cells, width, [], keyed ? KEY_GREEN : kind === "fonts" ? KEY_MAGENTA : undefined), width, height), 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((made) => made ? resolve(made) : reject(new Error("No PNG")), "image/png"));
    const response = await fetch(`./__cartographer/gbstudio-new-asset?${new URLSearchParams({ kind, name })}`, { method: "POST", body: blob }).catch(() => null);
    const result = response ? await response.json().catch(() => null) as { ok?: boolean; error?: string; file?: string } | null : null;
    if (!response?.ok || !result?.ok || !result.file) { say(`Could not make the picture: ${result?.error ?? response?.statusText ?? "no answer"}`); return false; }
    await loadProject();
    setProjectKind(kind);
    const made = projectRef.current?.assets.find((asset) => asset.kind === kind && asset.file === result.file);
    if (made) await openAsset(made);
    say(`Made assets/${kind}/${result.file} in ${projectRef.current?.name ?? "the project"}`);
    return true;
  }

  /**
   * Gives the open picture a new size in whole tiles, at the top-left or centered on tile edges. Tile palettes stay
   * with their tiles; new space is blank. Undo starts over (the sizes differ); Save writes the new size.
   */
  /** `shift`: where the old picture lands in the new one, for growing or trimming on the left or top (whole tiles). */
  function resizePicture(width: number, height: number, center: boolean, shift?: [number, number]) {
    if (!doc) return;
    dropFloat(doc);
    const dx = shift ? shift[0] : center ? Math.floor((width - doc.width) / 2 / CELL) * CELL : 0, dy = shift ? shift[1] : center ? Math.floor((height - doc.height) / 2 / CELL) * CELL : 0;
    const pixels = new Uint8Array(width * height).fill(blank(doc));
    for (let y = 0; y < doc.height; y += 1) {
      const ty = y + dy;
      if (ty < 0 || ty >= height) continue;
      for (let x = 0; x < doc.width; x += 1) {
        const tx = x + dx;
        if (tx >= 0 && tx < width) pixels[ty * width + tx] = doc.pixels[y * doc.width + x];
      }
    }
    const oldCw = cellsWide(doc.width), oldCh = Math.ceil(doc.height / CELL), cw = cellsWide(width), ch = Math.ceil(height / CELL);
    const move = <T,>(source: ArrayLike<T>, fill: T, make: (length: number) => { [index: number]: T; length: number }) => {
      const out = make(cw * ch);
      for (let i = 0; i < out.length; i += 1) out[i] = fill;
      for (let y = 0; y < oldCh; y += 1) for (let x = 0; x < oldCw; x += 1) {
        const tx = x + dx / CELL, ty = y + dy / CELL;
        if (tx >= 0 && ty >= 0 && tx < cw && ty < ch) out[ty * cw + tx] = source[y * oldCw + x];
      }
      return out;
    };
    pushUndo(doc);
    const cells = move(doc.cells, 0, (length) => new Uint8Array(length)) as Uint8Array;
    if (doc.priority) doc.priority = move(doc.priority, 0, (length) => new Uint8Array(length)) as Uint8Array;
    if (doc.asset?.opened) doc.asset.opened = Array.from(move(doc.asset.opened, -1, (length) => new Array<number>(length)) as number[]);
    Object.assign(doc, { width, height, pixels, cells, sel: null, float: null, resized: true, zoom: fitZoom(width, height) });
    touch(doc);
    say(`${doc.name} is now ${width} × ${height} (Ctrl+Z undoes it; Save writes the new size).`);
  }

  /** Writes the picture over its GB Studio asset (the server keeps a backup and refuses a file that changed on disk). */
  async function saveAsset(target: Doc, blob: Blob): Promise<boolean> {
    const asset = target.asset!;
    if (asset.autoColor && !await confirmBox(`${asset.name} uses GB Studio's Automatic color: GB Studio reads its colors straight from the PNG. Saving writes it in the four GB greens, so those colors are lost (the old file goes to Backups). Save anyway?`)) return false;
    if (asset.project && asset.project !== projectRef.current?.path) {
      say(`${asset.name} belongs to ${asset.project}. Open that project to save it, or use Export.`);
      return false;
    }
    if (target.resized && !await confirmBox(`Save ${asset.name} at its new size, ${target.width} × ${target.height}? The old file goes to Backups.${asset.kind === "backgrounds" ? " Scenes showing it take their size from it in GB Studio." : ""}`)) return false;
    const post = (force: boolean) => fetch(`${ASSET_URL}?${assetQuery(asset)}&mtime=${asset.mtime}${force ? "&force=1" : ""}${target.resized ? "&resize=1" : ""}`, { method: "POST", body: blob });
    let response = await post(false);
    if (response.status === 409) {
      if (!await confirmBox(`${asset.name} changed on disk since you opened it (GB Studio or another app saved it). Replace it with this picture?`)) return false;
      response = await post(true);
    }
    const result = await response.json() as { ok?: boolean; error?: string; mtime?: number };
    if (response.status === 404) throw new Error(`${asset.file} is no longer in the project folder (it was moved or deleted). Put it back, or Export copy to save elsewhere.`);
    if (!response.ok || !result.ok) throw new Error(result.error ?? response.statusText);
    asset.mtime = result.mtime ?? asset.mtime;
    target.dirty = false;
    target.changedOnDisk = undefined;
    target.resized = false;
    // The thumbnail in the project panel shows the new file.
    setProject((current) => current && { ...current, assets: current.assets.map((item) => item.kind === asset.kind && item.file === asset.file ? { ...item, mtime: asset.mtime } : item) });
    const notes = [asset.kind === "stamps" ? `Saved the stamp ${asset.name} (Cartographer/stamps)` : `Saved ${asset.name} into the GB Studio project`];
    if (hasSlots(asset.kind) && asset.slots?.length) {
      // A picture GB Studio hasn't read yet has no .gbsres to hold its tile palettes: look again (GB Studio may have
      // made one since), else keep the picture unsaved with its palettes until it has.
      if (asset.metaMtime == null) {
        const info = await fetch(`${ASSET_URL}-info?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.ok ? response.json() as Promise<AssetInfo> : null).catch(() => null);
        if (info?.metaMtime != null) Object.assign(asset, { metaMtime: info.metaMtime, opened: info.tileColors.map((value) => value < 0 ? -1 : value & 7) });
      }
      if (asset.metaMtime == null && target.cells.some(Boolean)) {
        target.dirty = true;
        notes.push("Its tile palettes wait: GB Studio hasn't read this picture yet. Open the project in GB Studio once (it adds the picture's settings file), then Save here again");
      } else notes.push(...await saveTileColors(target));
    }
    if (asset.kind === "stamps") notes.push(...await saveStampMeta(target));
    if (asset.kind === "backgrounds" && target.collision) notes.push(...await saveCollisions(target));
    say(notes.join(". "));
    return true;
  }


  /** Reads the scenes that show a project background and their collisions (none: GB Studio hasn't put it in one). */
  async function loadCollisions(target: Doc) {
    const asset = target.asset;
    if (!asset || asset.kind !== "backgrounds") return;
    const read = await fetch(`./__cartographer/scene-collisions?${new URLSearchParams({ file: asset.file })}`, { cache: "no-cache" }).then((response) => response.ok ? response.json() as Promise<{ scenes: { file: string; id: string; name: string; type: string; mtime: number; collisions: number[] }[]; collisionTypes: Record<string, CollisionTileDef[]> }> : null).catch(() => null);
    if (!read) return;
    target.collision = {
      scene: 0,
      types: read.collisionTypes ?? {},
      scenes: read.scenes.map(({ collisions, ...scene }) => ({ ...scene, opened: collisions.slice(), values: Uint8Array.from(collisions) })),
    };
    bump();
  }

  /** Writes the collisions of each scene whose collisions were painted (only that field of its scene.gbsres). */
  async function saveCollisions(target: Doc): Promise<string[]> {
    const notes: string[] = [];
    for (const scene of target.collision?.scenes ?? []) {
      if (scene.values.every((value, at) => value === (scene.opened[at] ?? 0))) continue;
      if (!await okToWriteProjectJson()) return ["Collisions not written"];
      const post = (force: boolean) => fetch(`./__cartographer/scene-collisions?${new URLSearchParams({ scene: scene.file, mtime: String(scene.mtime), ...(force ? { force: "1" } : {}) })}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collisions: Array.from(scene.values) }) });
      let response = await post(false);
      if (response.status === 409) {
        if (!await confirmBox(`The scene ${scene.name} changed in GB Studio since you opened ${target.name}. Replace its collisions with these?`, { yes: "Replace" })) { notes.push(`${scene.name}'s collisions not written (still unsaved here)`); target.dirty = true; continue; }
        response = await post(true);
      }
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; mtime?: number };
      if (!response.ok || !result.ok) { notes.push(`${scene.name}'s collisions not written: ${result.error ?? response.statusText}`); target.dirty = true; continue; }
      scene.opened = Array.from(scene.values);
      scene.mtime = result.mtime ?? scene.mtime;
      notes.push(`Collisions written to ${scene.name}`);
    }
    return notes;
  }

  /** Puts palettes in slots 1…n of what a picture reads (a scene's palettes, or the project's defaults until a scene shows it). */
  async function putInSlots(asset: Asset, ids: string[]) {
    for (const [slot, paletteId] of ids.entries()) {
      await fetch(`./__cartographer/gbstudio-palette-slot?${assetQuery(asset)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, paletteId }) }).catch(() => null);
    }
  }

  /** Takes a palette nothing uses out of the project (it moves to the backups). */
  async function removeProjectPalette(id: string, name: string): Promise<boolean> {
    if (!await okToWriteProjectJson()) return false;
    const response = await fetch("./__cartographer/gbstudio-palette-remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    const result = response ? await response.json().catch(() => null) as { ok?: boolean; error?: string } | null : null;
    if (!response?.ok || !result?.ok) { say(`${name} stays: ${result?.error ?? "no answer"}`); return false; }
    await loadProject();
    say(`${name} was taken out of the project. Backups… puts it back… up.`);
    return true;
  }

  /** Opens a project picture by kind and file (Health, the check-up). */
  async function openByFile(kind: string, file: string) {
    const asset = projectRef.current?.assets.find((item) => item.kind === kind && item.file === file);
    if (!asset) return false;
    setProjectKind(asset.kind);
    await openAsset(asset);
    return true;
  }

  /** Adds palettes to the project (after the GB Studio check); returns how many were written. */
  async function addPalettes(list: { name: string; colors: string[] }[]): Promise<number> {
    if (!list.length || !await okToWriteProjectJson()) return 0;
    let written = 0;
    for (const palette of list) if (await writeProjectPalette(palette)) written += 1;
    await loadProject();
    setSlotsVersion((value) => value + 1);
    return written;
  }

  /** The background slots a palette set goes in: the open background's or tileset's (its scene's, or the defaults), else the project's defaults (through a tileset). */
  function setSlotsAsset(): { asset: Asset; where: string } | null {
    const open = doc?.asset;
    const asset = open && (open.kind === "backgrounds" || open.kind === "tilesets") ? projectRef.current?.assets.find((item) => item.kind === open.kind && item.file === open.file) : null;
    if (asset) return { asset, where: open?.slotScene ? `${open.slotScene}'s palettes` : "the project's default background palettes" };
    // Tilesets always read the project's defaults, so any tileset stands in for them when nothing is open.
    const tileset = projectRef.current?.assets.find((item) => item.kind === "tilesets");
    return tileset ? { asset: tileset, where: "the project's default background palettes" } : null;
  }

  /** W3: adds a palette set to the project (reusing palettes it already has), and when asked puts it in slots 1…n. */
  async function addPaletteSet(list: { name: string; colors: string[] }[], inSlots: boolean): Promise<number> {
    const target = inSlots ? setSlotsAsset() : null;
    if (inSlots && target && !await confirmBox(`Add the ${list.length} palettes to the project and put them in ${target.where}, slots 1–${list.length}?\n\nThe old settings are backed up.`)) return 0;
    if (!list.length || !await okToWriteProjectJson()) return 0;
    const ids: string[] = [];
    for (const palette of list) {
      const existing = projectRef.current?.palettes.find((item) => item.name === palette.name && item.colors.join() === palette.colors.join());
      const id = existing?.id ?? await writeProjectPalette(palette);
      if (id) ids.push(id);
    }
    await loadProject();
    if (target) { await putInSlots(target.asset, ids.slice(0, 8)); await rereadSlots(); }
    setSlotsVersion((value) => value + 1);
    say(target ? `Added ${ids.length} palettes and put them in ${target.where}.` : `Added ${ids.length} palettes to the project.`);
    return ids.length;
  }

  // ---- Picture to background (W1, 2026-10-10) ----------------------------------------------------------------------

  /** The wizard's result as an untitled picture here: its palettes are palettes of the file. */
  async function openFittedPicture(result: FittedPicture, name: string) {
    await palettesReady.current;
    const id = newDocId(docs.current);
    const palettes = clonePalettes(palettesRef.current);
    const first = palettes.length;
    result.palettes.forEach((colors, index) => palettes.push({ name: result.names?.[index] ?? `${name} ${index + 1}`, colors: [...colors] }));
    docs.current.push({ id, name: `${name.replace(/\.png$/i, "")}.png`, width: result.width, height: result.height, pixels: result.pixels.slice(), cells: Uint8Array.from(result.cells, (wear) => wear ? first + wear : 0), hasAlpha: false, palettes, undo: [], redo: [], dirty: true, zoom: fitZoom(result.width, result.height), sel: null, float: null });
    setActiveId(id);
    setShowPictureWizard(false);
    scheduleSession();
    bump();
    say(result.palettes.length ? `${name}: ${result.palettes.length} palettes of the file. Save asks where it goes.` : `${name}: a new picture. Save asks where it goes.`);
  }

  /**
   * The wizard's result as a new background in the project: the PNG (in GB greens) goes to assets/backgrounds, the
   * palettes are added to the project and put in the default slots 1…n, and the tiles' slots are written.
   */
  async function saveFittedBackground(result: FittedPicture, name: string, asked = false): Promise<boolean> {
    if (!projectRef.current) return false;
    // The default slots are what every scene without its own palettes uses: say so before changing them.
    const count = result.palettes.length;
    if (count && !asked && !await confirmBox(`Make assets/backgrounds/${name}.png and add its ${count} palette${count === 1 ? "" : "s"} to the project?\n\n${count === 1 ? "It goes in the project's default background slot 1" : `They go in the project's default background slots 1–${count}`}, which every scene without its own palettes uses (the old defaults are backed up). Put them in a scene's own slots later with Put in slot.`)) return false;
    if (count && !await okToWriteProjectJson()) return false;
    const ids: string[] = [];
    for (const [index, colors] of result.palettes.entries()) {
      // A named palette the project already has (same name and colors) is used as it is.
      const own = result.names?.[index] ?? `${name} ${index + 1}`;
      const id = projectRef.current?.palettes.find((item) => item.name === own && item.colors.join() === colors.join())?.id ?? await writeProjectPalette({ name: own, colors: [...colors] });
      if (!id) { say("Not every palette could be added to the project; nothing else changed."); return false; }
      ids.push(id);
    }
    const canvas = document.createElement("canvas");
    Object.assign(canvas, { width: result.width, height: result.height });
    canvas.getContext("2d")!.putImageData(new ImageData(toRgba(result.pixels, result.cells, result.width, []), result.width, result.height), 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((made) => made ? resolve(made) : reject(new Error("No PNG")), "image/png"));
    const response = await fetch(`./__cartographer/gbstudio-new-asset?${new URLSearchParams({ kind: "backgrounds", name })}`, { method: "POST", body: blob }).catch(() => null);
    const made = response ? await response.json().catch(() => null) as { ok?: boolean; error?: string; file?: string } | null : null;
    if (!response?.ok || !made?.ok || !made.file) { say(`Could not make the background: ${made?.error ?? response?.statusText ?? "no answer"}`); return false; }
    await loadProject();
    setProjectKind("backgrounds");
    const asset = projectRef.current?.assets.find((item) => item.kind === "backgrounds" && item.file === made.file);
    if (!asset) { say(`Made assets/backgrounds/${made.file}, but it could not be opened.`); return true; }
    if (!count) { await openAsset(asset); say(`Made assets/backgrounds/${made.file}.`); return true; }
    await putInSlots(asset, ids);
    await openAsset(asset);
    const target = docs.current.find((item) => item.asset?.kind === "backgrounds" && item.asset.file === made.file);
    if (target) {
      target.cells = Uint8Array.from(result.cells, (wear) => { const at = wear ? target.palettes.findIndex((palette) => palette.id === ids[wear - 1]) : -1; return at < 0 ? 0 : at + 1; });
      if (target.asset) target.asset.slots = ids.concat(target.asset.slots?.slice(ids.length) ?? []);
      touch(target);
      await saveDoc(target, false, false);
    }
    await rereadSlots();
    setSlotsVersion((value) => value + 1);
    say(`Made assets/backgrounds/${made.file} with ${ids.length === 1 ? "its palette in slot 1" : `${ids.length} palettes in slots 1–${ids.length}`}.${target?.dirty ? " Its tile palettes wait until GB Studio has read the project once: then Save it here again." : ""}`);
    return true;
  }

  /**
   * A generated map cut into one background per screen, 160 × 144 every 152 × 136 px (neighbours share a tile at each
   * edge, as the Map Room expects), named "<name> <column>-<row>", then laid out as a Map Room map and shown there.
   */
  async function saveGeneratedMap(picture: Generated, name: string, columns: number, rows: number): Promise<boolean> {
    if (!projectRef.current) return false;
    const whole = generatedPicture(picture);
    const taken = new Set(projectRef.current.assets.filter((item) => item.kind === "backgrounds").map((item) => item.name.toLowerCase()));
    const clash = Array.from({ length: columns * rows }, (_, at) => `${name} ${at % columns + 1}-${Math.floor(at / columns) + 1}`).find((screen) => taken.has(screen.toLowerCase()));
    if (clash) { say(`The project already has a background called ${clash}: pick another name.`); return false; }
    const count = whole.palettes.length;
    if (!await confirmBox(`Make ${columns * rows} backgrounds (${name} 1-1 to ${name} ${columns}-${rows}) and a Map Room map "${name}"?${count ? `\n\nTheir ${count} palette${count === 1 ? "" : "s"} go in the project's default background slots 1–${count}, which every scene without its own palettes uses (the old defaults are backed up).` : ""}`, { yes: "Make the map" })) return false;
    const W = 160, H = 144, STEP_X = 152, STEP_Y = 136, cw = cellsWide(whole.width);
    const cells: { x: number; y: number; file: string }[] = [];
    for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
      const x0 = column * STEP_X, y0 = row * STEP_Y;
      const pixels = new Uint8Array(W * H), tileCells = new Uint8Array((W / CELL) * (H / CELL));
      for (let y = 0; y < H; y += 1) pixels.set(whole.pixels.subarray((y0 + y) * whole.width + x0, (y0 + y) * whole.width + x0 + W), y * W);
      for (let ty = 0; ty < H / CELL; ty += 1) for (let tx = 0; tx < W / CELL; tx += 1) tileCells[ty * (W / CELL) + tx] = whole.cells[(y0 / CELL + ty) * cw + x0 / CELL + tx] ?? 0;
      const screen = `${name} ${column + 1}-${row + 1}`;
      if (!await saveFittedBackground({ ...whole, width: W, height: H, pixels, cells: tileCells }, screen, true)) return false;
      cells.push({ x: column, y: row, file: `${screen}.png` });
    }
    // The screens' tabs close again once saved (one still waiting for GB Studio stays open, unsaved).
    for (const item of docs.current.filter((entry) => entry.asset?.kind === "backgrounds" && cells.some((cell) => cell.file === entry.asset!.file) && !entry.dirty)) dropDoc(item);
    const maps = await fetch("./__cartographer/maps", { cache: "no-cache" }).then((response) => response.json() as Promise<{ maps?: unknown[] }>).then((result) => result.maps ?? []).catch(() => []);
    const saved = await fetch("./__cartographer/maps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maps: [...maps, { id: `map-${Date.now().toString(36)}`, name, screen: { width: W, height: H }, overlap: 1, cells }] }) }).catch(() => null);
    say(saved?.ok ? `Made ${cells.length} backgrounds and the Map Room map ${name}.` : `Made ${cells.length} backgrounds; the Map Room map couldn't be saved.`);
    if (saved?.ok) setShowMapRoom(true);
    return true;
  }

  /** A cave tile sheet from one of the project's auto-tile stamps (its shades; the generator's palettes color it). */
  async function loadCaveTiles(asset: Asset): Promise<CaveTiles | null> {
    try {
      const blob = await fetch(`${ASSET_URL}?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.blob());
      const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      const canvas = Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(bitmap, 0, 0);
      const picture = quantize(context.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.width, bitmap.height, palettesRef.current, false, false);
      const kind = asset.autotile === "wallface" || asset.autotile === "wang" || asset.autotile === "edges" || asset.autotile === "corner" || asset.autotile === "path" ? asset.autotile : null;
      return kind ? { kind, pixels: Uint8Array.from(picture.pixels, (shade) => shade === CLEAR ? 0 : shade), width: bitmap.width } : null;
    } catch {
      say(`The stamp ${asset.name} could not be read.`);
      return null;
    }
  }

  /** A generated map as a fitted picture: its tiles' palettes when it has them, else every tile in the greens. */
  const generatedPicture = ({ width, height, pixels, cells, palettes }: Generated): FittedPicture => ({ width, height, pixels, cells: cells ?? new Uint8Array(cellsWide(width) * Math.ceil(height / CELL)), palettes: palettes?.map((palette) => palette.colors) ?? [], names: palettes?.map((palette) => palette.name) });

  // ---- the text tool (W5) ------------------------------------------------------------------------------------------

  /** A project font sheet read for typing, cached by file and modification time. */
  async function fontSheet(file: string): Promise<FontSheet | null> {
    const asset = projectRef.current?.assets.find((item) => item.kind === "fonts" && item.file === file);
    if (!asset) return null;
    const key = `${file}|${asset.mtime}`;
    const known = fontSheets.current.get(key);
    if (known) return known;
    try {
      const blob = await fetch(`${ASSET_URL}?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.blob());
      const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      const canvas = Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(bitmap, 0, 0);
      const sheet = readFontSheet(context.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.width, bitmap.height, await fetchFontMap(file));
      fontSheets.current.set(key, sheet);
      return sheet;
    } catch {
      say(`${asset.name} could not be read as a font sheet.`);
      return null;
    }
  }

  const textOptions = (settings: TextSettings) => ({ ink: settings.ink, invert: settings.invert, box: settings.box, leading: 0 });

  /** The text floats at `point` (anything floating before lands first). */
  async function placeText(point: Point) {
    const target = doc;
    if (!target) return;
    const font = textSettings.font || projectRef.current?.assets.find((asset) => asset.kind === "fonts")?.file || "";
    const sheet = await fontSheet(font);
    if (!sheet) return say("The text tool needs one of the project's font sheets.");
    dropFloat(target);
    pushUndo(target);
    target.float = renderText(sheet, textSettings.text || " ", textOptions(textSettings), point.x, point.y);
    target.sel = { x: point.x, y: point.y, w: target.float.w, h: target.float.h };
    textFloat.current = target.float;
    bump();
  }

  /** The floating text follows the settings (words, font, ink…) where it is. */
  async function updateText(settings: TextSettings) {
    setTextSettings(settings);
    const target = doc;
    if (!target?.float || target.float !== textFloat.current) return;
    const sheet = await fontSheet(settings.font);
    if (!sheet || target.float !== textFloat.current) return;
    const { x, y } = target.float;
    target.float = renderText(sheet, settings.text || " ", textOptions(settings), x, y);
    target.sel = { x, y, w: target.float.w, h: target.float.h };
    textFloat.current = target.float;
    bump();
  }

  function stampText() {
    if (!doc?.float) return;
    dropFloat(doc);
    doc.sel = null;
    textFloat.current = null;
    touch(doc);
  }

  function cancelText() {
    if (!doc?.float || doc.float !== textFloat.current) return;
    // Nothing was lifted from the picture, so the text just goes, with the undo step its placing added.
    doc.float = null;
    doc.sel = null;
    doc.undo.pop();
    textFloat.current = null;
    bump();
  }

  // ---- stamps (saved in the project's Cartographer/stamps/) --------------------------------------------------------

  /** A stamp's tile palettes as its sidecar keeps them: up to eight palette ids, and each tile's slot (-1: none). */
  function stampMeta(cells: ArrayLike<number>, palettes: readonly Palette[]): { slots: string[]; tileColors: number[] } {
    const slots: string[] = [];
    const tileColors = Array.from(cells, (wear) => {
      const id = wear ? palettes[wear - 1]?.id : undefined;
      if (!id) return -1;
      let slot = slots.indexOf(id);
      if (slot < 0 && slots.length < 8) slot = slots.push(id) - 1;
      return slot;
    });
    return { slots, tileColors };
  }

  async function postStampMeta(file: string, meta: { slots: string[]; tileColors: number[]; tags?: string[] }, metaMtime: number | null | undefined, force = false) {
    return fetch(`./__cartographer/stamp-meta?${new URLSearchParams({ file })}${metaMtime != null ? `&metaMtime=${metaMtime}` : ""}${force ? "&force=1" : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta) });
  }

  /** An edited stamp's tile palettes, after its PNG. */
  async function saveStampMeta(target: Doc): Promise<string[]> {
    const asset = target.asset!;
    const meta = stampMeta(target.cells, target.palettes);
    let response = await postStampMeta(asset.file, meta, asset.metaMtime);
    if (response.status === 409) {
      if (!await confirmBox(`The palettes of the stamp ${asset.name} changed on disk since you opened it. Replace them?`)) return ["Stamp palettes not written"];
      response = await postStampMeta(asset.file, meta, asset.metaMtime, true);
    }
    const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; mtime?: number };
    if (!response.ok || !result.ok) return [`Stamp palettes not written: ${result.error ?? response.statusText}`];
    asset.metaMtime = result.mtime ?? asset.metaMtime;
    return [];
  }

  /**
   * Saves the selection (with its tile palettes when it sits on whole tiles) as a stamp: a PNG in the project's
   * Cartographer/stamps/ and its palettes beside it. It also becomes the stamp in hand.
   */
  async function saveAsStamp() {
    const target = doc;
    if (!target?.sel || !project) return;
    const area = clipRect(target.sel, target.width, target.height);
    if (!area) return;
    const picked = await new Promise<StampSave | null>((resolve) => setStampSave({ hint: `A PNG in ${project.name}/Cartographer/stamps${onTiles(area) ? ", with its tile palettes" : ""}`, resolve }));
    setStampSave(null);
    if (!picked) return;
    const { name, tags } = picked;
    const flat = target.pixels.slice(), flatCells = target.cells.slice();
    if (target.float) { drop(flat, target.width, target.height, target.float); dropCells(flatCells, target.width, target.height, target.float); }
    const piece = lift(flat, target.width, area);
    const cells = onTiles(area) ? liftCells(flatCells, target.width, area) : null;
    // See-through stays see-through in the PNG (no key color): a stamp opens like any picture.
    const canvas = document.createElement("canvas");
    Object.assign(canvas, { width: area.w, height: area.h });
    canvas.getContext("2d")!.putImageData(new ImageData(toRgba(piece.pixels, new Uint8Array(cellsWide(area.w) * Math.ceil(area.h / CELL)), area.w, []), area.w, area.h), 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return say("The stamp could not be made.");
    const made = await fetch(`./__cartographer/gbstudio-new-asset?${new URLSearchParams({ kind: "stamps", name })}`, { method: "POST", body: blob }).catch(() => null);
    const result = made ? await made.json().catch(() => null) as { ok?: boolean; file?: string; error?: string } | null : null;
    if (!made?.ok || !result?.ok || !result.file) return say(`The stamp was not saved: ${result?.error ?? "no answer"}`);
    if ((cells && cells.some(Boolean)) || tags.length) await postStampMeta(result.file, { ...(cells ? stampMeta(cells, target.palettes) : { slots: [], tileColors: [] }), tags }, null);
    takeStamp(target, area);
    await loadProject();
    say(`Saved the stamp ${name} in ${project.name}/Cartographer/stamps${cells ? " with its tile palettes" : ""}. It's in hand: pick the Stamp tool (C) to use it.`);
  }

  /** Picks up a saved stamp as the stamp in hand, with its tile palettes, and switches to the Stamp tool. */
  /** What a saved stamp's 9 / W setting makes of it at this size (autotile.ts), and a note when the size doesn't fit. */
  function autotileOf(asset: Asset, w: number, h: number): { flags: { auto?: AutotileKind }; note: string } {
    const kind = autotileKind(asset.autotile);
    if (!kind) return { flags: {}, note: " Click or drag to stamp it on the grid." };
    if (!kind.fits(w, h)) return { flags: {}, note: ` (${kind.name} needs ${kind.size}: stamped as it is.)` };
    return { flags: { auto: kind.id }, note: ` ${kind.name}: ${kind.about}.${["wang", "edges", "path", "corner", "wallface", "atlas", "atlasAnim", "atlasWall", "mound", "forest", "xp", "xpAnim", "xpCliff", "xpCliffTall"].includes(kind.id) ? " Alt clears." : ""}` };
  }
  /** An animated stamp stamps its first frame (square, from the left). */
  const firstFrame = <T extends { pixels: Uint8Array; w: number; h: number; cells?: Uint8Array }>(stamp: T, auto?: AutotileKind): T => {
    if (auto === "xpCliffTall") return tallCliffSheet(stamp);
    if (auto !== "anim") return stamp;
    const size = stamp.h, pixels = new Uint8Array(size * size);
    for (let y = 0; y < size; y += 1) pixels.set(stamp.pixels.subarray(y * stamp.w, y * stamp.w + size), y * size);
    const cw = stamp.w / 8, fw = size / 8;
    const cells = stamp.cells ? Uint8Array.from({ length: fw * fw }, (_, at) => stamp.cells![Math.floor(at / fw) * cw + (at % fw)]) : undefined;
    // The whole strip goes along, so its frames can play over the picture while the stamp is held.
    return { ...stamp, pixels, w: size, ...(cells ? { cells } : {}), animSheet: { pixels: stamp.pixels, w: stamp.w, h: stamp.h, ...(stamp.cells ? { cells: stamp.cells } : {}) } };
  };

  /**
   * A Cliff sheet (48 × 80) as the 32 px-wall brush reads it (48 × 96, the author 2026-10-14): the plateau rows as
   * they are, the 16 px face stretched to 32 (its top 4 rows, its plain middle row repeated, its last 10 rows), then
   * the sheet's spare pieces two tile rows lower. Tile palettes follow their rows.
   */
  function tallCliffSheet<T extends { pixels: Uint8Array; w: number; h: number; cells?: Uint8Array }>(stamp: T): T {
    const from = (y: number) => y < 32 ? y : y < 64 ? (y - 32 < 4 ? y : y - 32 >= 22 ? 38 + (y - 32 - 22) : 37) : y - 16;
    const pixels = new Uint8Array(stamp.w * 96);
    for (let y = 0; y < 96; y += 1) pixels.set(stamp.pixels.subarray(from(y) * stamp.w, from(y) * stamp.w + stamp.w), y * stamp.w);
    const cw = stamp.w / 8, cells = stamp.cells ? Uint8Array.from({ length: cw * 12 }, (_, at) => stamp.cells![(from(Math.floor(at / cw) * 8 + 4) >> 3) * cw + (at % cw)]) : undefined;
    return { ...stamp, pixels, h: 96, ...(cells ? { cells } : {}) };
  }

  /** Sets a saved stamp's auto-tile (9 box, W Wang, or none) in its own sidecar; the stamp in hand follows. */
  async function setStampAutotile(asset: Asset, autotile: AutotileKind | null) {
    const response = await fetch(`./__cartographer/stamp-autotile?${new URLSearchParams({ file: asset.file })}`, { method: "POST", body: JSON.stringify({ autotile }) }).catch(() => null);
    if (!response?.ok) { say(`Could not change ${asset.name}: ${response?.statusText ?? "no answer"}`); return; }
    await loadProject();
    const fresh = projectRef.current?.assets.find((item) => item.kind === "stamps" && item.file === asset.file);
    if (fresh && heldStamp.current === asset.file) await useSavedStamp(fresh);
    else { const kind = autotileKind(autotile ?? undefined); say(`${asset.name}: ${kind ? kind.name : "a plain stamp"}.`); }
  }
  const heldStamp = useRef<string | null>(null);

  async function useSavedStamp(asset: Asset) {
    await palettesReady.current;
    if (!doc) return say(`Open a picture first, then click ${asset.name} to stamp it on.`);
    // Open with unsaved edits: the stamp is what's on screen, not the file.
    const open = docs.current.find((item) => item.asset?.kind === asset.kind && item.asset.file === asset.file);
    if (open && open !== doc) {
      const whole = open.width % CELL === 0 && open.height % CELL === 0;
      const auto = autotileOf(asset, open.width, open.height);
      setStamp(firstFrame({ pixels: open.pixels.slice(), w: open.width, h: open.height, x: 0, y: 0, ...(whole ? { cells: open.cells.slice() } : {}), palettes: clonePalettes(open.palettes), ...auto.flags, ...(asset.tags?.includes(PATTERN_TAG) && !auto.flags.auto ? { repeat: true } : {}) }, auto.flags.auto));
      heldStamp.current = asset.file;
      if (tool !== "stamp") setTool("stamp");
      return say(`Stamp: ${asset.name} (${open.width} × ${open.height}).${auto.note}`);
    }
    try {
      const [blob, info] = await Promise.all([
        fetch(`${ASSET_URL}?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.blob()),
        fetch(`${ASSET_URL}-info?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.json() as Promise<AssetInfo>),
      ]);
      const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      const canvas = document.createElement("canvas");
      Object.assign(canvas, { width: bitmap.width, height: bitmap.height });
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(bitmap, 0, 0);
      const picture = quantize(context.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.width, bitmap.height, palettesRef.current, false, false);
      const tinted = info.tileColors.length ? assignSlots(picture.cells, info.tileColors, info.slots, picture.palettes) : 0;
      const whole = bitmap.width % CELL === 0 && bitmap.height % CELL === 0;
      const auto = autotileOf(asset, bitmap.width, bitmap.height);
      setStamp(firstFrame({ pixels: picture.pixels, w: bitmap.width, h: bitmap.height, x: 0, y: 0, ...(whole && tinted ? { cells: picture.cells } : {}), palettes: clonePalettes(picture.palettes), ...auto.flags, ...(asset.tags?.includes(PATTERN_TAG) && !auto.flags.auto ? { repeat: true } : {}) }, auto.flags.auto));
      heldStamp.current = asset.file;
      if (tool !== "stamp") setTool("stamp");
      // A palette the stamp's tiles were saved with that the project no longer has: those tiles show in the greens.
      const known = new Set(picture.palettes.map((palette) => palette.id).filter(Boolean));
      const gone = info.slots.map((id, slot) => ({ id, slot, tiles: info.tileColors.filter((value) => value === slot).length })).filter(({ id, tiles }) => id && tiles && !known.has(id));
      const missing = gone.length ? ` ${gone.reduce((sum, item) => sum + item.tiles, 0)} of its tiles were saved with ${gone.length === 1 ? "a palette" : `${gone.length} palettes`} this project no longer has (slot ${gone.map((item) => item.slot + 1).join(", ")}), so they show in the GB greens. Paint them a palette and save the stamp to fix it.` : "";
      say(`Stamp: ${asset.name} (${bitmap.width} × ${bitmap.height}).${auto.note}${missing}`);
    } catch {
      say(`The stamp ${asset.name} could not be read.`);
    }
  }

  /**
   * Writes a background's or sprite sheet's tile palettes into GB Studio as palette slots: a tile wearing one of
   * the eight palettes gets that slot (with Time-of-day palettes on, a D / N / S version gets its base palette's);
   * "None" and palettes outside the eight leave the tile's slot as it is. Only
   * cells whose slot differs from the one they were opened with are sent, so a sprite slice that several frames
   * show in different palettes keeps them unless the user paints it.
   */
  async function saveTileColors(target: Doc): Promise<string[]> {
    const asset = target.asset!;
    const slotOf = paletteSlots(target.palettes, asset.slots!, namedSlotsRef.current);
    let outside = 0;
    // After a resize the sidecar's old tileColors are laid out for the old width, so every cell is sent (the server
    // would otherwise fill the unsent ones from the wrong places): a tile's slot as painted, else as it was opened
    // (moved with the picture), else slot 0 for a new tile.
    const all = Boolean(target.resized);
    const slots = Array.from(target.cells, (wear, cell) => {
      const was = asset.opened?.[cell];
      const keep = all ? (was !== undefined && was >= 0 ? was : 0) : null;
      if (!wear) return keep;
      const slot = slotOf.get(wear);
      if (slot === undefined) outside += 1;
      if (slot === undefined) return keep;
      return !all && slot === was ? null : slot;
    });
    // Priority flags that changed since opening (backgrounds and tilesets); all of them after a resize.
    const priority = target.priority ? Array.from(target.priority, (on, cell) => !all && on === (asset.openedPriority?.[cell] ?? 0) ? null : on === 1) : [];
    const flagged = priority.filter((value) => value !== null).length;
    if (!await okToWriteProjectJson()) return ["Tile palettes not written"];
    const post = (force: boolean) => fetch(`./__cartographer/gbstudio-tile-colors?${new URLSearchParams({ kind: asset.kind, file: asset.file })}${asset.metaMtime != null ? `&metaMtime=${asset.metaMtime}` : ""}${force ? "&force=1" : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots, ...(flagged ? { priority } : {}) }) });
    let response = await post(false);
    if (response.status === 409) {
      if (!await confirmBox(`The palettes of ${asset.name} changed in GB Studio since you opened it. Replace them with this picture's?`)) return ["Tile palettes not written"];
      response = await post(true);
    }
    const result = await response.json() as { ok?: boolean; error?: string; mtime?: number; changed?: boolean; cells?: number };
    if (!response.ok || !result.ok) return [`Tile palettes not written: ${result.error ?? response.statusText}`];
    if (target.priority) asset.openedPriority = Array.from(target.priority);
    asset.metaMtime = result.mtime ?? asset.metaMtime;
    const notes: string[] = [];
    if (result.changed) notes.push(flagged ? `${result.cells} tile${result.cells === 1 ? "" : "s"} written to GB Studio (palettes and draw-over-sprites flags)` : `${result.cells} tile palette${result.cells === 1 ? "" : "s"} written to GB Studio`);
    if (outside) notes.push(`${outside} tile${outside === 1 ? "" : "s"} wear palettes outside the eight slots and keep their slot`);
    // A sprite slice is 8 × 16 with one palette: halves wearing different palettes get the top one in the game.
    if (asset.kind === "sprites") {
      const cw = Math.ceil(target.width / 8), ch = Math.ceil(target.height / 8);
      let split = 0;
      for (let y = 0; y + 1 < ch; y += 2) for (let x = 0; x < cw; x += 1) {
        const top = target.cells[y * cw + x], bottom = target.cells[(y + 1) * cw + x];
        if (top && bottom && top !== bottom) split += 1;
      }
      if (split) notes.push(`${split} sprite slice${split === 1 ? "" : "s"} wear two palettes (top and bottom half); GB Studio uses the top half's for the whole 8 × 16 slice`);
    }
    return notes;
  }

  /**
   * Open pictures of the current project reread their palette slots (a scene's palette list may have changed since
   * the session was kept); those from an older session, or tilesets opened before they had palette slots, also
   * learn their tile slots as opened.
   */
  async function rereadSlots() {
    const path = projectRef.current?.path;
    if (!path) return;
    const ours = docs.current.filter((item) => item.asset && hasSlots(item.asset.kind) && (!item.asset.project || item.asset.project === path));
    await Promise.all(ours.map(async (item) => {
      const asset = item.asset!;
      const info = await fetch(`${ASSET_URL}-info?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.ok ? response.json() as Promise<AssetInfo> : null).catch(() => null);
      if (!info) return;
      if (!asset.slots) Object.assign(asset, { metaMtime: info.metaMtime, opened: info.tileColors.map((value) => value < 0 ? -1 : value & 7), project: path });
      // Pictures from an older session learn their tiles' priority flags too.
      if (!item.priority && (asset.kind === "backgrounds" || asset.kind === "tilesets")) {
        const flags = Array.from({ length: item.cells.length }, (_, cell) => (info.tileColors[cell] ?? 0) >= 0 && (info.tileColors[cell] ?? 0) & 0x80 ? 1 : 0);
        item.priority = Uint8Array.from(flags);
        asset.openedPriority = flags;
      }
      Object.assign(asset, { slots: info.slots, slotScene: info.slotScene ?? null, ...(asset.kind === "sprites" ? { animSpeed: info.animSpeed ?? null } : {}), ...(asset.kind === "backgrounds" ? { parallax: info.parallax ?? [] } : {}) });
    }));
    if (ours.length) bump();
  }

  /**
   * Puts one of the open picture's palettes into slot `slot` (0–7) in GB Studio: the scene's palette list, or the
   * project's default palettes. Open pictures that take their slots from the same place learn the new ones, and
   * the toast says how many tiles wore the palette that was moved out.
   */
  async function putInSlot(paletteIndex: number, slot: number) {
    const target = doc, asset = target?.asset, palette = target?.palettes[paletteIndex - 1];
    if (!target || !asset?.slots || !palette) return;
    if (!palette.id) return say(`${palette.name} is not in the project yet: add it from the palette manager first.`);
    if (asset.project && asset.project !== projectRef.current?.path) return say(`${asset.name} belongs to ${asset.project}. Open that project to change its slots.`);
    if (slot === UI_SLOT && asset.kind !== "sprites" && !await confirmBox(`Slot 8 is the UI palette: GB Studio draws dialogue boxes and menus with it. Put ${palette.name} there anyway?`, { yes: "Use slot 8" })) return;
    if (!await okToWriteProjectJson()) return;
    const old = asset.slots[slot];
    const oldPalette = target.palettes.find((item) => item.id === old);
    try {
      const post = (expected?: string) => fetch(`./__cartographer/gbstudio-palette-slot?${assetQuery(asset)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, paletteId: palette.id, ...(expected !== undefined ? { expected } : {}) }) });
      let response = await post(old ?? "");
      if (response.status === 409) {
        const { current } = await response.json() as { current?: string };
        const now = target.palettes.find((item) => item.id === current)?.name ?? "another palette";
        if (!await confirmBox(`Slot ${slot + 1} changed on disk: it now holds ${now}. Replace it with ${palette.name}?`)) { await rereadSlots(); bump(); return; }
        response = await post();
      }
      const result = await response.json() as { ok?: boolean; error?: string; slots?: string[]; scene?: string | null };
      if (!response.ok || !result.ok || !result.slots) return say(`Could not put ${palette.name} in slot ${slot + 1}: ${result.error ?? response.statusText}`);
      await rereadSlots();
      const where = result.scene ? `${result.scene}'s palettes` : `the project's default ${asset.kind === "sprites" ? "sprite" : "background"} palettes`;
      const oldIndex = oldPalette ? target.palettes.indexOf(oldPalette) + 1 : 0;
      const left = oldIndex && !result.slots.includes(old) ? target.cells.reduce((count, wear) => count + (wear === oldIndex ? 1 : 0), 0) : 0;
      say(`${palette.name} is in slot ${slot + 1} of ${where}${oldPalette && oldPalette !== palette ? ` (it held ${oldPalette.name})` : ""}.${left ? ` ${left} tile${left === 1 ? "" : "s"} here wear ${oldPalette!.name}, now outside the eight: in GB Studio they show slot ${slot + 1} until repainted.` : ""} Save to write this picture's tiles.`);
      setSlotsVersion((version) => version + 1);
      scheduleSession();
      bump();
    } catch (error) {
      say(`Could not put ${palette.name} in slot ${slot + 1}: ${(error as Error).message}`);
    }
  }

  function pngBlob(target: Doc): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    // A picture GB Studio reads without a see-through key (backgrounds, tilesets, avatars, UI) never gets transparent
    // pixels: they're written as the lightest shade (GB Studio would read alpha-0 black as an off-palette color).
    const keyed = target.keyGreen || target.keyMagenta, kind = target.asset?.kind;
    const pixels = !keyed && kind && kind !== "stamps" && target.pixels.includes(CLEAR) ? target.pixels.map((value) => value === CLEAR ? 0 : value) : target.pixels;
    canvas.getContext("2d")!.putImageData(new ImageData(toRgba(pixels, target.cells, target.width, [], target.keyGreen ? KEY_GREEN : target.keyMagenta ? KEY_MAGENTA : undefined), target.width, target.height), 0, 0);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No PNG")), "image/png"));
  }

  /**
   * Writes one picture as a flat PNG in the GB greens (palettes and tint are only for looking): into its GB Studio
   * project, over its file, or (`copy`, or no file to write to) to a place the user picks. Returns what happened.
   */
  async function saveDoc(target: Doc, copy: boolean, askWhere: boolean): Promise<string | null> {
    dropFloat(target);
    try {
      const blob = await pngBlob(target);
      if (!copy && target.asset) return await saveAsset(target, blob) ? target.asset.name : null;
      const picker = (window as PickerWindow).showSaveFilePicker;
      let handle = copy ? undefined : target.handle;
      if (!handle && !askWhere) return null;
      if (!handle && picker) handle = await picker.call(window, { suggestedName: target.name, types: PNG_TYPES });
      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        if (!copy || !target.handle) {
          Object.assign(target, { handle, name: handle.name, dirty: false, changedOnDisk: undefined });
          // Our own save is not someone else's change: remember the file's new time.
          target.fileTime = await handle.getFile().then((file) => file.lastModified).catch(() => Date.now());
        }
        return handle.name;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = target.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      target.dirty = false;
      return `${target.name} (downloaded)`;
    } catch (error) {
      if ((error as Error).name !== "AbortError") say(`Could not save ${target.name}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Exports the open picture as an image to share (an itch page, a post): `colored` draws it as shown here (tile
   * palettes, the tint on plain tiles), else in the GB greens; `scale` enlarges it with hard pixel edges.
   * See-through pixels stay see-through. The picture itself is not touched.
   */
  async function exportImage(scale: number, colored: boolean) {
    const target = doc;
    if (!target) return;
    const flat = target.pixels.slice(), cells = target.cells.slice();
    if (target.float) {
      drop(flat, target.width, target.height, target.float);
      dropCells(cells, target.width, target.height, target.float);
    }
    const small = document.createElement("canvas");
    Object.assign(small, { width: target.width, height: target.height });
    const image = new ImageData(target.width, target.height);
    if (colored) colorize(flat, cells, target.width, luts, new Uint32Array(image.data.buffer));
    else image.data.set(toRgba(flat, cells, target.width, []));
    small.getContext("2d")!.putImageData(image, 0, 0);
    const big = document.createElement("canvas");
    Object.assign(big, { width: target.width * scale, height: target.height * scale });
    const context = big.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.drawImage(small, 0, 0, big.width, big.height);
    const blob = await new Promise<Blob>((resolve, reject) => big.toBlob((made) => made ? resolve(made) : reject(new Error("No PNG")), "image/png"));
    const name = `${target.name.replace(/\.png$/i, "")}${colored ? "" : " greens"}${scale > 1 ? ` ${scale}x` : ""}.png`;
    if (await saveBlob(blob, name, PNG_TYPES)) say(`Exported ${name} (${big.width} × ${big.height})`);
  }

  /** Lets the user keep a file (see app/files.ts); failures other than a cancel are said. */
  const saveBlob = (blob: Blob, name: string, types: object[]) => saveFile(blob, name, types, say);

  /**
   * The sprite sheet's current animation as a looping GIF, frames put together from their slices as shown here
   * (palettes, screen look), at GB Studio's speed, enlarged `scale` times with hard pixel edges.
   */
  /** The current animation's frames put together from their slices as shown here (app/files.ts). */
  const composeFrames = () => canvasRef.current ? framesOf(canvasRef.current, frames) : [];

  async function exportGif(scale: number) {
    const composed = composeFrames();
    if (!doc || !composed.length) return;
    const big = document.createElement("canvas");
    Object.assign(big, { width: composed[0].width * scale, height: composed[0].height * scale });
    const wide = big.getContext("2d", { willReadFrequently: true })!;
    wide.imageSmoothingEnabled = false;
    const images = composed.map((frameCanvas) => {
      wide.clearRect(0, 0, big.width, big.height);
      wide.drawImage(frameCanvas, 0, 0, big.width, big.height);
      return wide.getImageData(0, 0, big.width, big.height).data;
    });
    try {
      const gif = encodeGif(images, big.width, big.height, Math.max(2, Math.round(100 / fps)));
      const name = `${doc.name.replace(/\.png$/i, "")}${animations.length > 1 && animation?.name ? ` ${animation.name}` : ""}${scale > 1 ? ` ${scale}x` : ""}.gif`;
      if (await saveBlob(new Blob([gif], { type: "image/gif" }), name, [{ description: "GIF animation", accept: { "image/gif": [".gif"] } }])) say(`Exported ${name} (${frames.length} frames, ${big.width} × ${big.height})`);
    } catch (error) {
      say(`Could not make the GIF: ${(error as Error).message}`);
    }
  }

  /**
   * Save (Ctrl+S) saves every changed picture that has somewhere to go; the active one is asked where when it has
   * none. Export copy (Ctrl+E) saves a copy of the active picture only.
   */
  async function save(copy: boolean) {
    if (!doc) return;
    saving.current = true;
    try { await saveAll(copy); } finally { saving.current = false; }
  }

  async function saveAll(copy: boolean) {
    if (!doc) return;
    bump();
    if (copy) {
      const name = await saveDoc(doc, true, true);
      if (name) say(`Exported ${name}`);
    } else {
      const changed = docs.current.filter((item) => item.dirty || item === doc);
      const saved: string[] = [];
      for (const item of changed) {
        const name = await saveDoc(item, false, item === doc);
        if (name) saved.push(name);
      }
      // Palettes recolored in the sidebar go into the project too (the manager's "Save into project" does the same).
      const edited = project ? editedProjectPalettes() : [];
      let written = 0;
      if (edited.length && await okToWriteProjectJson()) for (const palette of edited) if (await writeProjectPalette(palette)) written += 1;
      const note = written ? ` · ${written} palette${written === 1 ? "" : "s"} written to the project` : "";
      if (saved.length > 1) say(`Saved ${saved.length} pictures: ${saved.join(", ")}${note}`);
      else if (saved.length === 1 && !doc.asset) say(`Saved ${saved[0]}${note}`);
      else if (written) say(`${written} palette${written === 1 ? "" : "s"} written to the project`);
    }
    scheduleSession();
    bump();
  }

  /**
   * Notices open project pictures whose PNG or sidecar changed on disk (GB Studio saved, a restore, another app):
   * a picture without unsaved changes reloads; one with unsaved changes gets a bar to reload or keep it.
   */
  async function checkDisk() {
    await checkFiles();
    const path = projectRef.current?.path;
    if (!path || saving.current) return;
    const open = docs.current.filter((item) => item.asset && (!item.asset.project || item.asset.project === path));
    if (!open.length) return;
    const result = await fetch("./__cartographer/asset-times", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assets: open.map((item) => ({ kind: item.asset!.kind, file: item.asset!.file })) }) })
      .then((response) => response.ok ? response.json() as Promise<{ times?: ({ mtime: number; metaMtime: number | null } | null)[] }> : null).catch(() => null);
    if (!result?.times || saving.current) return;
    const differs = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.abs(a - b) > 1;
    const reloaded: string[] = [];
    for (const [index, item] of open.entries()) {
      const now = result.times[index], asset = item.asset!;
      if (!now) continue;
      const seen = item.changedOnDisk;
      const changed = differs(now.mtime, asset.mtime) || differs(now.metaMtime, asset.metaMtime);
      if (!changed || (seen && !differs(now.mtime, seen.mtime) && !differs(now.metaMtime, seen.metaMtime))) continue;
      if (item.dirty) item.changedOnDisk = now;
      else if (await reloadAsset(item)) reloaded.push(asset.name);
    }
    if (reloaded.length) say(`${reloaded.join(", ")} changed on disk and ${reloaded.length === 1 ? "was" : "were"} reloaded.`);
    bump();
  }

  /**
   * Flips the selection (or the whole picture) left-right or top-bottom, or turns the selection a quarter turn
   * clockwise. Tile-aligned pieces take their tile palettes along.
   */
  function transformSelection(how: "x" | "y" | "turn") {
    if (!doc) return;
    const floating = floatSelection(doc, false);
    if (!floating) return;
    doc.float = how === "turn" ? rotateFloat(floating) : flipFloat(floating, how);
    doc.sel = { x: doc.float.x, y: doc.float.y, w: doc.float.w, h: doc.float.h };
    setToolState("select");
    touch(doc);
  }

  /**
   * Invert (the author, 2026-10-13): the selection's shades turned over, lightest ↔ darkest (0 ↔ 3, 1 ↔ 2), or the
   * whole picture's with nothing selected; see-through stays see-through. One undo takes it back.
   */
  function invertSelection() {
    if (!doc) return;
    if (doc.sel || doc.float) {
      const floating = floatSelection(doc, false);
      if (!floating) return;
      floating.pixels = floating.pixels.map((value) => value <= 3 ? 3 - value : value);
      setToolState("select");
    } else {
      pushUndo(doc);
      doc.pixels = doc.pixels.map((value) => value <= 3 ? 3 - value : value);
    }
    touch(doc);
    say(doc.sel ? "Inverted the selection" : "Inverted the picture");
  }

  /**
   * PNGs opened from disk with a handle (not project pictures) are watched too, so a picture another app saves
   * (Aseprite exporting on every save, say) reloads here: in place when it has no unsaved changes, else the bar asks.
   */
  async function checkFiles() {
    if (saving.current) return;
    const reloaded: string[] = [];
    for (const item of docs.current.filter((doc) => doc.handle && !doc.asset && doc.fileTime !== undefined)) {
      let file: File;
      try { file = await item.handle!.getFile(); } catch { continue; }
      if (file.lastModified === item.fileTime || file.lastModified === item.changedOnDisk?.mtime) continue;
      if (item.dirty) { item.changedOnDisk = { mtime: file.lastModified, metaMtime: null }; continue; }
      await openFiles([{ file, handle: item.handle, replace: item.id }]);
      reloaded.push(item.name);
    }
    if (reloaded.length) say(`${reloaded.join(", ")} changed on disk and ${reloaded.length === 1 ? "was" : "were"} reloaded.`);
  }

  /** Shows the next (1) or previous (-1) open picture, wrapping around. */
  function switchTab(step: number) {
    const list = docs.current;
    if (list.length < 2) return;
    const at = list.findIndex((item) => item.id === activeId);
    setActiveId(list[(at + step + list.length) % list.length].id);
  }

  // The tab strip: the open picture's tab scrolls into view, and fades at an edge mark more tabs that way.
  const tabsRef = useRef<HTMLDivElement>(null);
  function tabFades() {
    const strip = tabsRef.current;
    if (!strip) return;
    strip.toggleAttribute("data-more-left", strip.scrollLeft > 2);
    strip.toggleAttribute("data-more-right", strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2);
  }
  useEffect(() => {
    tabsRef.current?.querySelector(".app-tab.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    tabFades();
  }, [activeId, docs.current.length]);
  useEffect(() => { window.addEventListener("resize", tabFades); return () => window.removeEventListener("resize", tabFades); }, []);

  /** The project folder an open picture's file belongs to, when that isn't the open project (a plane on its tab). */
  function foreignProject(item: Doc): string | null {
    const from = item.asset?.project, here = projectRef.current?.path;
    return from && from !== here ? from : null;
  }

  function foreignPictures(): ForeignPicture[] {
    return docs.current.flatMap((item) => {
      const from = foreignProject(item);
      if (!from || !item.asset) return [];
      const path = item.asset.kind === "stamps" ? `Cartographer/stamps/${item.asset.file}` : `assets/${item.asset.kind}/${item.asset.file}`;
      const hereToo = Boolean(projectRef.current?.assets.some((asset) => asset.kind === item.asset!.kind && asset.file === item.asset!.file));
      return [{ id: item.id, name: item.name, project: from, path, hereToo }];
    });
  }

  /** Saves a picture from another project into this one as a new picture (never replacing a file) and opens it. */
  async function copyIntoProject(item: Doc) {
    if (!item.asset || !projectRef.current) return;
    dropFloat(item);
    const blob = await pngBlob(item);
    const response = await fetch(`./__cartographer/gbstudio-new-asset?${new URLSearchParams({ kind: item.asset.kind, name: item.name.replace(/\.png$/i, "") })}`, { method: "POST", body: blob }).catch(() => null);
    const result = response ? await response.json().catch(() => null) as { ok?: boolean; error?: string; file?: string } | null : null;
    if (!response?.ok || !result?.ok || !result.file) { say(`Could not save it into this project: ${result?.error ?? response?.statusText ?? "no answer"}`); return; }
    await loadProject();
    const made = projectRef.current?.assets.find((asset) => asset.kind === item.asset!.kind && asset.file === result.file);
    if (made) await openAsset(made);
    say(`Saved ${item.name} into ${projectRef.current?.name ?? "the project"} as ${result.file} (its tile palettes stay behind). The other project's tab is still open.`);
  }

  /** A copy of a picture beside it ("<name> copy"), as a new PNG; a stamp keeps its tile palettes, tags and auto-tile. */
  async function duplicateAsset(asset: Asset) {
    const name = copyName(asset.file.replace(/\.png$/i, ""), (projectRef.current?.assets ?? []).filter((item) => item.kind === asset.kind).flatMap((item) => [item.name, item.file.replace(/\.png$/i, "")]));
    const blob = await fetch(`${ASSET_URL}?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.blob()).catch(() => null);
    if (!blob) return say(`Could not read ${asset.name}.`);
    const response = await fetch(`./__cartographer/gbstudio-new-asset?${new URLSearchParams({ kind: asset.kind, name })}`, { method: "POST", body: blob }).catch(() => null);
    const result = response ? await response.json().catch(() => null) as { ok?: boolean; error?: string; file?: string } | null : null;
    if (!response?.ok || !result?.ok || !result.file) return say(`Could not duplicate ${asset.name}: ${result?.error ?? response?.statusText ?? "no answer"}`);
    if (asset.kind === "stamps") {
      const info = await fetch(`${ASSET_URL}-info?${assetQuery(asset)}`, { cache: "no-cache" }).then((reply) => reply.json() as Promise<AssetInfo>).catch(() => null);
      if (info && (info.tileColors.length || asset.tags?.length)) await postStampMeta(result.file, { slots: info.slots, tileColors: info.tileColors, tags: asset.tags ?? [] }, null);
      if (asset.autotile) await fetch(`./__cartographer/stamp-autotile?${new URLSearchParams({ file: result.file })}`, { method: "POST", body: JSON.stringify({ autotile: asset.autotile }) }).catch(() => null);
    }
    await loadProject();
    const made = projectRef.current?.assets.find((item) => item.kind === asset.kind && item.file === result.file);
    if (made) await openAsset(made);
    say(`Duplicated ${asset.name} as ${result.file}${asset.kind !== "stamps" && hasSlots(asset.kind) ? " (GB Studio adds its settings; the tile palettes stay with the original)" : ""}.`);
  }

  /**
   * Rename… (the author, 2026-10-12): a picture GB Studio hasn't taken in yet (no .gbsres, so nothing in GB Studio
   * refers to it) or a stamp gets a new file name; its open tab, Map Room screens, hidden / pinned and kept unsaved
   * changes follow (the server moves them). Once GB Studio has read it, renaming belongs in GB Studio.
   */
  async function renameAsset(asset: Asset) {
    if (!asset.renamable) return say(`${asset.name} is already in GB Studio (it has a .gbsres file): rename it in GB Studio, so its scenes keep finding it.`);
    const base = asset.file.replace(/\.png$/i, "");
    const name = await askText({ title: `Rename ${asset.name}`, label: "Name", initial: base, confirm: "Rename", hint: asset.kind === "stamps" ? "Stamps are GB Cartographer's own: GB Studio never reads them." : "GB Studio hasn't taken this picture in yet, so nothing refers to it: renaming is safe until it does." });
    if (!name || name.trim().replace(/\.png$/i, "") === base) return;
    const response = await fetch(`./__cartographer/gbstudio-asset-rename?${assetQuery(asset)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    const result = response ? await response.json().catch(() => null) as { ok?: boolean; error?: string; file?: string } | null : null;
    if (!response?.ok || !result?.ok || !result.file) return say(`Could not rename ${asset.name}: ${result?.error ?? response?.statusText ?? "no answer"}`);
    const file = result.file, here = projectRef.current?.path;
    for (const item of docs.current.filter((entry) => entry.asset?.kind === asset.kind && entry.asset.file === asset.file && (!entry.asset.project || entry.asset.project === here))) {
      item.asset!.file = file;
      item.asset!.name = item.name = file.replace(/\.png$/i, "");
    }
    await loadProject();
    bump();
    say(`Renamed ${asset.name} to ${file}.`);
  }

  /** Rename… on a tab: a project picture as above; a picture that isn't a project file only changes its tab's name. */
  async function renameTab(target: Doc) {
    if (target.asset) {
      const listed = projectRef.current?.assets.find((item) => item.kind === target.asset!.kind && item.file === target.asset!.file);
      return listed ? renameAsset(listed) : say(`${target.name} isn't in the open project.`);
    }
    const name = await askText({ title: `Rename ${target.name}`, label: "Name", initial: target.name.replace(/\.png$/i, ""), confirm: "Rename", hint: "Only this tab's name: the picture isn't a project file yet, so Save asks where it goes." });
    if (!name?.trim()) return;
    target.name = `${name.trim().replace(/\.png$/i, "")}.png`;
    bump();
  }

  /** A stamp onto (or off) the Repeat tiles shelf: its "pattern" tag, in its own sidecar (slots and tile palettes kept). */
  async function setRepeatTile(asset: Asset, on: boolean) {
    const info = await fetch(`${ASSET_URL}-info?${assetQuery(asset)}`, { cache: "no-cache" }).then((reply) => reply.json() as Promise<AssetInfo>).catch(() => null);
    if (!info) return say(`Could not read ${asset.name}.`);
    const tags = [...(asset.tags ?? []).filter((tag) => tag !== PATTERN_TAG), ...(on ? [PATTERN_TAG] : [])];
    await postStampMeta(asset.file, { slots: info.slots, tileColors: info.tileColors, tags }, info.metaMtime, true);
    await loadProject();
    say(on ? `${asset.name} is a repeat tile now: it opens with the seamless view on.` : `${asset.name} is an object again.`);
  }

  async function askDelete(asset: Asset) {
    const check = await fetch(`./__cartographer/gbstudio-asset-delete?${assetQuery(asset)}`, { cache: "no-cache" }).then((response) => response.json() as Promise<{ ok?: boolean; files?: string[]; uses?: string[]; error?: string }>).catch(() => null);
    if (!check?.ok) return say(`Could not check ${asset.name}: ${check?.error ?? "no answer"}`);
    setDeleting({ asset, files: check.files ?? [], uses: check.uses ?? [], busy: false });
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { asset } = deleting;
    setDeleting({ ...deleting, busy: true });
    const response = await fetch(`./__cartographer/gbstudio-asset-delete?${assetQuery(asset)}`, { method: "POST" }).catch(() => null);
    const result = response ? await response.json().catch(() => null) as { ok?: boolean; error?: string; files?: string[] } | null : null;
    setDeleting(null);
    if (!response?.ok || !result?.ok) return say(`Could not delete ${asset.name}: ${result?.error ?? response?.statusText ?? "no answer"}`);
    // Its tab closes (the file is gone; Backups can bring it back).
    const here = projectRef.current?.path;
    for (const item of docs.current.filter((entry) => entry.asset?.kind === asset.kind && entry.asset.file === asset.file && (!entry.asset.project || entry.asset.project === here))) dropDoc(item);
    await loadProject();
    say(`Deleted ${asset.name}: ${result.files?.length === 1 ? "its file is" : `${result.files?.length ?? 0} files are`} in the backups. Backups… puts ${result.files?.length === 1 ? "it" : "them"} back… up.`);
  }

  /** Closes a tab; one with unsaved changes asks first (Unsaved changes: save, discard or cancel). */
  function closeDoc(target: Doc) {
    if (target.dirty) { setClosing({ changes: closingChanges([target]), busy: false, tabs: [target] }); return; }
    dropDoc(target);
  }

  /** Closes several tabs (Close all, Close others): saved ones close now, unsaved ones are asked about together. */
  function closeDocs(targets: Doc[]) {
    const dirty = targets.filter((item) => item.dirty);
    dropDocs(targets.filter((item) => !item.dirty));
    if (dirty.length) setClosing({ changes: closingChanges(dirty), busy: false, tabs: dirty });
  }

  const dropDoc = (target: Doc) => dropDocs([target]);

  function dropDocs(targets: Doc[]) {
    if (!targets.length) return;
    const index = docs.current.findIndex((item) => item.id === activeId);
    docs.current = docs.current.filter((item) => !targets.includes(item));
    if (!docs.current.some((item) => item.id === activeId)) setActiveId(docs.current[Math.min(Math.max(index, 0), docs.current.length - 1)]?.id ?? 0);
    scheduleSession();
    bump();
  }

  /** Recolors the picked palette in this picture only (the library keeps its own colors). */
  function recolorPalette(colors: readonly string[]) {
    if (!doc || !picked) return;
    // One undo step per burst of changes (a color well sends many while dragging).
    if (Date.now() - lastRecolor.current > 1200) { dropFloat(doc); pushUndo(doc); }
    lastRecolor.current = Date.now();
    picked.colors = colors.map((color) => color.toUpperCase());
    touch(doc);
  }

  const libraryColors = picked ? palettes.find((palette) => (picked.id ? palette.id === picked.id : palette.name === picked.name))?.colors : undefined;
  const normalizeHex = (color: string) => /^#[0-9a-f]{6}$/i.test(color) ? color : "#000000";

  /** A shade square's color: the picked palette's color at that position, or the tint's (which becomes Custom). */
  function changeShadeColor(index: number, color: string) {
    if (picked) return recolorPalette(picked.colors.map((old, at) => at === index ? color : old));
    const next = tintColors.map((old, at) => at === index ? color : old);
    setCustomTint(next);
    setTint("Custom");
  }

  // ---- zoom --------------------------------------------------------------------------------------------------------

  /** The biggest zoom step at which the whole picture fits the stage. */
  function fitView() {
    if (!doc) return;
    // A repeat tile fits with its copies around it (3 × 3).
    const next = repeatTile ? fitZoom(doc.width * 3, doc.height * 3) : fitZoom(doc.width, doc.height);
    flushSync(() => { doc.zoom = next; bump(); });
    say(`Zoom ${next * 100}%: the whole picture fits.`);
  }

  function zoomBy(direction: 1 | -1): number | null {
    if (!doc) return null;
    const next = nextStep(ZOOMS, doc.zoom, direction);
    flushSync(() => { doc.zoom = next; bump(); });
    return next;
  }

  // ---- keys --------------------------------------------------------------------------------------------------------

  function keyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.matches?.("input, select, textarea") || target.isContentEditable || target.closest?.('[role="dialog"]')) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    // Tabs: Ctrl+Tab / Ctrl+PageDown next, with Shift / PageUp previous; Alt+W (and Ctrl+W in the desktop app) closes.
    if (event.ctrlKey && (key === "Tab" || key === "PageDown" || key === "PageUp")) {
      event.preventDefault();
      return switchTab(key === "PageUp" || (key === "Tab" && event.shiftKey) ? -1 : 1);
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyW") {
      event.preventDefault();
      if (doc) closeDoc(doc);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      // Photoshop's shortcuts where they fit (the author, 2026-10-13): Ctrl+I invert, Ctrl+D deselect, Ctrl+T turn
      // (Free Transform's nearest), Ctrl+' grid, Ctrl+Alt+C canvas size, Ctrl+N new.
      const code = event.code;
      const action = key === "o" ? pickFiles
        : code === "KeyC" && event.altKey ? () => { if (doc) setShowResize(true); }
        : code === "KeyI" && !event.shiftKey ? invertSelection
        : code === "KeyD" ? () => { if (!doc) return; const floating = Boolean(doc.float); dropFloat(doc); doc.sel = null; if (floating) touch(doc); else bump(); }
        : code === "KeyT" ? () => { if (doc?.sel || doc?.float) transformSelection("turn"); }
        : code === "Quote" ? () => setGrid(grid === 0 ? 8 : 0)
        : code === "KeyN" ? () => setShowNew(true)
        : key === "s" || key === "e" ? () => void save(event.shiftKey || key === "e")
        : key === "z" ? () => stepHistory(event.shiftKey ? "redo" : "undo")
        : key === "y" ? () => stepHistory("redo")
        : key === "c" ? copySelection
        : key === "x" ? () => { if (copySelection()) clearSelection(); }
        : key === "a" ? () => { if (doc) { dropFloat(doc); doc.sel = { x: 0, y: 0, w: doc.width, h: doc.height }; setToolState("select"); bump(); } }
        : key === "=" || key === "+" ? () => zoomBy(1)
        : key === "-" ? () => zoomBy(-1)
        : key === "0" ? fitView
        : null;
      if (!action) return;
      event.preventDefault();
      void action();
      return;
    }
    if (event.altKey) return;
    if (key === " ") {
      spaceDown.current = true;
      event.preventDefault();
      return;
    }
    // D: the Pattern fill tool; pressed again with it in hand, the next pattern.
    if (key === "d" && !event.shiftKey && (tool === "patternFill" || tool === "patternRect")) return cyclePattern();
    const found = TOOLS.find(([, , , keys]) => keys.toLowerCase() === `${event.shiftKey ? "shift+" : ""}${key}`);
    if (found) return setTool(found[0]);
    // U: the shape tools in turn, as Photoshop's shape group (line, rectangle, filled rectangle, ellipse).
    if (key === "u" && !event.shiftKey) { const shapes = ["line", "rect", "rectFill", "ellipse"] as const; const at = shapes.indexOf(tool as typeof shapes[number]); return setTool(shapes[(at + 1) % shapes.length]); }
    if (event.shiftKey && key === "m") return setMirror(MIRRORS[(MIRRORS.indexOf(mirror) + 1) % MIRRORS.length]);
    if (key === "`" || key === "~") {
      // Focus: both side panels hide (or come back) at once.
      const show = !(showProject || showSide);
      setShowProject(show); setShowSide(show); store("gbc-side", show);
      return say(show ? "Panels back" : "Panels hidden: ` brings them back");
    }
        if (key === "k") { setLinked(!linked); return say(linked ? "Linked tiles off" : "Linked tiles on: painting a tile paints its identical copies too"); }
    if (key === "f") return transformSelection(event.shiftKey ? "y" : "x");
    if (key >= "1" && key <= "4") return setShade(Number(key) - 1);
    if (key === "0" && doc && (doc.hasAlpha || canSeeThrough(doc))) { if (!doc.hasAlpha) { doc.hasAlpha = true; touch(doc); } return setShade(CLEAR); }
    if (key === "[") return tool === "palette" || tool === "priority" ? setCellBrush(Math.max(1, cellBrush - 1)) : setBrush(Math.max(1, brush - 1));
    if (key === "]") return tool === "palette" || tool === "priority" ? setCellBrush(Math.min(3, cellBrush + 1)) : setBrush(Math.min(16, brush + 1));
    if (!doc) return;
    if (key === "Escape") {
      // Only a floating piece landing changes the picture; dropping a plain selection doesn't make it unsaved.
      const floating = Boolean(doc.float);
      dropFloat(doc);
      doc.sel = null;
      return floating ? touch(doc) : bump();
    }
    if (key === "Delete" || key === "Backspace") return clearSelection();
    const arrow = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[key];
    if (arrow && doc.sel) {
      event.preventDefault();
      const floating = floatSelection(doc, false);
      const step = event.shiftKey || snap ? CELL : 1;
      if (floating) moveFloat(doc, floating.x + arrow[0] * step, floating.y + arrow[1] * step);
      touch(doc);
    }
  }

  // Listeners registered once call the handlers of the latest render.
  /** What closing would leave unsaved: project files Save would write (pictures, edited palettes) and other pictures. */
  /** A small picture of an open picture as it is now (unsaved edits too), for the Unsaved changes list. */
  function thumbOf(item: Doc): string | undefined {
    try {
      const canvas = Object.assign(document.createElement("canvas"), { width: item.width, height: item.height });
      canvas.getContext("2d")!.putImageData(new ImageData(toRgba(item.pixels, item.cells, item.width, item.palettes), item.width, item.height), 0, 0);
      return canvas.toDataURL("image/png");
    } catch { return undefined; }
  }

  function closingChanges(only?: Doc[]): ClosingChanges {
    const here = projectRef.current?.path;
    const dirty = (only ?? docs.current).filter((item) => item.dirty);
    const inProject = (item: Doc) => Boolean(item.asset && (!item.asset.project || item.asset.project === here));
    const where = (kind: AssetKind, file: string) => kind === "stamps" ? `Cartographer/stamps/${file}` : `assets/${kind}/${file}`;
    return {
      project: [
        ...dirty.filter(inProject).map((item) => ({ path: where(item.asset!.kind, item.asset!.file), detail: hasSlots(item.asset!.kind) ? "picture and tile palettes" : "picture", thumb: thumbOf(item) })),
        ...(projectRef.current && !only ? editedProjectPalettes() : []).map((palette) => ({ path: `project/palettes: ${palette.name}`, detail: "palette colors", palette: true })),
      ],
      loose: dirty.filter((item) => !inProject(item)).map((item) => ({ name: item.name, thumb: thumbOf(item) })),
    };
  }

  /** The desktop window wants to close: straight away when nothing is unsaved, else Unsaved changes asks first. */
  async function requestClose(): Promise<"close" | "ask"> {
    if (doc) dropFloat(doc);
    await writeSession();
    const changes = closingChanges();
    if (!changes.project.length && !changes.loose.length) return "close";
    setClosing({ changes, busy: false });
    return "ask";
  }

  async function finishClose() {
    await writeSession();
    // The drafts too, before the window goes (2026-10-14: a discarded draft could come back on the next launch):
    // wait out a sync already running, then sync once more with what is open now.
    for (let waited = 0; unsavedBusy.current && waited < 5000; waited += 50) await new Promise((resolve) => window.setTimeout(resolve, 50));
    await syncUnsaved();
    setClosing(null);
    (window as PickerWindow).gbc?.closeWindow?.();
  }

  /** Save to GB Studio Project: every unsaved project picture and edited palette, then close (stays open if any failed). */
  async function saveAndClose() {
    const tabs = closing?.tabs;
    const tab = tabs?.length === 1 ? tabs[0] : undefined;
    setClosing((now) => now && { ...now, busy: true });
    if (tabs && !tab) {
      // Several tabs: project pictures save into the project and close; others (and any that failed) stay open.
      const here = projectRef.current?.path;
      for (const item of tabs.filter((entry) => entry.asset && (!entry.asset.project || entry.asset.project === here))) await saveDoc(item, false, false);
      const left = tabs.filter((item) => item.dirty);
      setClosing(null);
      dropDocs(tabs.filter((item) => !item.dirty));
      if (left.length) say(`${left.length === 1 ? `${left[0].name} stays` : `${left.length} pictures stay`} open: not saved into the project (pictures from outside it save with Save as…).`);
      return;
    }
    if (tab) {
      // One tab: a project picture saves into the project; any other picture asks where (or downloads).
      const here = projectRef.current?.path;
      await saveDoc(tab, false, !(tab.asset && (!tab.asset.project || tab.asset.project === here)));
      if (tab.dirty) { setClosing({ changes: closingChanges([tab]), busy: false, tabs: [tab] }); return; }
      setClosing(null);
      dropDoc(tab);
      return;
    }
    const here = projectRef.current?.path;
    for (const item of docs.current.filter((entry) => entry.dirty && entry.asset && (!entry.asset.project || entry.asset.project === here))) await saveDoc(item, false, false);
    const edited = projectRef.current ? editedProjectPalettes() : [];
    if (edited.length && await okToWriteProjectJson()) for (const palette of edited) await writeProjectPalette(palette);
    bump();
    const left = closingChanges();
    if (left.project.length) { say("Some files weren't saved: they're still listed."); setClosing({ changes: left, busy: false }); return; }
    await finishClose();
  }

  /** Discard changes: unsaved pictures close without saving (project files stay as they are on disk). */
  async function discardAndClose() {
    const tabs = closing?.tabs;
    if (tabs) { setClosing(null); dropDocs(tabs); return; }
    docs.current = docs.current.filter((item) => !item.dirty);
    if (!docs.current.some((item) => item.id === activeId)) setActiveId(docs.current[0]?.id ?? 0);
    await finishClose();
  }

  const latest = useRef({ keyDown, zoomBy, openFiles, pasteClip, writeSession, checkDisk, requestClose, zoom: doc?.zoom ?? 1 });
  latest.current = { keyDown, zoomBy, openFiles, pasteClip, writeSession, checkDisk, requestClose, zoom: doc?.zoom ?? 1 };
  // The desktop app's File menu: Close Tab (Ctrl/Cmd+W) closes the open picture, not the window.
  (window as PickerWindow & { __gbcCloseTab?: () => boolean }).__gbcCloseTab = () => { if (!doc) return false; closeDoc(doc); return true; };

  useEffect(() => {
    // The project's palettes come first: reading a picture needs them to recognise colored tiles.
    palettesReady.current = loadProject();
    let sessionDone = () => {};
    sessionLoaded.current = new Promise((resolve) => { sessionDone = resolve; });
    void palettesReady.current
      .then(() => sessionStore<{ active: number; docs: Omit<Doc, "id" | "undo" | "redo" | "sel" | "float">[] }>("readonly", (objects) => objects.get("open")))
      .finally(() => window.setTimeout(sessionDone, 0))
      .then((session) => {
        if (!session?.docs?.length) return;
        // Pictures opened before the session was read (a drop, a paste, a file the desktop app was asked to open)
        // stay, after the restored ones, and stay in front (2026-10-14: the whole session used to be skipped).
        const early = docs.current;
        const restored: Doc[] = [];
        for (const saved of session.docs) restored.push({ ...saved, hasAlpha: saved.hasAlpha || saved.asset?.kind === "stamps", palettes: saved.palettes ?? clonePalettes(palettesRef.current), id: newDocId([...restored, ...early]), undo: [], redo: [], sel: null, float: null });
        docs.current = [...restored, ...early];
        if (!early.length) setActiveId(restored[Math.max(0, session.active)]?.id ?? restored[0].id);
        void rereadSlots();
        // Backgrounds kept from before collisions were read: read their scenes' collisions now.
        for (const item of docs.current) if (item.asset?.kind === "backgrounds" && !item.collision && (!item.asset.project || item.asset.project === projectRef.current?.path)) void loadCollisions(item);
      });
    const onKeyDown = (event: KeyboardEvent) => latest.current.keyDown(event);
    const onKeyUp = (event: KeyboardEvent) => { if (event.key === " ") spaceDown.current = false; };
    const onPaste = (event: ClipboardEvent) => {
      const images = [...event.clipboardData?.files ?? []].filter((file) => file.type.startsWith("image/"));
      if (clip.current) latest.current.pasteClip();
      else if (images.length) void latest.current.openFiles(images.map((file) => ({ file })));
    };
    const onHide = () => void latest.current.writeSession();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("paste", onPaste);
    window.addEventListener("pagehide", onHide);
    // The desktop app waits for this before its window closes.
    (window as PickerWindow).__gbcFlushSession = () => latest.current.writeSession();
    (window as PickerWindow).__gbcRequestClose = () => latest.current.requestClose();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  const sceneOpen = Boolean(doc?.asset?.slots?.length);
  useEffect(() => { if (wizardAfterOpen && sceneOpen) { setWizard(wizardAfterOpen); setWizardAfterOpen(null); } }, [wizardAfterOpen, sceneOpen]);

  // No project and nothing open: the start screen shows on its own, like a splash window (see the render).
  // Like GB Studio, a launch starts on the start screen (pick a project, or open pictures), even when the last session
  // left pictures open (the author, 2026-10-12); a reload with a project open goes straight back to it.
  const splash = served && !project && !startDone;
  // Wheel and trackpad zoom (pinch) and middle-button pan, on the picture area. It only exists outside the splash,
  // so the handlers attach again whenever the splash comes or goes.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const detachWheel = attachWheelZoom(scroller, () => latest.current.zoom, (direction) => latest.current.zoomBy(direction), () => wrapRef.current);
    const detachPan = attachMiddlePan(scroller);
    return () => { detachWheel(); detachPan(); };
  }, [splash]);

  useEffect(() => { document.title = doc ? `${doc.name}${doc.dirty ? " *" : ""} · GB Cartographer` : "GB Cartographer"; });
  useEffect(() => { store(TINT_KEY, tint); store(CUSTOM_TINT_KEY, customTint); store(GRID_KEY, grid); store(BUDGET_KEY, budgetId); store(PROJECT_PANEL_KEY, showProject); store(PROJECT_KIND_KEY, projectKind); }, [tint, customTint, grid, budgetId, showProject, projectKind]);

  const budget = BUDGETS.find((item) => item.id === budgetId) ?? BUDGETS[0];
  // The tile count trails painting by a moment, so a big picture is not recounted on every pointer move.
  useEffect(() => {
    if (!doc) return;
    const timer = window.setTimeout(() => {
      let pixels = doc.pixels;
      if (doc.float) {
        pixels = pixels.slice();
        drop(pixels, doc.width, doc.height, doc.float);
      }
      setTileCount(countUniqueTiles(pixels, doc.width, doc.height, budget.flips));
    }, 150);
    return () => window.clearTimeout(timer);
  });

  // The budget view's numbers trail painting by a moment too (finding near matches compares every pair of tiles).
  const usageKey = doc ? `${doc.id}|${editCount.current}|${doc.width}x${doc.height}|${budget.flips}|${doc.float ? "float" : ""}` : "";
  useEffect(() => {
    if (!doc || (!budgetView && sideTab !== "picture") || usage?.key === usageKey) return;
    const timer = window.setTimeout(() => {
      let pixels = doc.pixels;
      if (doc.float) { pixels = pixels.slice(); drop(pixels, doc.width, doc.height, doc.float); }
      setUsage({ key: usageKey, usage: tileUsage(pixels, doc.width, doc.height, budget.flips) });
    }, 300);
    return () => window.clearTimeout(timer);
  });
  const shownUsage = usage && usage.key === usageKey ? usage.usage : null;
  const usedOnce = shownUsage ? shownUsage.uses.reduce((count, value) => count + (value === 1 ? 1 : 0), 0) : 0;
  const nearCount = shownUsage ? shownUsage.near.reduce((count, value) => count + (value >= 0 ? 1 : 0), 0) : 0;
  // The overlay: red tiles are used only once, amber ones nearly match another tile (merge candidates).
  useLayoutEffect(() => {
    const canvas = usageCanvas.current;
    if (!canvas || !doc || !shownUsage) return;
    // Drawn at the picture's own size, so each marked tile gets an outline and stripes as well as a tint: on red or
    // amber art a tint alone disappears.
    const cw = Math.ceil(doc.width / CELL), ch = Math.ceil(doc.height / CELL);
    Object.assign(canvas, { width: cw * CELL, height: ch * CELL });
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    shownUsage.uses.forEach((value, cell) => {
      if (value > 1) return;
      const near = shownUsage.near[cell] >= 0, x = (cell % cw) * CELL, y = Math.floor(cell / cw) * CELL;
      context.fillStyle = near ? "rgba(255, 190, 40, .35)" : "rgba(235, 60, 60, .3)";
      context.fillRect(x, y, CELL, CELL);
      context.fillStyle = near ? "rgba(255, 210, 60, .95)" : "rgba(255, 70, 70, .95)";
      for (let at = 0; at < CELL; at += 4) for (let step = 0; step < CELL - at; step += 1) context.fillRect(x + at + step, y + step, 1, 1);
      context.strokeStyle = "rgba(10, 10, 20, .9)";
      context.lineWidth = 1;
      context.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
    });
  });

  // Seamless view: what repeats, drawn from the canvas as shown (palettes and screen look included).
  /** The open picture is a repeat tile (a stamp tagged "pattern"): drawn among its copies. */
  const repeatTile = Boolean(doc?.asset?.kind === "stamps" && project?.assets.find((item) => item.kind === "stamps" && item.file === doc.asset!.file)?.tags?.includes(PATTERN_TAG));
  const seamlessArea = doc && seamless ? (doc.sel && doc.sel.w > 0 && doc.sel.h > 0 ? doc.sel : hoverCell ? { x: hoverCell.x * CELL, y: hoverCell.y * CELL, w: Math.min(CELL, doc.width - hoverCell.x * CELL), h: Math.min(CELL, doc.height - hoverCell.y * CELL) } : null) : null;

  // GB Studio's collisions over the picture, as GB Studio draws them: each tile's collision icons in their colors (half
  // see-through, like its collision layer); a value no collision tile explains gets a dotted outline (GB Studio writes
  // its hex there).
  useLayoutEffect(() => {
    const canvas = collisionCanvas.current, scene = doc?.collision?.scenes[doc.collision.scene];
    if (!canvas || !doc || !scene) return;
    const cw = cellsWide(doc.width), ch = Math.ceil(doc.height / CELL);
    Object.assign(canvas, { width: cw * CELL, height: ch * CELL });
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const defs = collisionDefs(doc);
    const looks = new Map<number, ReturnType<typeof collisionLook>>();
    scene.values.forEach((value, cell) => {
      if (!value || cell >= cw * ch) return;
      const look = looks.get(value) ?? collisionLook(value, defs);
      looks.set(value, look);
      const x = (cell % cw) * CELL, y = Math.floor(cell / cw) * CELL;
      for (const def of look.shown) {
        context.fillStyle = def.color.slice(0, 7);
        iconPixels(def.icon).forEach((on, at) => { if (on) context.fillRect(x + (at % 8), y + Math.floor(at / 8), 1, 1); });
      }
      if (look.unknown) {
        context.fillStyle = "#ffffff";
        for (let at = 0; at < CELL; at += 2) { context.fillRect(x + at, y, 1, 1); context.fillRect(x + at, y + CELL - 1, 1, 1); context.fillRect(x, y + at, 1, 1); context.fillRect(x + CELL - 1, y + at, 1, 1); }
      }
    });
  });

  // An animated stamp in hand (RPG Maker water, or an animated tile): every tile of the picture that is one of frame
  // 1's tiles shows the other frames in turn over it, ANIM_FRAME_MS each (the author: much slower); frame 1 shows the
  // picture itself. Nothing is written: Save keeps frame 1.
  const held = tool === "stamp" ? stampInHand() : null;
  const atlasHeld = held?.auto === "atlasAnim" || held?.auto === "xpAnim" || (held?.auto === "anim" && held.animSheet) ? held : null;
  useEffect(() => { setAtlasPlaying(Boolean(atlasHeld && doc && !animStopped)); }, [atlasHeld, doc, animStopped]);
  useEffect(() => {
    const canvas = atlasAnimCanvas.current;
    if (!atlasPlaying || !atlasHeld || !doc || !canvas) return;
    const source = atlasHeld.animSheet ?? atlasHeld, frameWidth = atlasHeld.auto === "atlasAnim" ? ATLAS_W : atlasHeld.auto === "xpAnim" ? 48 : source.h;
    const frameColumns = frameWidth / CELL, frameCount = Math.max(1, Math.floor(source.w / frameWidth));
    // The block in the picture's colors, once.
    const sheet = document.createElement("canvas");
    Object.assign(sheet, { width: source.w, height: source.h });
    sheet.getContext("2d")!.putImageData(new ImageData(toRgba(source.pixels, source.cells ?? new Uint8Array(cellsWide(source.w) * Math.ceil(source.h / CELL)), source.w, atlasHeld.palettes), source.w, source.h), 0, 0);
    const key = (pixels: Uint8Array, width: number, x: number, y: number) => { let out = ""; for (let row = 0; row < CELL; row += 1) out += pixels.subarray((y + row) * width + x, (y + row) * width + x + CELL).join(",") + ";"; return out; };
    // See-through pixels land as the picture's blank, so the sheet's tiles are matched that way (a tile that is all blank never counts).
    const blankShade = blank(doc), flat = source.pixels.map((shade) => shade === CLEAR ? blankShade : shade), empty = key(new Uint8Array(CELL * CELL).fill(blankShade), CELL, 0, 0);
    const minitiles = new Map<string, [number, number]>();
    for (let row = 0; row < source.h / CELL; row += 1) for (let column = 0; column < frameColumns; column += 1) { const k = key(flat, source.w, column * CELL, row * CELL); if (!minitiles.has(k) && k !== empty) minitiles.set(k, [column, row]); }
    const cw = cellsWide(doc.width), ch = Math.ceil(doc.height / CELL);
    Object.assign(canvas, { width: cw * CELL, height: ch * CELL });
    const context = canvas.getContext("2d")!;
    let frame = 0;
    const draw = () => {
      frame = (frame + 1) % frameCount;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!frame) return;
      for (let ty = 0; ty < ch; ty += 1) for (let tx = 0; tx < cw; tx += 1) {
        const at = minitiles.get(key(doc.pixels, doc.width, tx * CELL, ty * CELL));
        if (at) context.drawImage(sheet, (at[0] + frame * frameColumns) * CELL, at[1] * CELL, CELL, CELL, tx * CELL, ty * CELL, CELL, CELL);
      }
    };
    const timer = window.setInterval(draw, ANIM_FRAME_MS);
    return () => { window.clearInterval(timer); context.clearRect(0, 0, canvas.width, canvas.height); };
  }, [atlasPlaying, atlasHeld, doc]);

  // The priority brush's overlay: tiles that draw over sprites, tinted blue with stripes the other way from the
  // budget view's and an outline, so they can't be taken for blue art (water, glass).
  useLayoutEffect(() => {
    const canvas = priorityCanvas.current;
    if (!canvas || !doc?.priority) return;
    const cw = cellsWide(doc.width), ch = Math.ceil(doc.height / CELL);
    Object.assign(canvas, { width: cw * CELL, height: ch * CELL });
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    doc.priority.forEach((on, cell) => {
      if (!on) return;
      const x = (cell % cw) * CELL, y = Math.floor(cell / cw) * CELL;
      context.fillStyle = "rgba(90, 170, 255, .3)";
      context.fillRect(x, y, CELL, CELL);
      context.fillStyle = "rgba(140, 200, 255, .95)";
      for (let at = 0; at < CELL; at += 4) for (let step = 0; step < CELL - at; step += 1) context.fillRect(x + CELL - 1 - at - step, y + step, 1, 1);
      context.strokeStyle = "rgba(10, 30, 70, .9)";
      context.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
    });
  });

  /**
   * Applies a palette fit: the picture takes its shades, tile palettes and palettes (undoable). With `intoProject`,
   * the palettes are first added to the project and then put in the picture's slots (1 onwards), so Save writes the
   * tiles' slots too.
   */
  async function applyFit(fit: { palettes: string[][]; cells: Uint8Array; pixels: Uint8Array; report: { after: number } }, intoProject: boolean) {
    const target = doc;
    if (!target) return;
    const base = target.name.replace(/\.png$/i, "");
    const ids: (string | null)[] = [];
    if (intoProject) {
      if (!await okToWriteProjectJson()) return;
      for (const [index, colors] of fit.palettes.entries()) ids.push(await writeProjectPalette({ name: `${base} ${index + 1}`, colors }));
      if (ids.some((id) => !id)) return say("Not every palette could be added to the project; nothing else changed.");
    }
    dropFloat(target);
    pushUndo(target);
    // Each fitted palette in the picture's own list (a project palette by id, else added as a palette of the file).
    const slots = fit.palettes.map((colors, index) => {
      const id = ids[index];
      let at = id ? target.palettes.findIndex((palette) => palette.id === id) : -1;
      if (at < 0) at = target.palettes.push({ name: `${base} ${index + 1}`, colors: [...colors], ...(id ? { id } : {}) }) - 1;
      return at + 1;
    });
    target.pixels = fit.pixels.slice();
    target.cells = Uint8Array.from(fit.cells, (wear) => wear ? slots[wear - 1] : 0);
    if (intoProject && target.asset) {
      for (const [slot, id] of ids.entries()) {
        await fetch(`./__cartographer/gbstudio-palette-slot?${assetQuery(target.asset)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, paletteId: id }) }).catch(() => null);
      }
      await rereadSlots();
      setSlotsVersion((value) => value + 1);
    }
    touch(target);
    say(intoProject ? `${fit.report.after} palettes added to the project and put in slots 1–${fit.report.after}. Save writes the picture and its tiles' slots.` : `Fitted to ${fit.report.after} palettes. Undo brings the old colors back.`);
  }

  async function mergeNear() {
    if (!doc || !shownUsage || !nearCount) return;
    if (!await confirmBox(`Make ${nearCount} tile${nearCount === 1 ? "" : "s"} that differ from another tile in at most 3 pixels into copies of it? This saves ${nearCount} tile${nearCount === 1 ? "" : "s"} of the budget; undo brings them back.`, { yes: "Merge them" })) return;
    dropFloat(doc);
    pushUndo(doc);
    const merged = mergeNearTiles(doc.pixels, doc.width, doc.height, shownUsage);
    touch(doc);
    say(`Merged ${merged} near-duplicate tile${merged === 1 ? "" : "s"}.`);
  }

  const animations = doc?.asset?.animations ?? [];
  const animation = animations[Math.min(frame.animation, Math.max(0, animations.length - 1))];
  const frames = animation?.frames ?? [];
  const current = frames[Math.min(frame.index, Math.max(0, frames.length - 1))];
  useEffect(() => { setFrame({ animation: 0, index: 0 }); setPlaying(false); }, [activeId]);
  useEffect(() => { void rereadSlots(); }, [project]);
  // Watch the open pictures' files: every 4 seconds while the window is visible, and when it comes back to front.
  useEffect(() => {
    const check = () => { if (document.visibilityState === "visible") void latest.current.checkDisk(); };
    const timer = window.setInterval(check, 4000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, []);
  // Frames play at the sheet's GB Studio speed (60 / (animSpeed + 1) frames a second), else 8 a second.
  const animSpeed = doc?.asset?.animSpeed;
  const fps = animSpeed == null || animSpeed === 255 ? 8 : 60 / (animSpeed + 1);
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => setFrame((at) => ({ ...at, index: (at.index + 1) % frames.length })), 1000 / fps);
    return () => window.clearInterval(timer);
  }, [playing, frames.length, fps]);
  // Frame thumbnails: each frame's slices copied from the drawn sheet, after the sheet itself is drawn.
  useLayoutEffect(() => {
    const sheet = canvasRef.current;
    if (!sheet || !frames.length) return;
    frames.forEach((item, index) => {
      const canvas = frameCanvases.current[index];
      if (!canvas) return;
      const width = Math.max(16, ...item.tiles.map((tile) => tile.x + 8)), height = Math.max(16, ...item.tiles.map((tile) => tile.y + 16));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const context = canvas.getContext("2d")!;
      context.clearRect(0, 0, width, height);
      for (const tile of item.tiles) {
        context.save();
        context.translate(tile.x + (tile.flipX ? 8 : 0), tile.y + (tile.flipY ? 16 : 0));
        context.scale(tile.flipX ? -1 : 1, tile.flipY ? -1 : 1);
        context.drawImage(sheet, tile.sliceX, tile.sliceY, 8, 16, 0, 0, 8, 16);
        context.restore();
      }
    });
  });

  const isFont = doc?.asset?.kind === "fonts" || (doc?.width === 128 && doc?.height === 112 && !doc.asset);
  // The picture is redrawn after every render: the pixels change in place, and `bump` is what announces it.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    if (canvas.width !== doc.width || canvas.height !== doc.height) Object.assign(canvas, { width: doc.width, height: doc.height });
    let pixels = doc.pixels, cells = doc.cells;
    if (doc.float) {
      pixels = pixels.slice();
      drop(pixels, doc.width, doc.height, doc.float);
      // A floating piece on tile edges shows in its own tile palettes.
      if (doc.float.cells) {
        cells = cells.slice();
        dropCells(cells, doc.width, doc.height, doc.float);
      }
    }
    // The draft layer: the picture canvas shows the old picture where the draft drew, the draft canvas the new pixels.
    const base = draftOf(doc), drafted = base ? pixels : null;
    if (base && drafted) pixels = base.pixels;
    const paint = (from: Uint8Array, image: ImageData) => {
      // A mono screen shows only the shades (GB Studio's monochrome mode ignores palettes); a GBC screen dims and mixes colors.
      if (look === "dmg" || look === "pocket") colorize(from, cells, doc.width, [shadeLut(LOOK_SHADES[look])], new Uint32Array(image.data.buffer));
      else colorize(from, cells, doc.width, luts, new Uint32Array(image.data.buffer));
      if (look === "gbc") gbcCorrect(image.data);
      return image;
    };
    canvas.getContext("2d")!.putImageData(paint(pixels, new ImageData(doc.width, doc.height)), 0, 0);
    const layer = draftCanvas.current;
    if (!layer || !base || !drafted) return;
    if (layer.width !== doc.width || layer.height !== doc.height) Object.assign(layer, { width: doc.width, height: doc.height });
    const image = paint(drafted, new ImageData(doc.width, doc.height));
    // Only what the draft changed (an erased pixel is see-through, so the old one still shows under it).
    const words = new Uint32Array(image.data.buffer);
    for (let at = 0; at < drafted.length; at += 1) if (drafted[at] === base.pixels[at]) words[at] = 0;
    layer.getContext("2d")!.putImageData(image, 0, 0);
  });
  // The font sample, at a Game Boy screen's width (160 px, 8 px margins), wrapped at word breaks like a text box:
  // each character's glyph copied from the sheet as just drawn. Which glyph a character draws and how wide it is
  // come from GB Studio's reading of the font (src/gb/font.ts): the project file with its .json map, or for a PNG
  // of its own, the sheet as drawn.
  const [sampleFont, setSampleFont] = useState<{ key: string; font: FontSheet } | null>(null);
  const sampleKey = doc && isFont && doc.asset?.kind === "fonts" && !foreignProject(doc) ? `${doc.asset.file}|${doc.asset.mtime}` : null;
  useEffect(() => {
    if (!sampleKey || !doc?.asset || sampleFont?.key === sampleKey) return;
    let live = true;
    void fontSheet(doc.asset.file).then((font) => { if (live && font) setSampleFont({ key: sampleKey, font }); });
    return () => { live = false; };
  }, [sampleKey]);
  useLayoutEffect(() => {
    const sheet = canvasRef.current, canvas = sampleCanvas.current;
    if (!sheet || !canvas || !doc || !isFont) return;
    const font = sampleFont && sampleFont.key === sampleKey ? sampleFont.font
      : readFontSheet(sheet.getContext("2d")!.getImageData(0, 0, Math.min(doc.width, sheet.width), Math.min(doc.height, sheet.height)).data, Math.min(doc.width, sheet.width), Math.min(doc.height, sheet.height));
    const SCREEN = 160, MARGIN = 8, ROOM = SCREEN - 2 * MARGIN;
    const lines: string[] = [];
    for (const paragraph of sampleText.split("\n")) {
      let line = "", used = 0;
      for (const word of paragraph.split(" ")) {
        const wordWidth = textWidth(font, word), space = line ? textWidth(font, " ") : 0;
        if (line && used + space + wordWidth > ROOM) { lines.push(line); line = ""; used = 0; }
        line += (line ? " " : "") + word;
        used += (line === word ? 0 : space) + wordWidth;
      }
      lines.push(line);
    }
    canvas.width = SCREEN;
    canvas.height = Math.max(1, lines.length) * 8 + 2 * MARGIN;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    lines.forEach((line, row) => {
      let pen = MARGIN;
      for (const code of encodeText(font, line)) {
        const glyph = glyphOf(font, code);
        if (!glyph) continue;
        if (glyph.width && pen + glyph.width <= SCREEN - MARGIN) context.drawImage(sheet, glyph.sx, glyph.sy, glyph.width, 8, pen, MARGIN + row * 8, glyph.width, 8);
        pen += glyph.width;
      }
    });
  });

  // A repeat tile opens (or becomes one) zoomed so its 3 × 3 fits.
  useEffect(() => { if (doc && repeatTile) { doc.zoom = fitZoom(doc.width * 3, doc.height * 3); bump(); } }, [doc?.id, repeatTile]); // eslint-disable-line react-hooks/exhaustive-deps

  // A repeat tile (a stamp tagged "pattern") is drawn among its copies: the picture repeated 3 × 3 behind it, kept up
  // to date as it is painted, so the seams show while drawing.
  useLayoutEffect(() => {
    const target = repeatCanvas.current, sheet = canvasRef.current;
    if (!target || !sheet || !doc) return;
    Object.assign(target, { width: doc.width * 3, height: doc.height * 3 });
    const context = target.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) context.drawImage(sheet, 0, 0, doc.width, doc.height, column * doc.width, row * doc.height, doc.width, doc.height);
  });

  // The seamless view copies the picture as just drawn, so it runs after the drawing above.
  useLayoutEffect(() => {
    const target = seamlessCanvas.current, sheet = canvasRef.current;
    if (!target || !sheet || !seamlessArea) return;
    const { x, y, w, h } = seamlessArea;
    Object.assign(target, { width: w * 3, height: h * 3 });
    const context = target.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, w * 3, h * 3);
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) context.drawImage(sheet, x, y, w, h, column * w, row * h, w, h);
  });

  async function onDrop(event: React.DragEvent) {
    event.preventDefault();
    // A drop on a window (the picture wizard takes its own) doesn't open the file behind it.
    if ((event.target as Element).closest?.("[role=dialog]")) return;
    // Handles must be asked for before the first await: the drop's items are gone after it.
    const items = [...event.dataTransfer.items].filter((item) => item.kind === "file").map((item) => ({
      file: item.getAsFile(),
      handle: (item as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileHandle | null> }).getAsFileSystemHandle?.().catch(() => null),
    }));
    const files: { file: File; handle?: FileHandle }[] = [];
    for (const { file, handle } of items) if (file) files.push({ file, handle: await handle ?? undefined });
    await openFiles(files);
  }

  const hint = TOOLS.find(([id]) => id === tool)!;
  const gridLines = doc && grid && grid * doc.zoom >= 3 ? `${grid * doc.zoom}px` : null;
  // A project background or sprite sheet carries its eight palette slots (the Palettes tab and the slot menu show them).
  const sceneSlots = doc?.asset?.slots ?? [];
  const slotPalettes = sceneSlots.map((id) => docPalettes.findIndex((palette) => palette.id === id));
  const slotWhere = doc?.asset?.slotScene ? `${doc.asset.slotScene}'s palettes` : doc?.asset?.kind === "sprites" ? "the project's default sprite palettes (every scene without its own)" : "the project's default background palettes (every scene without its own)";
  const pickPalette = (index: number) => { setActivePalette(index); if (index && tool !== "palette" && tool !== "paletteAll") setTool("palette"); };

  // No project and nothing open: the start screen on its own, like a splash window, with no tools behind it.
  if (splash) {
    return (
      <div className="gbp-shell gbp-splash" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void onDrop(event)}>
        <StartScreen recent={recent} onChooseProject={() => void chooseProject()} onDemo={hasDemo ? () => void chooseProject(true) : null} onOpenFiles={() => void pickFiles()} onOpenRecent={(path) => void openProjectPath(path)} onAbout={() => setShowAbout(true)} />
        <Toasts showing={messages.showing} onDismiss={messages.dismiss} />
        {showAbout && <AboutWindow onClose={() => setShowAbout(false)} />}
      </div>
    );
  }

  const otherRecent = recent.filter((item) => item.path !== project?.path);
  const projectItems: MenuEntry[] = [
    { label: "Open another project…", icon: <FolderOpen />, onSelect: () => void chooseProject() },
    ...(hasDemo ? [{ label: "Open the demo project", icon: <Gamepad2 />, onSelect: () => void chooseProject(true) }] : []),
    ...(project && /[\\/]demo-project$/.test(project.path) ? [{ label: "Reset the demo project…", icon: <RotateCcw />, title: "Your painted copy goes to the backups folder; a fresh copy of the demo opens", onSelect: () => void chooseProject(true, true) }] : []),
    ...(otherRecent.length ? [{ separator: true } as MenuEntry, { heading: <><Clock size={11} /> Recent</> } as MenuEntry, ...otherRecent.slice(0, 5).map((item) => ({ label: recent.filter((other) => other.name === item.name).length > 1 ? `${item.name} · ${item.path.split(/[\\/]/).slice(-2, -1)[0] ?? ""}` : item.name, indent: true, title: item.path, onSelect: () => void openProjectPath(item.path) }))] : []),
    ...(project ? [
      { separator: true } as MenuEntry,
      { label: "Picture to background…", icon: <ImagePlus />, title: "Any picture or photo, framed to screens and fitted to GB Studio's palettes and tile budget", onSelect: () => setShowPictureWizard(true) },
      { label: "Map Room…", icon: <MapIcon />, onSelect: () => setShowMapRoom(true) },
      { label: "Project health…", icon: <PxHeart size={15} />, onSelect: () => setShowHealth(true) },
      { label: "Dialogue box…", icon: <MessageSquare />, onSelect: () => setShowDialogue(true) },
      { label: "Backups…", icon: <History />, onSelect: () => setBackups({}) },
      { label: `Pictures from other projects…${foreignPictures().length ? ` (${foreignPictures().length})` : ""}`, icon: <Plane />, title: "Open tabs whose file belongs to another GB Studio project", onSelect: () => setShowForeign(true) },
      { separator: true } as MenuEntry,
      { label: FILE_MANAGER_LABEL, icon: <FolderSearch />, onSelect: () => void fetch("./__cartographer/reveal", { method: "POST" }) },
      { label: "Show backups folder", icon: <FolderArchive />, onSelect: () => void fetch("./__cartographer/reveal?backups=1", { method: "POST" }) },
      { separator: true } as MenuEntry,
      { label: "Close project", icon: <FolderX />, onSelect: () => void closeProject() },
    ] : []),
    { separator: true },
    { label: "About GB Cartographer", icon: <Info />, onSelect: () => setShowAbout(true) },
  ];
  // Three sizes (the author's pick, R17): the file's own size, and two scaled up for sharing.
  const EXPORT_SCALES = [[1, "Original"], [4, "4×"], [8, "8×"]] as const;
  const exportItems: MenuEntry[] = doc ? [
    { label: "Copy of the file, in the GB greens", icon: <Save />, keys: "Ctrl+E", onSelect: () => void save(true) },
    { separator: true },
    { heading: "Image as shown, in its palettes" },
    ...EXPORT_SCALES.map(([scale, name]) => ({ label: <>{name}<span className="k-muted k-xs" style={{ marginLeft: "auto" }}>{doc.width * scale} × {doc.height * scale}</span></>, indent: true, onSelect: () => void exportImage(scale, true) })),
    ...(frames.length > 1 ? [{ heading: `Animation as GIF${animations.length > 1 && animation?.name ? ` · ${animation.name}` : ""}` } as MenuEntry, ...EXPORT_SCALES.map(([scale, name]) => ({ label: <>{name}<span className="k-muted k-xs" style={{ marginLeft: "auto" }}>{frames.length} frames</span></>, indent: true, onSelect: () => void exportGif(scale) }))] : []),
    { heading: "Image in the GB greens" },
    ...EXPORT_SCALES.map(([scale, name]) => ({ label: <>{name}<span className="k-muted k-xs" style={{ marginLeft: "auto" }}>{doc.width * scale} × {doc.height * scale}</span></>, indent: true, onSelect: () => void exportImage(scale, false) })),
  ] : [];
  const slotTarget = slotMenu && doc ? docPalettes[slotMenu.palette - 1] : undefined;
  // The palette popup (right-click a palette or a slot; the author's asks, 2026-10-12): put in a slot with a filter,
  // or, from a slot, pick any project palette for it; Rename… and Duplicate for a project palette.
  const slotFilter = slotQuery.trim().toLowerCase();
  const slotRow = (slot: number, palette: Palette | null, here: boolean) => <><span className="app-slot" style={{ width: 14, color: "var(--k-ink-3)" }}>{slot + 1}</span><span className="app-chips">{(palette?.colors ?? ["#222", "#222", "#222", "#222"]).map((color, at) => <i key={at} style={{ background: color }} />)}</span><span className="app-name">{palette?.name ?? "—"}{here ? " (here)" : ""}</span>{slot === UI_SLOT && doc?.asset?.kind !== "sprites" && <Chip title="GB Studio draws dialogue boxes and menus with slot 8">UI</Chip>}</>;
  const fillSlot = slotMenu?.slot;
  const slotItems: MenuEntry[] = !slotMenu || !doc || !slotTarget ? []
    : fillSlot !== undefined ? [
      { heading: `Put a palette in slot ${fillSlot + 1}` },
      ...docPalettes.flatMap((palette, index): MenuEntry[] => !palette.id || (slotFilter && !palette.name.toLowerCase().includes(slotFilter)) ? [] : [{ disabled: sceneSlots[fillSlot] === palette.id, onSelect: () => void putInSlot(index + 1, fillSlot), label: <><span className="app-chips">{palette.colors.map((color, at) => <i key={at} style={{ background: color }} />)}</span><span className="app-name">{palette.name}{sceneSlots[fillSlot] === palette.id ? " (here)" : ""}</span></> }]),
      ...(slotFilter && !docPalettes.some((palette) => palette.id && palette.name.toLowerCase().includes(slotFilter)) ? [{ note: `No project palette matches "${slotQuery.trim()}".` }] : []),
      { separator: true },
      { note: `Writes ${slotWhere} in GB Studio right away. Tiles that used slot ${fillSlot + 1} show the new palette.` },
    ] : [
      ...(sceneSlots.length ? [
        { heading: `Put ${slotTarget.name} in slot` },
        ...slotPalettes.flatMap((index, slot): MenuEntry[] => {
          const holder = index >= 0 ? docPalettes[index] : null, here = index === slotMenu.palette - 1;
          if (slotFilter && !`${slot + 1} ${holder?.name ?? ""}`.toLowerCase().includes(slotFilter)) return [];
          return [{ disabled: here || !slotTarget.id, onSelect: () => void putInSlot(slotMenu.palette, slot), label: slotRow(slot, holder, here) }];
        }),
        { separator: true },
      ] as MenuEntry[] : []),
      ...(slotTarget.id ? [
        { label: "Rename…", icon: <Pencil />, title: "A new name in the project's palette file (GB Studio finds palettes by id, so scenes and events keep it)", onSelect: () => void renameProjectPalette(slotTarget) },
        { label: "Duplicate", icon: <CopyPlus />, title: "A new project palette with the same colors", onSelect: () => void duplicateProjectPalette(slotTarget) },
      ] as MenuEntry[] : []),
      { note: !slotTarget.id ? "Add this palette to the project first (palette manager)." : sceneSlots.length ? `Put in slot writes ${slotWhere} in GB Studio right away. Tiles that used the palette it replaces show the new one.` : "Open a project background or sprite sheet to put it in a slot." },
    ];
  const copyFrom = doc?.asset?.kind === "backgrounds" ? doc.asset : undefined;
  const copyTargets = copyMenu && copyFrom ? (project?.assets ?? []).filter((asset) => asset.kind === "backgrounds" && asset.file !== copyFrom.file && (!slotFilter || asset.name.toLowerCase().includes(slotFilter))) : [];
  const copyItems: MenuEntry[] = copyMenu && copyFrom ? [
    { heading: `Put ${copyFrom.name}'s eight palettes on` },
    ...copyTargets.map((asset): MenuEntry => ({ label: asset.name, icon: <FileImage />, onSelect: () => void copySlotsTo(asset) })),
    ...(copyTargets.length ? [] : [{ note: slotFilter ? `No background matches "${slotQuery.trim()}".` : "No other backgrounds in the project." }]),
    { separator: true },
    { note: "Writes that background's scene palettes in GB Studio (the same palettes, no copies made). A background no scene shows uses the project's defaults: add it to a scene first." },
  ] : [];
  const selectionItems: MenuEntry[] = selectionMenu && doc?.sel ? [
    { heading: `Selection · ${doc.sel.w} × ${doc.sel.h}` },
    { label: "Use as stamp", icon: <PhSticker size={15} />, onSelect: () => setTool("stamp") },
    { label: "Save as stamp…", icon: <Save />, disabled: !project, title: project ? `Saves a PNG in ${project.name}/Cartographer/stamps (tile palettes too, on whole tiles)` : "Open a GB Studio project to save stamps in it", onSelect: () => void saveAsStamp() },
    { separator: true },
    { label: "Copy", icon: <Copy />, keys: "Ctrl+C", onSelect: () => { if (copySelection()) say("Copied the selection"); } },
    { label: "Deselect", icon: <X />, keys: "Esc", onSelect: () => { dropFloat(doc); doc.sel = null; bump(); } },
  ] : [];
  const assetFolder = (asset: Asset) => asset.kind === "stamps" ? "Cartographer/stamps" : `assets/${asset.kind}`;
  const assetItems: MenuEntry[] = assetMenu ? [
    ...(assetMenu.asset.kind === "stamps" ? [{ label: "Use as stamp", icon: <PhSticker size={15} />, onSelect: () => void useSavedStamp(assetMenu.asset) }] : []),
    ...(assetMenu.asset.kind === "stamps" && !assetMenu.asset.autotile ? [{ label: assetMenu.asset.tags?.includes(PATTERN_TAG) ? "Make it an object" : "Make it a repeat tile", icon: <PhCheckerboard size={15} />, title: assetMenu.asset.tags?.includes(PATTERN_TAG) ? "Back to the Objects shelf" : "A seamless pattern: on the Repeat tiles shelf, and it opens with the seamless 3 × 3 view on", onSelect: () => void setRepeatTile(assetMenu.asset, !assetMenu.asset.tags?.includes(PATTERN_TAG)) }] : []),
    { label: assetMenu.asset.kind === "stamps" ? "Open to edit" : "Open", icon: <FolderOpen />, onSelect: () => void openAsset(assetMenu.asset) },
    { label: FILE_MANAGER_LABEL, icon: <FolderSearch />, onSelect: () => void fetch(`./__cartographer/reveal?${assetQuery(assetMenu.asset)}`, { method: "POST" }) },
    { label: "Copy file path", icon: <Copy />, onSelect: () => void navigator.clipboard?.writeText(`${project?.path ?? ""}/${assetFolder(assetMenu.asset)}/${assetMenu.asset.file}`).then(() => say("Copied the file path")) },
    { label: "Earlier versions…", icon: <History />, onSelect: () => setBackups({ file: `${assetFolder(assetMenu.asset)}/${assetMenu.asset.file}` }) },
    { label: "Duplicate", icon: <CopyPlus />, title: "A new PNG beside it, to make a variant (never replaces a file)", onSelect: () => void duplicateAsset(assetMenu.asset) },
    { label: "Rename…", icon: <Pencil />, disabled: !assetMenu.asset.renamable, title: assetMenu.asset.renamable ? (assetMenu.asset.kind === "stamps" ? "A new file name for this stamp" : "GB Studio hasn't taken it in yet (no .gbsres), so it can still be renamed here") : "GB Studio has taken it in (it has a .gbsres): rename it in GB Studio", onSelect: () => void renameAsset(assetMenu.asset) },
    { separator: true },
    { label: "Show project folder", icon: <FolderTree />, onSelect: () => void fetch("./__cartographer/reveal", { method: "POST" }) },
    { separator: true },
    { label: "Delete…", icon: <Trash2 />, title: "Asks first: the files go to the backups", onSelect: () => void askDelete(assetMenu.asset) },
  ] : [];
  // The wizards (W1…W8, the author's picks 2026-10-10); the text tool (W5) is in the tool column.
  const noProject = !project;
  const needProject = noProject ? "Open a GB Studio project first" : null;
  const wizardCards: WizardCard[] = [
    { thumb: "picture", name: "Picture to background", icon: <ImagePlus />, about: "Any picture or photo, framed to screens and fitted to GB Studio's palettes and tile budget, keeping its colors as best it can.", blocked: needProject, onStart: () => setShowPictureWizard(true) },
    { thumb: "dns", name: "Dawn, sunset and night", icon: <PxCloudMoon size={15} />, about: "Dawn, sunset and night versions of the open picture's slot palettes (as painted, they're the day), named so GB Studio events can swap them.", 
      blocked: sceneOpen || project ? null : "Open a project background or sprite sheet first",
      needs: sceneOpen ? undefined : "Click, then pick a background from the project list: it starts on that one",
      onStart: () => { if (sceneOpen) setWizard("dns"); else { setProjectKind("backgrounds"); setWizardAfterOpen("dns"); say("Pick a background: Dawn, sunset and night starts on it"); } } },
    { thumb: "paletteSet", name: "Palette set", icon: <SwatchBook />, about: "Eight palettes from a Lospec palette, any picture or the library, grouped lightest first.", blocked: needProject, onStart: () => setWizard("paletteSet") },
    { thumb: "snapshot", name: "3D Snapshot", icon: <Box />, about: "Turn a 3D model (.glb, .gltf or .obj), light it, and take its picture in the four shades: a screen, a smaller picture or a sprite.", blocked: null, onStart: () => setShowSnapshot(true) },
    { thumb: "budget", name: "Tile budget fixer", icon: <PhPiggyBank size={15} />, about: "Get the open picture under GB Studio's tile limit, one merge of near-twin tiles at a time.", blocked: doc ? null : "Open a picture first", onStart: () => setWizard("budget") },
    { thumb: "cave", name: "Cave or dungeon", icon: <Pickaxe />, about: "A cave or a dungeon of rooms drawn with the catalog’s cliffs and floors, 2 × 2 screens to start; sliders redraw it live.", blocked: null, onStart: () => setWizard("cave") },
    { thumb: "world", name: "Overworld", icon: <Mountain />, about: "An RPG-style overworld: water, forest, mountains, towns and roads, in the palettes you pick.", blocked: null, onStart: () => setWizard("world") },
    { thumb: "checkup", name: "Project check-up", icon: <PxHeart size={15} />, about: "The health report one issue at a time, each with its fix (old → new shown first).", blocked: needProject, onStart: () => setWizard("checkup") },
  ];
  const lookName = look === "dmg" ? "Game Boy screen" : look === "pocket" ? "Pocket screen" : "GBC screen";

  return (
    <div className="app k" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void onDrop(event)}>
      <header className="app-bar">
        {served
          ? <Menu open={Boolean(projectMenu)} onOpenChange={(open) => setProjectMenu(open ? { x: 0, y: 0 } : null)} items={projectItems} trigger={<button className="app-brand" title="Projects: open, switch or close"><LogoMark size={22} /><span className="k-wordmark">GB Cartographer</span><Chip tone="acc" title="Beta: keep your GB Studio project backed up">BETA</Chip><ChevronDown size={14} /></button>} />
          : <span className="app-brand"><LogoMark size={22} /><span className="k-wordmark">GB Cartographer</span><Chip tone="acc">BETA</Chip></span>}
        <span className="k-seg" role="group" aria-label="File">
          <Button icon={<FilePlus />} title={project ? `A new blank picture: in ${project.name} or just here` : "A new blank picture"} onClick={() => setShowNew(true)}><span className="app-bar-label">New</span></Button>
          <Button icon={<FolderOpen />} title="Open PNG files · Ctrl+O (or drop them on the window)" onClick={() => void pickFiles()}><span className="app-bar-label">Open</span></Button>
          <Button icon={<Save />} disabled={!doc} className={docs.current.some((item) => item.dirty) ? "app-unsaved" : undefined} title={`Save every changed picture · Ctrl+S${docs.current.some((item) => item.dirty) ? ` (${docs.current.filter((item) => item.dirty).length} unsaved)` : ""}${doc?.asset ? ` (this one over ${doc.asset.file} in the project; old files go to the backups folder)` : doc?.handle ? ` (this one over ${doc.name})` : " (this one asks where)"}`} onClick={() => void save(false)}><span className="app-bar-label">Save</span></Button>
          <Menu open={Boolean(exportMenu) && Boolean(doc)} onOpenChange={(open) => setExportMenu(open ? { x: 0, y: 0 } : null)} items={exportItems} trigger={<Button icon={<Rocket />} disabled={!doc} title="Export a copy in the GB greens (Ctrl+E), or an image to share"><span className="app-bar-label">Export</span></Button>} />
        </span>
        <span className="k-seg" role="group" aria-label="Maps and palettes">
          {served && !project && <Button icon={<FolderTree />} title="Open a GB Studio project folder" onClick={() => void chooseProject()}>Open project…</Button>}
          {project && <Button icon={<MapIcon />} title="Map Room: adventure-style grids of screens, each a background" onClick={() => setShowMapRoom(true)}>Maps</Button>}
          <Button icon={<SwatchBook />} title="Palette manager: the project's palettes, a library, and your own" onClick={() => setShowPalettes(true)}>Palettes</Button>
          <Button icon={<StoreIcon />} title="Asset Catalog: credited palettes and art to take into your project, a piece at a time" onClick={() => setShowStore(true)}>Catalog</Button>
          <Button icon={<PxWizard size={15} />} title="Wizards: step-by-step helpers" onClick={() => setShowWizards(true)}>Wizards</Button>
          <IconButton label="Settings: font and theme" onClick={() => setShowSettings(true)}><SettingsIcon /></IconButton>
        </span>
        <IconButton label="Undo" keys="Ctrl+Z" disabled={!doc?.undo.length} onClick={() => stepHistory("undo")}><Undo2 /></IconButton>
        <IconButton label="Redo" keys="Ctrl+Shift+Z" disabled={!doc?.redo.length} onClick={() => stepHistory("redo")}><Redo2 /></IconButton>
        <span className="k-spacer" />
        <span className="k-seg app-zoom" role="group" aria-label="Zoom">
          <IconButton label="Zoom out" size="sm" variant="ghost" disabled={!doc} onClick={() => zoomBy(-1)}><Minus /></IconButton>
          <button type="button" className="app-zoom-fit" disabled={!doc} aria-label="Fit the picture to the window" title="Fit the picture to the window · Ctrl+0" onClick={() => fitView()}><b className={doc ? undefined : "k-muted"}>{doc ? `${doc.zoom * 100}%` : "–"}</b></button>
          <IconButton label="Zoom in" size="sm" variant="ghost" disabled={!doc} onClick={() => zoomBy(1)}><Plus /></IconButton>
        </span>
        <span className="k-seg" role="group" aria-label="View">
          <IconButton label={`Tile grid: ${grid ? `${grid} px` : "off"} (click for off / 8 px / 16 px)`} pressed={grid > 0} onClick={() => setGrid(grid === 0 ? 8 : grid === 8 ? 16 : 0)} aria-label="Tile grid"><Grid3x3 />{grid > 0 && <span className="app-grid-size">{grid}</span>}</IconButton>
          <IconButton label="Tile budget view: red tiles are used once, amber ones nearly match another" pressed={budgetView} onClick={() => setBudgetView(!budgetView)} aria-label="Tile budget view"><PhPiggyBank size={16} /></IconButton>
          <IconButton label="Game Boy screens: outline each 160 × 144 screen" pressed={screens} onClick={() => { setScreens(!screens); store(SCREENS_KEY, !screens); }} aria-label="Game Boy screens"><PxGamepad size={16} /></IconButton>
          <IconButton label="GB Studio collisions over the picture (a background in a scene; the Collision brush paints them)" pressed={showCollisions} onClick={() => { setShowCollisions(!showCollisions); store("gbc-collisions", !showCollisions); }} aria-label="Collisions"><BrickWall /></IconButton>
          <IconButton label="Snap selections and moves to 8 px tiles" pressed={snap} onClick={() => setSnap(!snap)} aria-label="Snap selections to tiles"><Magnet /></IconButton>
        </span>
        <IconButton label="Help: tools, keys and what Save writes" keys="?" pressed={showHelp} onClick={() => setShowHelp(!showHelp)} aria-label="Help"><PxLightbulb size={16} /></IconButton>
      </header>
      <div className="app-tabs">
        <div className="app-tabs-scroll" ref={tabsRef} role="tablist" aria-label="Open pictures" onScroll={tabFades} onWheel={(event) => { if (event.deltaY && !event.deltaX && tabsRef.current) tabsRef.current.scrollLeft += event.deltaY; }}>
          {docs.current.map((item) => { const from = foreignProject(item); return (
            <div key={item.id} role="tab" aria-selected={item.id === activeId} className={`app-tab ${item.id === activeId ? "active" : ""}`} title={`${item.name} · ${item.width} × ${item.height} px${from ? ` · from another project: ${from}` : ""} · middle-click closes, right-click for more`} onClick={() => setActiveId(item.id)} onMouseDown={(event) => { if (event.button === 1) event.preventDefault(); }} onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); closeDoc(item); } }} onContextMenu={(event) => { event.preventDefault(); setTabMenu({ x: event.clientX, y: event.clientY, doc: item }); }}>
              <button className="k-btn k-btn--ghost k-icon-btn" aria-label={`Close ${item.name}`} onClick={(event) => { event.stopPropagation(); closeDoc(item); }}><X /></button>
              {from && <button type="button" className="app-tab-foreign" aria-label={`${item.name} is from another project`} title={`From another project (${from}): Save won't write it into this one. Click for Pictures from other projects.`} onClick={(event) => { event.stopPropagation(); setShowForeign(true); }}><Plane /></button>}
              <span className={item.dirty ? "dirty" : undefined} title={item.dirty ? "Not saved to the GB Studio project yet" : undefined}>{item.name}{item.dirty && " *"}</span>
            </div>
          ); })}
          <IconButton label="Open PNG files" keys="Ctrl+O" size="sm" variant="ghost" onClick={() => void pickFiles()}><Plus /></IconButton>
        </div>
        {docs.current.length > 1 && <Menu align="end" items={[{ label: "Close all", icon: <SquareX />, title: "Close every open picture (unsaved ones ask first)", onSelect: () => closeDocs([...docs.current]) }, { separator: true }, ...docs.current.map((item): MenuEntry => ({ label: <span className={item.dirty ? "dirty" : undefined}>{item.name}{item.dirty && " *"}</span>, icon: foreignProject(item) ? <Plane /> : item.id === activeId ? <Check /> : <FileImage />, onSelect: () => setActiveId(item.id) }))]}
          trigger={<IconButton label={`All open pictures (${docs.current.length})`} size="sm" variant="ghost"><ChevronDown /></IconButton>} />}
      </div>
      <div className="app-body">
        {project && (
          <ProjectPanel
            project={project}
            kind={projectKind}
            open={showProject}
            onKind={(kind) => { if (kind === projectKind) setShowProject(!showProject); else { setProjectKind(kind); setShowProject(true); } }}
            onToggle={() => setShowProject(!showProject)}
            unreadMessages={messages.unread} onMessages={() => { messages.markRead(); setShowMessages(true); }}
            slotsVersion={slotsVersion}
            stateOf={(asset) => { const open = docs.current.find((item) => item.asset?.kind === asset.kind && item.asset.file === asset.file && !foreignProject(item)); return { open: Boolean(open), active: Boolean(open && open.id === activeId), dirty: Boolean(open?.dirty) }; }}
            onOpen={(asset) => void openAsset(asset)}
            onUseStamp={(asset) => void useSavedStamp(asset)}
            onUseFont={(asset) => { void updateText({ ...textSettings, font: asset.file }); setTool("text"); say(`Type with ${asset.name}: click the picture to place the text`); }}
            onAutotile={(asset, autotile) => void setStampAutotile(asset, autotile)}
            onMenu={(asset, x, y) => setAssetMenu({ x, y, asset })}
          />
        )}
        <ToolColumn tool={tool} onTool={setTool} draft={Boolean(doc && draftOf(doc))} onDraft={toggleDraft} seamless={seamless} onSeamless={setSeamless} linked={linked} onLinked={setLinked} mirror={mirror} onMirror={setMirror} onInvert={invertSelection} pattern={patternInUse} onPattern={cyclePattern} cellBrush={cellBrush} onCellBrush={setCellBrush} brush={brush} onBrush={setBrush} shade={shade} shades={swatchColors} />
        <div className="k-panel app-stage gbp-scroller" ref={scrollerRef}>
          {doc && draftOf(doc) && (() => { const changed = draftChanges(doc); return (
            <div className="k-card app-strip" role="group" aria-label="Draft layer">
              <span className="app-strip-label"><Layers size={14} /> Draft layer, 50 % · {changed ? `${changed} pixel${changed === 1 ? "" : "s"} new` : "nothing painted yet"}</span>
              <Button size="sm" variant="primary" icon={<Check />} disabled={!changed} title="Keep the draft as part of the picture (one undo takes it back)" onClick={() => commitDraft(doc)}>Commit</Button>
              <Button size="sm" icon={<Eraser />} disabled={!changed} title="Put the picture back as it was when the draft began; the draft layer stays on" onClick={() => wipeDraft(doc)}>Wipe</Button>
              <Button size="sm" variant="ghost" icon={<X />} disabled={changed > 0} title={changed ? "Commit or wipe the draft first" : "Turn the draft layer off"} onClick={toggleDraft}>Off</Button>
            </div>
          ); })()}
          {doc && tool === "text" && <TextStrip fonts={project?.assets.filter((asset) => asset.kind === "fonts") ?? []} settings={{ ...textSettings, font: textSettings.font || project?.assets.find((asset) => asset.kind === "fonts")?.file || "" }} onChange={(settings) => void updateText(settings)} shades={swatchColors} placed={Boolean(doc.float) && doc.float === textFloat.current} onStamp={stampText} onCancel={cancelText} />}
          {doc && tool === "collision" && <CollisionStrip collision={doc.collision} isBackground={doc.asset?.kind === "backgrounds"} defs={collisionDefs(doc)} picked={collisionPick} onPick={setCollisionPick} onScene={(index) => { if (doc.collision) { doc.collision.scene = index; setCollisionPick(["solid"]); bump(); } }} />}
          {doc && tool === "stamp" && project && project.assets.some((asset) => asset.kind === "stamps") && <StampsStrip stamps={project.assets.filter((asset) => asset.kind === "stamps")} slotsVersion={slotsVersion} onUse={(asset) => void useSavedStamp(asset)} onOpen={(asset) => { setProjectKind("stamps"); void openAsset(asset); }} onAutotile={(asset, autotile) => void setStampAutotile(asset, autotile)} />}
          {doc && frames.length > 0 && <FramesStrip animations={animations} frame={frame} onFrame={setFrame} playing={playing} onPlaying={setPlaying} animSpeed={animSpeed} fps={fps} canvases={frameCanvases} onBackground={project?.assets.some((asset) => asset.kind === "backgrounds") ? () => setOnBackground(composeFrames()) : undefined} backgrounds={project?.assets.filter((asset) => asset.kind === "backgrounds") ?? []} />}
          {doc?.changedOnDisk && !doc.changedOnDisk.kept && (
            <div className="k-card app-strip app-strip--alert" role="alert">
              <span className="app-strip-label"><b>{doc.name}</b> changed on disk (GB Studio or another app saved it) while you have unsaved changes here.</span>
              <Button variant="primary" size="sm" onClick={async () => { if (await confirmBox(`Reload ${doc.name} from disk? Your unsaved changes here are lost.`, { yes: "Reload", danger: true })) { const target = doc; target.changedOnDisk = undefined; if (target.asset) void reloadAsset(target); else if (target.handle) void target.handle.getFile().then((file) => openFiles([{ file, handle: target.handle, replace: target.id }])); } }}>Reload from disk</Button>
              <Button size="sm" title="Keep painting; Save will ask before replacing the file on disk" onClick={() => { doc.changedOnDisk = { ...doc.changedOnDisk!, kept: true }; bump(); }}>Keep mine</Button>
            </div>
          )}
          {doc && seamless && (
            <div className="k-card app-strip" role="group" aria-label="Seamless view">
              <span className="app-strip-label">{seamlessArea ? (doc.sel ? `Selection ${seamlessArea.w} × ${seamlessArea.h}` : `Tile ${hoverCell!.x}, ${hoverCell!.y}`) : "Point at a tile"} · repeated 3 × 3</span>
              {seamlessArea && <canvas ref={seamlessCanvas} style={{ width: seamlessArea.w * 3 * Math.max(2, Math.min(8, Math.floor(96 / Math.max(seamlessArea.w, seamlessArea.h)))), height: seamlessArea.h * 3 * Math.max(2, Math.min(8, Math.floor(96 / Math.max(seamlessArea.w, seamlessArea.h)))) }} />}
            </div>
          )}
          {doc && isFont && (
            <div className="k-card app-strip" role="group" aria-label="Font sample">
              <canvas ref={sampleCanvas} className="gbp-sample-canvas" title="One Game Boy screen wide (160 px), shown at 2×" />
              <label className="k-field" style={{ width: 260 }}><span className="k-label">Your text</span><textarea className="k-input" rows={3} style={{ height: "auto", padding: "6px 10px", resize: "vertical" }} aria-label="Sample text" value={sampleText} onChange={(event) => setSampleText(event.target.value)} spellCheck={false} /><span className="k-hint">Wraps like a text box, one screen wide.</span></label>
            </div>
          )}
          {doc ? (
            <div className={`gbp-stage ${tool === "hand" ? "pan" : ""}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onContextMenu={(event) => event.preventDefault()}>
              <div className="gbp-grow" style={repeatTile ? { margin: `${doc.height * doc.zoom}px ${doc.width * doc.zoom}px` } : undefined}>
                {repeatTile && <canvas ref={repeatCanvas} className="gbp-repeat" aria-hidden style={{ width: doc.width * doc.zoom * 3, height: doc.height * doc.zoom * 3, left: -doc.width * doc.zoom, top: -doc.height * doc.zoom }} />}
                <div className="gbp-wrap" ref={wrapRef} style={{ width: doc.width * doc.zoom, height: doc.height * doc.zoom }}>
                  <canvas ref={canvasRef} />
                  {gridLines && <div className="gbp-grid" style={{ backgroundSize: `${gridLines} ${gridLines}` }} />}
                  {budgetView && <canvas ref={usageCanvas} className="gbp-usage" />}
                  {tool === "priority" && doc.priority && <canvas ref={priorityCanvas} className="gbp-usage gbp-priority" />}
                  {(showCollisions || tool === "collision") && doc.collision?.scenes.length ? <canvas ref={collisionCanvas} className="gbp-usage gbp-collisions" /> : null}
                  {draftOf(doc) && <canvas ref={draftCanvas} className="gbp-usage gbp-draft" />}
                  {atlasPlaying && <canvas ref={atlasAnimCanvas} className="gbp-usage" />}
                  {screens && <div className="gbp-screens" style={{ backgroundSize: `${160 * doc.zoom}px ${144 * doc.zoom}px` }} />}
                  {current && current.tiles.map((tile, index) => <div key={index} className="gbp-frame-slice" style={{ left: tile.sliceX * doc.zoom, top: tile.sliceY * doc.zoom, width: 8 * doc.zoom, height: 16 * doc.zoom }} />)}
                  {doc.sel && <div className={`gbp-selection ${doc.float ? "floating" : ""}`} style={{ left: doc.sel.x * doc.zoom, top: doc.sel.y * doc.zoom, width: doc.sel.w * doc.zoom, height: doc.sel.h * doc.zoom }} />}
                  <div className="gbp-brush-outline" ref={brushRef} />
                </div>
                {/* Grow the canvas a step (the author, 2026-10-13): a frame (16 px) on sprite sheets, a tile (8 px) elsewhere. */}
                {(() => { const sheet = doc.asset?.kind === "sprites", step = sheet ? 16 : CELL, what = doc.asset?.kind === "sprites" ? "16 px (a frame)" : "8 px (a tile)"; return (<>
                  {/* A sprite sheet only grows to the right and down (its .gbsres frames point at fixed pixels), as in Resize. */}
                  <span className="gbp-grow-x" onPointerDown={(event) => event.stopPropagation()}>
                    <IconButton label={`Add a column: ${what} wider (Ctrl+Z undoes it)`} aria-label="Wider" variant="ghost" onClick={() => resizePicture(doc.width + step, doc.height, false)}><Plus /></IconButton>
                    {!sheet && <IconButton label={`Take a column off the right: ${what} narrower (Ctrl+Z undoes it)`} aria-label="Narrower" variant="ghost" disabled={doc.width <= step} onClick={() => resizePicture(doc.width - step, doc.height, false)}><Minus /></IconButton>}
                  </span>
                  {/* And on the left and top (the author, 2026-10-14): the picture moves over, the new column or row is blank. */}
                  {!sheet && <><span className="gbp-grow-x gbp-grow-x--left" onPointerDown={(event) => event.stopPropagation()}>
                    <IconButton label={`Add a column on the left: ${what} wider (Ctrl+Z undoes it)`} aria-label="Wider on the left" variant="ghost" onClick={() => resizePicture(doc.width + step, doc.height, false, [step, 0])}><Plus /></IconButton>
                    <IconButton label={`Take a column off the left: ${what} narrower (Ctrl+Z undoes it)`} aria-label="Narrower on the left" variant="ghost" disabled={doc.width <= step} onClick={() => resizePicture(doc.width - step, doc.height, false, [-step, 0])}><Minus /></IconButton>
                  </span>
                  <span className="gbp-grow-y gbp-grow-y--top" onPointerDown={(event) => event.stopPropagation()}>
                    <IconButton label={`Add a row on top: ${what} taller (Ctrl+Z undoes it)`} aria-label="Taller on top" variant="ghost" onClick={() => resizePicture(doc.width, doc.height + step, false, [0, step])}><Plus /></IconButton>
                    <IconButton label={`Take a row off the top: ${what} shorter (Ctrl+Z undoes it)`} aria-label="Shorter on top" variant="ghost" disabled={doc.height <= step} onClick={() => resizePicture(doc.width, doc.height - step, false, [0, -step])}><Minus /></IconButton>
                  </span></>}
                  <span className="gbp-grow-y" onPointerDown={(event) => event.stopPropagation()}>
                    <IconButton label={`Add a row: ${what} taller (Ctrl+Z undoes it)`} aria-label="Taller" variant="ghost" onClick={() => resizePicture(doc.width, doc.height + step, false)}><Plus /></IconButton>
                    {!sheet && <IconButton label={`Take a row off the bottom: ${what} shorter (Ctrl+Z undoes it)`} aria-label="Shorter" variant="ghost" disabled={doc.height <= step} onClick={() => resizePicture(doc.width, doc.height - step, false)}><Minus /></IconButton>}
                  </span>
                </>); })()}
              </div>
            </div>
          ) : (
            <div className="gbp-empty">
              <span className="gbp-mascot" title="Nothing open yet"><LogoMark size={48} /></span>
              <p>{project ? `Pick a picture of ${project.name} on the left.` : "Drop PNG files here, or"}</p>
              {!project && <Button icon={<FolderOpen />} onClick={() => void pickFiles()}>Open PNG files</Button>}
            </div>
          )}
        </div>
        <button type="button" className="app-side-handle" aria-label={showSide ? "Hide the side panel" : "Show the side panel"} title={showSide ? "Hide the side panel" : "Show the side panel"} onClick={() => { setShowSide(!showSide); store("gbc-side", !showSide); }} />
        {showSide && <aside className="k-panel app-side">
          <div className="app-swatches">
            {swatchColors.slice(0, 4).map((color, index) => (
              <button key={index} className={doc?.keyGreen && index === 0 ? "app-swatch app-ignored" : "app-swatch"} aria-pressed={shade === index} style={{ background: color }} aria-label={`Shade ${index + 1}`} title={doc?.keyGreen && index === 0 ? "Shade 1 · GB Studio draws a sprite's or emote's lightest shade as see-through, so it never shows in the game: paint with 2, 3 and 4" : `Shade ${index + 1} · ${index + 1} · click again to change this color${picked ? ` of ${picked.name}` : " of the tint"}`} onClick={() => { if (shade === index) shadeInputs.current[index]?.click(); else { setShade(index); if (tool === "eyedropper") setToolState(paintTool.current); } }}>
                <Kbd>{index + 1}</Kbd>
                <input type="color" tabIndex={-1} aria-label={`Change color ${index + 1}`} ref={(element) => { shadeInputs.current[index] = element; }} value={normalizeHex(color)} onClick={(event) => event.stopPropagation()} onChange={(event) => changeShadeColor(index, event.target.value.toUpperCase())} />
              </button>
            ))}
          </div>
          {doc && (doc.hasAlpha || canSeeThrough(doc)
            ? <Button size="sm" className="app-clear" pressed={doc.hasAlpha && shade === CLEAR} title={doc.hasAlpha ? "See-through · 0; the eraser paints it too" : "Lets this picture have see-through pixels (saved as PNG transparency); then the eraser and 0 paint them"}
                onClick={() => { if (!doc.hasAlpha) { doc.hasAlpha = true; touch(doc); say(`${doc.name} can have see-through pixels now: the eraser makes them`); } setShade(CLEAR); }}><Kbd>0</Kbd>Transparent</Button>
            : <Button size="sm" className="app-clear" disabled title={`GB Studio has no see-through pixels on ${doc.asset?.kind ?? "this kind of picture"} (only sprites and emotes): the eraser paints the lightest shade here`}><Kbd>0</Kbd>Transparent</Button>)}
          <Tabs.Root value={sideTab} onValueChange={(value) => setSideTab(value as "palettes" | "picture")} style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, flex: 1 }}>
            <TabList label="Inspector" tabs={[{ value: "palettes", label: "Palettes" }, { value: "picture", label: "Picture" }]} />
            <Tabs.Content value="palettes" className="app-side-body">
              <PalettesPane doc={doc} palettes={docPalettes} sceneSlots={sceneSlots} slotPalettes={slotPalettes} slotWhere={slotWhere} activePalette={activePalette} onPick={pickPalette}
                namedSlots={namedSlots} onNamedSlots={setTimeOfDay} filter={paletteFilter} onFilter={setPaletteFilter} onSlotMenu={(x, y, palette, slot) => { setSlotQuery(""); setSlotMenu({ x, y, palette, slot }); }} onCopySlots={doc?.asset?.kind === "backgrounds" && project && (!doc.asset.project || doc.asset.project === project.path) ? (x, y) => { setSlotQuery(""); setCopyMenu({ x, y }); } : undefined}
                libraryColors={libraryColors} onSaveToProject={project && picked?.id ? () => void (async () => { if (await okToWriteProjectJson() && await writeProjectPalette({ id: picked.id!, name: picked.name, colors: [...picked.colors] })) say(`${picked.name} written to the project`); })() : undefined}
                onRecolor={recolorPalette} say={say} copiedColors={copiedColors} onCopy={(colors) => { setCopiedColors(colors); say(`Copied the colors of ${picked?.name}`); }} />
            </Tabs.Content>
            <Tabs.Content value="picture" className="app-side-body">
              <PicturePane time={timeOfDay.view.to} onTime={(key) => { timeOfDay.setPlaying(false); timeOfDay.go(key); }} playing={timeOfDay.playing} onPlaying={timeOfDay.setPlaying} timesAvailable={palettesWithTimes(docPalettes, palettes)} doc={doc} tileCount={tileCount} budget={budget} onBudget={setBudgetId} look={look} onLook={(next) => { setLook(next); store(LOOK_KEY, next); }}
                tint={tint} onTint={setTint} paletteNames={palettes.map(({ name }) => name)} customTint={customTint} onCustomTint={setCustomTint} font={font} onFont={(next) => { setFont(next); applyFont(next); }}
                onResize={() => setShowResize(true)} onFit={() => { if (!doc) return; const flat = doc.pixels.slice(); if (doc.float) drop(flat, doc.width, doc.height, doc.float); setFitting(toRgba(flat, doc.cells, doc.width, doc.palettes)); }}
                usage={shownUsage ? { usedOnce, nearCount } : null} budgetView={budgetView} onBudgetView={setBudgetView} onMerge={mergeNear} />
            </Tabs.Content>
          </Tabs.Root>
        </aside>}
      </div>
      <footer className="app-status">
        {atlasHeld && doc && <Button size="sm" icon={animStopped ? <Play /> : <Pause />} title={animStopped ? "Play the animated stamp's frames over the picture" : "Stop the animated stamp's frames playing over the picture (the picture itself is never changed)"}
          onClick={() => { const next = !animStopped; setAnimStopped(next); try { localStorage.setItem("gbc-anim-stopped", JSON.stringify(next)); } catch { /* private window */ } }}>{animStopped ? "Play" : "Stop"} animation</Button>}
        <span className="app-status-hint">{doc ? <><b>{hint[1]}</b> · {tool === "eraser" ? (doc.hasAlpha ? "drag to erase to see-through" : canSeeThrough(doc) ? "drag to erase to the lightest shade (Transparent, beside the shades, lets this picture be see-through)" : "drag to erase to the lightest shade (GB Studio has no see-through here)") : hint[4]}</> : project ? "Open a picture: click one in the project panel, or drop a PNG here" : "Open a GB Studio project, or a PNG (Ctrl+O)"}</span>
        <span ref={readoutRef} className="gbp-readout" />
        <span className="k-spacer" />
        {timeOfDay.view.to !== "day" && <Button size="sm" title="The picture shows its palettes' time-of-day versions (Picture tab → Time of day); nothing is changed. Click for day." onClick={() => { timeOfDay.setPlaying(false); timeOfDay.go("day"); }}>{TIMES.find((time) => time.key === timeOfDay.view.to)?.name} preview<X /></Button>}
        {look !== "plain" && <Button size="sm" title="The picture shows like a real screen (Picture tab → Screen); the file is unchanged. Click for plain." onClick={() => { setLook("plain"); store(LOOK_KEY, "plain"); }}>{lookName}<X /></Button>}
        {doc?.sel && <span>Selection {doc.sel.w} × {doc.sel.h} at {doc.sel.x}, {doc.sel.y}</span>}
        {doc && <span title={doc.asset ? `${doc.asset.kind === "stamps" ? "Cartographer/stamps" : `assets/${doc.asset.kind}`}/${doc.asset.file}` : doc.name}>{doc.width} × {doc.height} · {Math.ceil(doc.width / CELL)} × {Math.ceil(doc.height / CELL)} tiles</span>}
        {doc && (
          <Tooltip content={`Unique 8 × 8 tiles, as GB Studio counts them (${budget.flips ? "identical and flipped tiles merge" : "identical tiles merge"}). Click for ${project ? "the project's health report" : "the Picture tab"}.`}>
            <button type="button" aria-label={`Tiles: ${tileCount} of ${budget.limit}; open the project check-up`} className={`app-tiles ${tileCount > budget.limit ? "over" : ""}`} onClick={() => { if (project) setShowHealth(true); else setSideTab("picture"); }}>
              TILES<span className="k-meter-track"><span className="k-meter-fill" style={{ display: "block", width: `${Math.min(1, tileCount / budget.limit) * 100}%` }} /></span><span>{tileCount} / {budget.limit}</span>
            </button>
          </Tooltip>
        )}
      </footer>
      <Toasts showing={messages.showing} onDismiss={messages.dismiss} />
      {showMessages && <MessagesWindow messages={messages.messages} onClose={() => setShowMessages(false)} onClear={messages.clear} />}
      {copyMenu && <MenuAt x={copyMenu.x} y={copyMenu.y} items={copyItems} label="Copy palettes to" onClose={() => setCopyMenu(null)} search={slotQuery} onSearch={setSlotQuery} searchLabel="Filter backgrounds" />}
      {slotMenu && slotItems.length > 0 && <MenuAt x={slotMenu.x} y={slotMenu.y} items={slotItems} label={slotMenu.slot !== undefined ? `Slot ${slotMenu.slot + 1}` : "Palette"} onClose={() => setSlotMenu(null)} search={slotQuery} onSearch={slotMenu.slot !== undefined || sceneSlots.length ? setSlotQuery : undefined} searchLabel={slotMenu.slot !== undefined ? "Filter palettes" : "Filter slots"} />}
      {selectionMenu && selectionItems.length > 0 && <MenuAt x={selectionMenu.x} y={selectionMenu.y} items={selectionItems} label="Selection" onClose={() => setSelectionMenu(null)} />}
      {assetMenu && <MenuAt x={assetMenu.x} y={assetMenu.y} items={assetItems} label={assetMenu.asset.name} onClose={() => setAssetMenu(null)} />}
      {showHelp && <HelpWindow onClose={() => setShowHelp(false)} onAbout={() => { setShowHelp(false); setShowAbout(true); }} />}
      {showAbout && <AboutWindow onClose={() => setShowAbout(false)} />}
      {onBackground && project && <SpriteOnBackground backgrounds={project.assets.filter((asset) => asset.kind === "backgrounds")} frames={onBackground} fps={fps} onClose={() => setOnBackground(null)} />}
      {fitting && doc && <FitWindow name={doc.name} rgba={fitting} width={doc.width} height={doc.height} slotsTarget={doc.asset?.slots?.length && (doc.asset.kind === "backgrounds" || doc.asset.kind === "tilesets") ? doc.asset.slotScene ?? "the project's defaults" : null} onClose={() => setFitting(null)} onApply={applyFit} />}
      {showMapRoom && project && <MapRoom project={project} onClose={() => setShowMapRoom(false)} onOpen={(asset) => { setProjectKind("backgrounds"); void openAsset(asset); }} onProjectChanged={async () => { await loadProject(); setSlotsVersion((value) => value + 1); }} onExport={(blob, name) => saveBlob(blob, name, PNG_TYPES)} say={say} />}
      {showDialogue && project && <DialoguePreview backgrounds={project.assets.filter((asset) => asset.kind === "backgrounds")} hasFrame={project.assets.some((asset) => asset.kind === "ui" && asset.file === "frame.png")} onClose={() => setShowDialogue(false)} />}
      {stampSave && <SaveStampDialog hint={stampSave.hint} taken={(project?.assets ?? []).filter((asset) => asset.kind === "stamps").map((asset) => asset.name)} known={[...new Set((project?.assets ?? []).flatMap((asset) => asset.tags ?? []))]} onClose={() => stampSave.resolve(null)} onSave={(save) => stampSave.resolve(save)} />}
      {showForeign && project && <ForeignWindow pictures={foreignPictures()} projectName={project.name}
        onOpenHere={(id) => { const item = docs.current.find((entry) => entry.id === id); const here = item?.asset && projectRef.current?.assets.find((asset) => asset.kind === item.asset!.kind && asset.file === item.asset!.file); if (here) { setShowForeign(false); void openAsset(here); } }}
        onCopyHere={(id) => { const item = docs.current.find((entry) => entry.id === id); if (item) { setShowForeign(false); void copyIntoProject(item); } }}
        onCloseTab={(id) => { const item = docs.current.find((entry) => entry.id === id); if (item) closeDoc(item); }}
        onCloseAll={() => closeDocs(docs.current.filter((item) => foreignProject(item)))}
        onClose={() => setShowForeign(false)} />}
      {confirmDialog}
      {promptDialog}
      {deleting && <DeleteAssetDialog name={deleting.asset.name} files={deleting.files} uses={deleting.uses} busy={deleting.busy} onDelete={() => void confirmDelete()} onCancel={() => setDeleting(null)} />}
      {closing && <CloseWindow changes={closing.changes} busy={closing.busy} tabs={closing.tabs?.map((item) => item.name)} onSave={() => void saveAndClose()} onKeep={closing.tabs ? undefined : () => void finishClose()} onDiscard={() => void discardAndClose()} onCancel={() => { const tabs = closing.tabs; setClosing(null); if (!tabs) (window as PickerWindow).gbc?.cancelClose?.(); }} />}
      {tabMenu && <MenuAt x={tabMenu.x} y={tabMenu.y} label={tabMenu.doc.name} onClose={() => setTabMenu(null)} items={[
        { label: "Rename…", icon: <Pencil />, disabled: Boolean(tabMenu.doc.asset && !projectRef.current?.assets.find((item) => item.kind === tabMenu.doc.asset!.kind && item.file === tabMenu.doc.asset!.file)?.renamable), title: tabMenu.doc.asset ? "Project pictures can be renamed until GB Studio takes them in (no .gbsres yet); stamps always" : "This tab's name (not a project file yet)", onSelect: () => void renameTab(tabMenu.doc) },
        { separator: true },
        { label: "Close", icon: <X />, keys: "Alt+W", onSelect: () => closeDoc(tabMenu.doc) },
        { label: "Close others", icon: <CopyX />, disabled: docs.current.length < 2, onSelect: () => closeDocs(docs.current.filter((item) => item !== tabMenu.doc)) },
        { label: "Close all", icon: <SquareX />, onSelect: () => closeDocs([...docs.current]) },
      ]} />}
      {wizard === "dns" && doc && project && (
        <DnsWizard slots={slotPalettes.map((index) => { const palette = index >= 0 ? docPalettes[index] : null; return palette?.id ? { id: palette.id, name: palette.name, colors: [...palette.colors] } : null; })} where={slotWhere} existing={project.palettes.map((palette) => palette.name)}
          picture={{ pixels: doc.pixels, cells: doc.cells, width: doc.width, height: doc.height, palettes: doc.palettes }} onClose={() => setWizard(null)} onCreate={addPalettes} />
      )}
      {wizard === "paletteSet" && project && (
        <PaletteSetWizard projectName={project.name} slotsWhere={setSlotsAsset()?.where ?? null}
          picture={doc ? { name: doc.name, width: doc.width, height: doc.height, rgba: (() => { const flat = doc.pixels.slice(); if (doc.float) drop(flat, doc.width, doc.height, doc.float); return toRgba(flat, doc.cells, doc.width, doc.palettes); })() } : null}
          onClose={() => setWizard(null)} onAddToProject={addPaletteSet} onAddToMine={(list) => { addToMine(list); say(`Added ${list.length} palettes to Mine (the palette manager).`); }} />
      )}
      {showSettings && <SettingsWindow font={font} onFont={(next) => { setFont(next); applyFont(next); }} onClose={() => setShowSettings(false)} />}
      {showSnapshot && <SnapshotWindow onClose={() => setShowSnapshot(false)} onTake={(shot) => void createPicture({ kind: null, name: shot.name, width: shot.width, height: shot.height, pixels: shot.pixels })}
        onExport={(blob, name) => saveBlob(blob, name, PNG_TYPES)}
        onSend={project ? (kind, shot) => createPicture({ kind, name: shot.name, width: shot.width, height: shot.height, pixels: shot.pixels }) : null} />}
      {showWizards && <WizardGallery cards={wizardCards} onClose={() => setShowWizards(false)} />}
      {showStore && (
        <StoreWindow projectName={project?.name ?? null} projectPalettes={project?.palettes ?? []} onClose={() => setShowStore(false)}
          onAddToProject={async (list) => { const written = await addPalettes(list); if (written) say(`Added ${written} palette${written === 1 ? "" : "s"} to the project.`); return written; }}
          onAddToMine={(list) => { addToMine(list); say(`${list.length} palette${list.length === 1 ? "" : "s"} kept in Mine.`); }}
          onAddArt={async (asset, art) => {
            // A name the project doesn't use yet in that kind ("Hero", "Hero 2", …): new pictures never replace a file.
            const taken = new Set(projectRef.current?.assets.filter((item) => item.kind === asset.kind).map((item) => item.name.toLowerCase()));
            let name = asset.name, count = 1;
            while (taken.has(name.toLowerCase())) name = `${asset.name} ${++count}`;
            const made = await createPicture({ kind: asset.kind, name, width: art.width, height: art.height, pixels: art.pixels });
            // An auto-tile template arrives with its 9 or W set.
            const stamp = made && asset.autotile ? projectRef.current?.assets.find((item) => item.kind === "stamps" && item.name === name) : undefined;
            if (stamp && asset.autotile) await setStampAutotile(stamp, asset.autotile);
            return made;
          }}
          onOpenArt={(asset, art) => { void createPicture({ kind: null, name: asset.name, width: art.width, height: art.height, pixels: art.pixels }); setShowStore(false); }} />
      )}
      {(wizard === "cave" || wizard === "world") && (
        <GeneratorWizard mode={wizard} projectName={project?.name ?? null} limit={budget.limit} onClose={() => setWizard(null)}
          onOpen={(picture, name) => void openFittedPicture(generatedPicture(picture), name)} onSave={(picture, name) => saveFittedBackground(generatedPicture(picture), name)} onSaveMap={(picture, name, columns, rows) => saveGeneratedMap(picture, name, columns, rows)}
          takenNames={(project?.assets ?? []).filter((asset) => asset.kind === "backgrounds").map((asset) => asset.name)} tileStamps={(project?.assets ?? []).filter((asset) => asset.kind === "stamps" && (asset.autotile === "wallface" || asset.autotile === "wang" || asset.autotile === "edges" || asset.autotile === "corner" || asset.autotile === "path") && autotileKind(asset.autotile)?.fits(asset.width, asset.height))} loadTiles={loadCaveTiles} />
      )}
      {wizard === "budget" && doc && (
        <BudgetFixer picture={{ name: doc.name, pixels: (() => { const flat = doc.pixels.slice(); if (doc.float) drop(flat, doc.width, doc.height, doc.float); return flat; })(), cells: doc.cells, width: doc.width, height: doc.height, palettes: doc.palettes }}
          limit={budget.limit} flips={budget.flips} onClose={() => setWizard(null)} onApply={(pixels) => { dropFloat(doc); pushUndo(doc); doc.pixels.set(pixels); touch(doc); say(`${doc.name}: merged near tiles; ${countUniqueTiles(doc.pixels, doc.width, doc.height, budget.flips)} unique tiles now. Undo brings them back.`); }} />
      )}
      {wizard === "checkup" && project && (
        <CheckupWizard projectName={project.name} onClose={() => setWizard(null)}
          onFixPalette={async (palette) => { if (!await okToWriteProjectJson()) return false; const id = await writeProjectPalette(palette); await loadProject(); setSlotsVersion((value) => value + 1); return Boolean(id); }}
          onRemovePalette={removeProjectPalette}
          onOpen={(kind, file) => void openByFile(kind, file)}
          onFixTiles={(kind, file, colorOnly) => void openByFile(kind, file).then((opened) => { if (opened) { setBudgetId(colorOnly ? "colorOnly" : "monochrome"); setWizard("budget"); } })} />
      )}
      {showPictureWizard && <PictureWizard projectName={project?.name ?? null} takenNames={(project?.assets ?? []).filter((asset) => asset.kind === "backgrounds").map((asset) => asset.name)} onClose={() => setShowPictureWizard(false)} onOpen={openFittedPicture} onSave={saveFittedBackground} />}
      {showHealth && project && <HealthWindow projectName={project.name} onClose={() => setShowHealth(false)} onOpen={(kind, file) => { if ((kind as string) === "palettes") { setPaletteFocus(file); setShowPalettes(true); return; } const asset = project.assets.find((item) => item.kind === kind && item.file === file); if (asset) { setProjectKind(kind); void openAsset(asset); } }} />}
      {showNew && <NewPictureWindow projectName={project?.name ?? null} takenNames={(kind: AssetKind) => (project?.assets ?? []).filter((asset) => asset.kind === kind).map((asset) => asset.name)} initialKind={projectKind} onClose={() => setShowNew(false)} onCreate={createPicture} />}
      {showResize && doc && <ResizeWindow name={doc.asset?.name ?? doc.name} width={doc.width} height={doc.height} sprite={doc.asset?.kind === "sprites"} inProject={Boolean(doc.asset)} onClose={() => setShowResize(false)} onResize={resizePicture} />}
      {backups && project && (
        <BackupsWindow projectName={project.name} initialFile={backups.file} onClose={() => setBackups(null)} onRestore={restoreFromBackup} />
      )}
      {showPalettes && (
        <PaletteManager
          projectName={project?.name ?? null}
          projectPalettes={project?.palettes ?? []}
          focus={paletteFocus}
          sceneSlots={sceneSlots}
          picture={doc ? { pixels: (() => { const flat = doc.pixels.slice(); if (doc.float) drop(flat, doc.width, doc.height, doc.float); return flat; })(), width: doc.width, height: doc.height, sprite: Boolean(doc.keyGreen) } : null}
          onClose={() => { setShowPalettes(false); setPaletteFocus(undefined); }}
          onWriteProject={writeProjectPalette}
          onPick={(id) => { const index = docPalettes.findIndex((item) => item.id === id); if (index >= 0) { setActivePalette(index + 1); setTool("palette"); } }}
          onRemoveProject={removeProjectPalette}
          onSlotMenu={doc?.asset?.slots?.length ? (id, x, y) => { const index = docPalettes.findIndex((item) => item.id === id); if (index >= 0) { setSlotQuery(""); setSlotMenu({ x, y, palette: index + 1 }); } else say("Open a picture of this project to put its palettes in slots."); } : undefined}
        />
      )}
    </div>
  );
}
