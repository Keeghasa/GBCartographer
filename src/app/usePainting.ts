/**
 * Painting on the open picture: the pointer handlers for every tool (strokes, shapes, fills, the palette and
 * priority brushes, the stamp, selections and panning), and the pieces they share. Called once per render with the
 * app's current state; it owns only the state of a drag in progress.
 */
import { useEffect, useRef, type PointerEvent, type RefObject } from "react";
import { forestLayout, moundLayout, rpgCell, xpCell, xpCliffCell, type Piece } from "./autopaint";
import { CELL, CLEAR, cellsWide, clipRect, dot, drop, dropCells, ellipsePoints, fillRect, floodFill, lift, liftCells, linePoints, linkGroups, mirrorPoints, onTiles, rectFrom, replaceShade, snapRect, spray, syncLinked, type Floating, type Mirror, type Palette, type Pattern } from "../paint";
import type { Doc, Drag, Point, ToolId } from "./model";
import { paintCollision } from "../gb/collisions";
import { ATLAS_H, ATLAS_W, atlasWallCell, CORNER_NE, CORNER_NW, CORNER_SE, CORNER_SW, edgeMask, maskAt, slot16, WANG_COLUMNS, WANG_MASKS, wangSlot, type AutotileKind } from "./autotile";

interface Painting {
  doc: Doc | null;
  tool: ToolId;
  shade: number;
  brush: number;
  /** The palette brush's size in tiles. */
  cellBrush: number;
  mirror: Mirror;
  pattern: Pattern;
  linked: boolean;
  snap: boolean;
  seamless: boolean;
  activePalette: number;
  hoverCell: { x: number; y: number } | null;
  wrapRef: RefObject<HTMLDivElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  readoutRef: RefObject<HTMLSpanElement | null>;
  brushRef: RefObject<HTMLDivElement | null>;
  spaceDown: RefObject<boolean>;
  /** The tool the eyedropper goes back to. */
  paintTool: RefObject<ToolId>;
  setShade: (shade: number) => void;
  setActivePalette: (palette: number) => void;
  setHoverCell: (cell: { x: number; y: number }) => void;
  setToolState: (tool: ToolId) => void;
  say: (message: string) => void;
  pushUndo: (target: Doc) => void;
  touch: (target: Doc) => void;
  bump: () => void;
  floatSelection: (target: Doc, copy: boolean) => Floating | null;
  dropFloat: (target: Doc) => void;
  moveFloat: (target: Doc, x: number, y: number) => void;
  clonePalettes: (list: readonly Palette[]) => Palette[];
  blank: (target: Doc) => number;
  /** A right-click inside the selection: its menu (use or save as a stamp, copy). */
  onSelectionMenu: (x: number, y: number) => void;
  /** The text tool clicked outside the floating text: place the text there. */
  onPlaceText: (point: Point) => void;
  /** The collision brush's value and mask (the picked collision tiles; GB Studio's rule). */
  collisionBrush: () => { value: number; mask: number };
  /** Why the palette brush can't paint with the picked palette (not loaded into the slots), or null. */
  paletteBlocked: () => string | null;
}

/**
 * The stamp in hand: a picture to stamp, how it paints as an auto-tile, and for an animated tile its whole sheet of
 * frames (the stamp itself is frame 1; the frames play over the picture while it's held).
 */
export type HeldStamp = Floating & { palettes: Palette[]; /** An auto-tile (autotile.ts): how the stamp paints. */ auto?: AutotileKind; animSheet?: { pixels: Uint8Array; w: number; h: number; cells?: Uint8Array } };

export function usePainting(app: Painting) {
  const { doc, tool, shade, brush, cellBrush, mirror, pattern, linked, snap, activePalette } = app;
  const drag = useRef<Drag | null>(null);
  const lastPoint = useRef<Point | null>(null);
  /** The stamp tool's block: pixels, tile palettes when whole tiles, and the palettes they refer to. */
  const stamp = useRef<HeldStamp | null>(null);
  /** During a stroke with linked tiles: the groups, the pixels before the stroke, and after the last step. */
  const linkStroke = useRef<{ link: ReturnType<typeof linkGroups>; base: Uint8Array; previous: Uint8Array } | null>(null);
  /** Where the pointer last was over the picture, so the brush outline follows size and tool changes ([ and ]) at once. */
  const hover = useRef<{ clientX: number; clientY: number } | null>(null);

  function pointAt(event: { clientX: number; clientY: number }): Point {
    const box = app.wrapRef.current!.getBoundingClientRect();
    return { x: Math.floor((event.clientX - box.left) / box.width * doc!.width), y: Math.floor((event.clientY - box.top) / box.height * doc!.height) };
  }

  const inside = (target: Doc, { x, y }: Point) => x >= 0 && y >= 0 && x < target.width && y < target.height;

  function mark(target: Doc, { x, y }: Point, value: number) {
    for (const [mx, my] of mirrorPoints(x, y, target.width, target.height, mirror)) dot(target.pixels, target.width, target.height, mx, my, brush, value);
  }

  /**
   * The palette brush covers `cellBrush` × `cellBrush` tiles around the pointer (8 × 8 each, or on a sprite sheet
   * the 8 × 16 pairs GB Studio's sprite tiles are made of).
   */
  function setCell(target: Doc, point: Point) {
    if (!inside(target, point)) return;
    const cw = cellsWide(target.width), ch = Math.ceil(target.height / CELL);
    const tall = target.keyGreen ? 2 : 1;
    const offset = Math.floor((cellBrush - 1) / 2);
    const cx0 = (point.x >> 3) - offset, cy0 = (target.keyGreen ? point.y >> 4 << 1 : point.y >> 3) - offset * tall;
    for (let by = 0; by < cellBrush * tall; by += 1) {
      for (let bx = 0; bx < cellBrush; bx += 1) {
        const cx = cx0 + bx, cy = cy0 + by;
        if (cx >= 0 && cy >= 0 && cx < cw && cy < ch) target.cells[cy * cw + cx] = activePalette;
      }
    }
  }

  /** Picks up a block of the picture (and, on tile edges, its tile palettes) as the stamp. */
  function takeStamp(target: Doc, rect: { x: number; y: number; w: number; h: number }) {
    const area = clipRect(rect, target.width, target.height);
    if (!area) return;
    const flat = target.float ? target.pixels.slice() : target.pixels;
    if (target.float) drop(flat, target.width, target.height, target.float);
    stamp.current = { ...lift(flat, target.width, area), ...(onTiles(area) ? { cells: liftCells(target.cells, target.width, area) } : {}), palettes: app.clonePalettes(target.palettes) };
    app.say(`Stamp: ${area.w} × ${area.h}${onTiles(area) ? " (with its tile palettes)" : ""}. Click or drag to stamp it on the grid.`);
  }

  /** Stamps a copy with its top-left on the 8 px grid under `point` (see-through pixels leave the picture alone). */
  function putStamp(target: Doc, point: Point, source: (Floating & { palettes: Palette[] }) | null = stamp.current) {
    if (!source) return;
    const x = point.x & ~7, y = point.y & ~7;
    drop(target.pixels, target.width, target.height, { ...source, x, y });
    if (source.cells) {
      // Tile palettes land on the same palettes in this picture (matched by id, else name and colors; added if missing).
      const cells = source.cells.map((wear) => {
        const palette = wear ? source.palettes[wear - 1] : undefined;
        if (!palette) return 0;
        let index = target.palettes.findIndex((own) => (palette.id && own.id === palette.id) || (!palette.id && own.name === palette.name && own.colors.join() === palette.colors.join()));
        if (index < 0) index = target.palettes.push({ ...palette, colors: [...palette.colors] }) - 1;
        return index + 1;
      });
      dropCells(target.cells, target.width, target.height, { ...source, x, y, cells });
    }
  }

  /**
   * Box (9), 3-slice across (↔) and down (↕) over whole tiles from `a` to `b`: the stamp's end tiles at the ends, its
   * middle tiles repeated between (a 3 × 3-tile box stamp is the classic nine-slice). Across keeps the stamp's height,
   * down its width.
   */
  function putBox(target: Doc, a: Point, b: Point) {
    const source = stamp.current;
    if (!source) return;
    const sw = source.w / CELL, sh = source.h / CELL;
    const stretchX = source.auto !== "down", stretchY = source.auto !== "across";
    const x0 = (stretchX ? Math.min(a.x, b.x) : a.x) & ~7, y0 = (stretchY ? Math.min(a.y, b.y) : a.y) & ~7;
    const w = stretchX ? Math.max(2, ((Math.max(a.x, b.x) & ~7) - x0) / CELL + 1) : sw, h = stretchY ? Math.max(2, ((Math.max(a.y, b.y) & ~7) - y0) / CELL + 1) : sh;
    const pick = (at: number, size: number, of: number, stretch: boolean) => !stretch ? at : at === 0 ? 0 : at === size - 1 ? of - 1 : 1 + ((at - 1) % (of - 2));
    const pixels = new Uint8Array(w * CELL * h * CELL), cells = source.cells ? new Uint8Array(w * h) : undefined;
    for (let ty = 0; ty < h; ty += 1) for (let tx = 0; tx < w; tx += 1) {
      const sx = pick(tx, w, sw, stretchX), sy = pick(ty, h, sh, stretchY);
      for (let y = 0; y < CELL; y += 1) pixels.set(source.pixels.subarray((sy * CELL + y) * source.w + sx * CELL, (sy * CELL + y) * source.w + sx * CELL + CELL), (ty * CELL + y) * w * CELL + tx * CELL);
      if (cells && source.cells) cells[ty * w + tx] = source.cells[sy * sw + sx];
    }
    putStamp(target, { x: x0, y: y0 }, { pixels, w: w * CELL, h: h * CELL, x: x0, y: y0, ...(cells ? { cells } : {}), palettes: source.palettes });
  }

  // ---- tile-sheet auto-tiles (autotile.ts): a tile belongs when its pixels are one of the sheet's tiles ----------
  const tileKey = (pixels: Uint8Array, width: number, x: number, y: number) => {
    let key = "";
    for (let row = 0; row < CELL; row += 1) key += pixels.subarray((y + row) * width + x, (y + row) * width + x + CELL).join(",") + ";";
    return key;
  };
  /**
   * The sheet's tiles by their pixels: key → slot index (column + row × columns). With `blank`, the sheet's see-through
   * pixels count as that shade: a see-through pixel lands as the picture's blank, so that is how a painted tile reads.
   */
  function sheetKeys(columns: number, count: number, blank?: number) {
    const source = stamp.current!, keys = new Map<string, number>();
    const pixels = blank === undefined ? source.pixels : source.pixels.map((shade) => shade === CLEAR ? blank : shade);
    // A tile that is all blank can't tell the sheet's work from empty picture, so it never counts.
    const empty = blank === undefined ? null : tileKey(new Uint8Array(CELL * CELL).fill(blank), CELL, 0, 0);
    for (let index = 0; index < count; index += 1) {
      const key = tileKey(pixels, source.w, (index % columns) * CELL, Math.floor(index / columns) * CELL);
      if (!keys.has(key) && key !== empty) keys.set(key, index);
    }
    return keys;
  }
  /**
   * Draws the sheet's tile at (column, row) on tile (tx, ty), with its tile palette when the sheet has them. With
   * `replace`, the tile is cleared to blank first, so a see-through part of the sheet doesn't keep what was there.
   */
  function putSheetTile(target: Doc, tx: number, ty: number, column: number, row: number, replace = false) {
    const source = stamp.current!;
    if (replace) fillRect(target.pixels, target.width, target.height, { x: tx * CELL, y: ty * CELL, w: CELL, h: CELL }, app.blank(target));
    const pixels = new Uint8Array(CELL * CELL);
    for (let y = 0; y < CELL; y += 1) pixels.set(source.pixels.subarray((row * CELL + y) * source.w + column * CELL, (row * CELL + y) * source.w + column * CELL + CELL), y * CELL);
    const cells = source.cells ? new Uint8Array([source.cells[row * cellsWide(source.w) + column]]) : undefined;
    putStamp(target, { x: tx * CELL, y: ty * CELL }, { pixels, w: CELL, h: CELL, x: tx * CELL, y: ty * CELL, ...(cells ? { cells } : {}), palettes: source.palettes });
  }

  /**
   * Fills (or with `erase` clears) tile (tx, ty) for the sheet auto-tiles (Wang, edges, path, wall face) and redraws
   * the tiles around it that belong, each as its shape says.
   */
  function paintAuto(target: Doc, tx: number, ty: number, erase: boolean) {
    const auto = stamp.current?.auto;
    const cw = cellsWide(target.width), ch = Math.ceil(target.height / CELL);
    if (!auto || tx < 0 || ty < 0 || tx >= cw || ty >= ch) return;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < cw && y < ch;
    const keyAt = (x: number, y: number) => tileKey(target.pixels, target.width, x * CELL, y * CELL);
    if (auto === "wallface") return paintWallFace(target, tx, ty, erase, inside, keyAt);
    const keys = auto === "wang" ? sheetKeys(WANG_COLUMNS, WANG_MASKS.length) : sheetKeys(4, 16);
    const marked = new Map<string, boolean>([[`${tx},${ty}`, !erase]]);
    // Off the picture: a Wang area runs on past the edge; a path stops there.
    const filled = (x: number, y: number) => !inside(x, y) ? auto !== "path" : marked.get(`${x},${y}`) ?? keys.has(keyAt(x, y));
    if (erase) fillRect(target.pixels, target.width, target.height, { x: tx * CELL, y: ty * CELL, w: CELL, h: CELL }, app.blank(target));
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const x = tx + dx, y = ty + dy;
      if (!inside(x, y) || !filled(x, y) || (auto !== "wang" && dx && dy)) continue;
      const { column, row } = auto === "wang" ? wangSlot(maskAt(filled, x, y)) : slot16(edgeMask(filled, x, y));
      putSheetTile(target, x, y, column, row);
    }
  }

  /**
   * Wall face: (tx, ty) becomes floor (or, erasing, nothing); then the walls around it follow: the two tiles above a
   * floor that aren't floor are the lower and upper wall rows (drawn over whatever is there), ends drawn where the row
   * stops; tiles of the sheet that are no longer wall become nothing.
   */
  function paintWallFace(target: Doc, tx: number, ty: number, erase: boolean, inside: (x: number, y: number) => boolean, keyAt: (x: number, y: number) => string) {
    const keys = sheetKeys(4, 12);
    const FLOOR = 0;
    const marked = new Map<string, boolean>([[`${tx},${ty}`, !erase]]);
    const floor = (x: number, y: number) => inside(x, y) && (marked.get(`${x},${y}`) ?? keys.get(keyAt(x, y)) === FLOOR);
    const kind = (x: number, y: number) => floor(x, y) ? "floor" : floor(x, y + 1) ? "lower" : floor(x, y + 2) ? "upper" : "none";
    putSheetTile(target, tx, ty, erase ? 1 : 0, 0);
    for (let y = ty - 2; y <= ty + 1; y += 1) for (let x = tx - 2; x <= tx + 2; x += 1) {
      if (!inside(x, y) || (x === tx && y === ty)) continue;
      const here = kind(x, y), ours = keys.has(keyAt(x, y));
      if (here === "floor") continue;
      // Walls grow over whatever is above a floor; "nothing" only replaces the sheet's own tiles.
      if (here === "none") { if (ours) putSheetTile(target, x, y, 1, 0); continue; }
      const left = kind(x - 1, y) !== here, right = kind(x + 1, y) !== here;
      putSheetTile(target, x, y, left && right ? 3 : right ? 2 : left ? 1 : 0, here === "upper" ? 1 : 2);
    }
    // The tile just painted may itself sit in a wall's place when erased.
    if (erase && kind(tx, ty) !== "none") {
      const here = kind(tx, ty), left = kind(tx - 1, ty) !== here, right = kind(tx + 1, ty) !== here;
      putSheetTile(target, tx, ty, left && right ? 3 : right ? 2 : left ? 1 : 0, here === "upper" ? 1 : 2);
    }
  }

  /**
   * RPG Maker-layout blocks (autopaint.ts rpgCell; 16 px cells of 2 × 2 tiles): cell (cx, cy) joins (or, `erase`,
   * leaves) the area, then it and the cells around it are put together from the block's minitiles, each by its
   * neighbours. A cell belongs when its top-left tile is one of the block's minitiles (frame 1's, for water). Off the
   * picture counts as more of the area. A wall's roof is the area; the two cells below its bottom edge grow a face.
   */
  function paintAtlas(target: Doc, cx: number, cy: number, erase: boolean) {
    const auto = stamp.current?.auto;
    const cw = Math.floor(cellsWide(target.width) / 2), ch = Math.floor(Math.ceil(target.height / CELL) / 2);
    if (!auto || cx < 0 || cy < 0 || cx >= cw || cy >= ch) return;
    const wall = auto === "atlasWall", blank = app.blank(target);
    // The block's tiles are indexed across one block (water has three side by side; painting uses the first).
    const columns = ATLAS_W / CELL, roofTiles = columns * (ATLAS_H / CELL);
    const keys = sheetKeys(columns, wall ? roofTiles + 16 : roofTiles, blank);
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < cw && y < ch;
    const keyAt = (x: number, y: number) => tileKey(target.pixels, target.width, x * 2 * CELL, y * 2 * CELL);
    const marked = new Map<string, boolean>([[`${cx},${cy}`, !erase]]);
    const roof = (x: number, y: number) => !inside(x, y) ? true : marked.get(`${x},${y}`) ?? (() => { const index = keys.get(keyAt(x, y)); return index !== undefined && index < roofTiles; })();
    const face = (x: number, y: number) => inside(x, y) && !roof(x, y) && (roof(x, y - 1) || (roof(x, y - 2) && !roof(x, y - 1)));
    const put = (x: number, y: number, tiles: [number, number][]) => tiles.forEach(([column, row], quarter) => putSheetTile(target, x * 2 + (quarter % 2), y * 2 + Math.floor(quarter / 2), column, row, true));
    const clear = (x: number, y: number) => fillRect(target.pixels, target.width, target.height, { x: x * 2 * CELL, y: y * 2 * CELL, w: 2 * CELL, h: 2 * CELL }, blank);
    if (erase) clear(cx, cy);
    for (let dy = -1; dy <= (wall ? 3 : 1); dy += 1) for (let dx = wall ? -2 : -1; dx <= (wall ? 2 : 1); dx += 1) {
      const x = cx + dx, y = cy + dy;
      if (!inside(x, y)) continue;
      if (roof(x, y)) { if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) put(x, y, rpgCell(maskAt(roof, x, y))); continue; }
      if (!wall) continue;
      if (face(x, y)) {
        const first = roof(x, y - 1);
        put(x, y, atlasWallCell(face(x - 1, y) && roof(x - 1, y - 1) === first, face(x + 1, y) && roof(x + 1, y - 1) === first, !first, first && face(x, y + 1), ATLAS_H / CELL));
        continue;
      }
      // Not roof or face any more: the sheet's own tiles become nothing (other art stays).
      if (keys.has(keyAt(x, y))) clear(x, y);
    }
  }

  /**
   * RPG Maker XP-layout auto-tiles (autopaint.ts xpCell / xpCliffCell; Axul's sheets are drawn in it): 16 px cells.
   * Cell (cx, cy) joins (or, `erase`, leaves) the area; it and the cells around it are drawn again from the sheet
   * (frame 1's, for water). A cell belongs when its top-left tile is one of the sheet's tiles. For ground and water,
   * off the picture counts as more of the area; a cliff stops at the edge (so it shows its face there).
   */
  function paintXp(target: Doc, cx: number, cy: number, erase: boolean) {
    const auto = stamp.current?.auto;
    const cw = Math.floor(cellsWide(target.width) / 2), ch = Math.floor(Math.ceil(target.height / CELL) / 2);
    if (!auto || cx < 0 || cy < 0 || cx >= cw || cy >= ch) return;
    const cliff = auto === "xpCliff", blank = app.blank(target);
    const keys = sheetKeys(6, cliff ? 60 : 48, blank);
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < cw && y < ch;
    const keyAt = (x: number, y: number) => tileKey(target.pixels, target.width, x * 2 * CELL, y * 2 * CELL);
    const marked = new Map<string, boolean>([[`${cx},${cy}`, !erase]]);
    const filled = (x: number, y: number) => !inside(x, y) ? !cliff : marked.get(`${x},${y}`) ?? keys.has(keyAt(x, y));
    // Every cell around is decided before anything is drawn (drawing changes what the neighbours read as).
    const cells: [number, number, Piece[]][] = [];
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const x = cx + dx, y = cy + dy;
      if (!inside(x, y) || !filled(x, y)) continue;
      cells.push([x, y, cliff ? xpCliffCell((fx, fy) => inside(fx, fy) && filled(fx, fy), x, y) : xpCell(maskAt(filled, x, y))]);
    }
    if (erase) fillRect(target.pixels, target.width, target.height, { x: cx * 2 * CELL, y: cy * 2 * CELL, w: 2 * CELL, h: 2 * CELL }, blank);
    for (const [x, y, pieces] of cells) pieces.forEach((piece, quarter) => { if (piece) putSheetTile(target, x * 2 + (quarter % 2), y * 2 + (quarter >> 1), piece[0], piece[1], true); });
  }

  /**
   * The mound ledge (autopaint.ts moundLayout): cell (cx, cy) joins (or leaves) the plateau; the cells around it are
   * drawn again: plateau by its neighbours, the rock face under a bottom edge, the rock beside a plateau or face
   * (only over blank picture or the sheet's own tiles, so neighbouring art stays).
   */
  function paintMound(target: Doc, cx: number, cy: number, erase: boolean) {
    const cw = Math.floor(cellsWide(target.width) / 2), ch = Math.floor(Math.ceil(target.height / CELL) / 2);
    if (cx < 0 || cy < 0 || cx >= cw || cy >= ch) return;
    const blank = app.blank(target);
    const keys = sheetKeys(6, 60, blank);
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < cw && y < ch;
    const keyAt = (tx: number, ty: number) => tileKey(target.pixels, target.width, tx * CELL, ty * CELL);
    const empty = tileKey(new Uint8Array(CELL * CELL).fill(blank), CELL, 0, 0);
    const marked = new Map<string, boolean>([[`${cx},${cy}`, !erase]]);
    // Plateau: the cell's top-left tile is a plateau piece (columns 1–4 of rows 0–3, or an inner corner in row 8).
    const isPlateau = (index: number | undefined) => index !== undefined && ((index < 24 && index % 6 >= 1 && index % 6 <= 4) || (index >= 48 && index <= 51));
    const plateau = (x: number, y: number) => inside(x, y) && (marked.get(`${x},${y}`) ?? isPlateau(keys.get(keyAt(x * 2, y * 2))));
    const continues = (x: number, y: number) => !inside(x, y) || plateau(x, y);
    const ours = (tx: number, ty: number) => { const key = keyAt(tx, ty); return keys.has(key) || key === empty; };
    if (erase) fillRect(target.pixels, target.width, target.height, { x: cx * 2 * CELL, y: cy * 2 * CELL, w: 2 * CELL, h: 2 * CELL }, blank);
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
      const x = cx + dx, y = cy + dy;
      if (!inside(x, y)) continue;
      const { kind, pieces } = moundLayout(plateau, x, y, continues);
      const tiles = [[x * 2, y * 2], [x * 2 + 1, y * 2], [x * 2, y * 2 + 1], [x * 2 + 1, y * 2 + 1]];
      // A cell that is none of the mound's any more: the sheet's own tiles go blank.
      if (kind !== "plateau" && kind !== "face") tiles.forEach(([tx, ty]) => { if (keys.has(keyAt(tx, ty))) fillRect(target.pixels, target.width, target.height, { x: tx * CELL, y: ty * CELL, w: CELL, h: CELL }, blank); });
      pieces.forEach((piece, quarter) => {
        if (!piece) return;
        const [tx, ty] = tiles[quarter];
        if (kind === "beside" && !ours(tx, ty)) return;
        putSheetTile(target, tx, ty, piece[0], piece[1], true);
      });
    }
  }

  /**
   * Forest (the author's trees, autopaint.ts forestLayout): 32 px tree units drawn quarter by quarter, the clump's
   * quarter where the three units around that corner are forest too, else the lone tree's. A unit is forest when
   * every tile in it is blank or one of the sheet's (so a forest of other trees beside it isn't taken for this one).
   * Off the picture counts as forest.
   */
  function paintForest(target: Doc, ux: number, uy: number, erase: boolean) {
    const UNIT = 4;
    const uw = Math.floor(cellsWide(target.width) / UNIT), uh = Math.floor(Math.ceil(target.height / CELL) / UNIT);
    if (ux < 0 || uy < 0 || ux >= uw || uy >= uh) return;
    const blank = app.blank(target);
    const keys = sheetKeys(8, 32, blank);
    const empty = tileKey(new Uint8Array(CELL * CELL).fill(blank), CELL, 0, 0);
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < uw && y < uh;
    const marked = new Map<string, boolean>([[`${ux},${uy}`, !erase]]);
    const painted = (x: number, y: number) => {
      if (!inside(x, y)) return true;
      const mark = marked.get(`${x},${y}`);
      if (mark !== undefined) return mark;
      let ours = 0;
      for (let ty = 0; ty < UNIT; ty += 1) for (let tx = 0; tx < UNIT; tx += 1) {
        const key = tileKey(target.pixels, target.width, (x * UNIT + tx) * CELL, (y * UNIT + ty) * CELL);
        if (keys.has(key)) ours += 1; else if (key !== empty) return false;
      }
      return ours >= 4;
    };
    // Every unit around is decided before anything is drawn (drawing changes what the neighbours read as).
    const units: [number, number, Piece[]][] = [];
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const x = ux + dx, y = uy + dy;
      if (inside(x, y) && painted(x, y)) units.push([x, y, forestLayout(painted, x, y)]);
    }
    if (erase) fillRect(target.pixels, target.width, target.height, { x: ux * UNIT * CELL, y: uy * UNIT * CELL, w: UNIT * CELL, h: UNIT * CELL }, blank);
    for (const [x, y, pieces] of units) pieces.forEach((piece, quarter) => {
      if (!piece) return;
      const qx = quarter % 2, qy = quarter >> 1;
      for (let ty = 0; ty < 2; ty += 1) for (let tx = 0; tx < 2; tx += 1) putSheetTile(target, x * UNIT + qx * 2 + tx, y * UNIT + qy * 2 + ty, piece[0] + tx, piece[1] + ty, true);
    });
  }

  /** Corner Wang: sets (or clears) the second terrain at grid corner (vx, vy); the four tiles meeting there redraw. */
  function paintCorner(target: Doc, vx: number, vy: number, erase: boolean) {
    const cw = cellsWide(target.width), ch = Math.ceil(target.height / CELL);
    const keys = sheetKeys(4, 16);
    for (const [x, y, bit] of [[vx - 1, vy - 1, CORNER_SE], [vx, vy - 1, CORNER_SW], [vx - 1, vy, CORNER_NE], [vx, vy, CORNER_NW]] as const) {
      if (x < 0 || y < 0 || x >= cw || y >= ch) continue;
      const now = keys.get(tileKey(target.pixels, target.width, x * CELL, y * CELL)) ?? 0;
      const { column, row } = slot16(erase ? now & ~bit : now | bit);
      putSheetTile(target, x, y, column, row);
    }
  }

  /** Paints the collision brush (or clears, `erase`) on the tiles under its size, in the scene being edited. */
  function setCollision(target: Doc, point: Point, erase: boolean) {
    const scene = target.collision?.scenes[target.collision.scene];
    if (!scene || !inside(target, point)) return;
    const { value, mask } = erase ? { value: 0, mask: 0xff } : app.collisionBrush();
    const cw = cellsWide(target.width), ch = Math.ceil(target.height / CELL), offset = Math.floor((cellBrush - 1) / 2);
    for (let by = 0; by < cellBrush; by += 1) for (let bx = 0; bx < cellBrush; bx += 1) {
      const cx = (point.x >> 3) - offset + bx, cy = (point.y >> 3) - offset + by;
      if (cx >= 0 && cy >= 0 && cx < cw && cy < ch) scene.values[cy * cw + cx] = paintCollision(scene.values[cy * cw + cx], value, mask);
    }
  }

  /** Marks (or clears) the priority flag of the tiles under the palette brush's size. */
  function setPriority(target: Doc, point: Point, on: boolean) {
    if (!target.priority || !inside(target, point)) return;
    const cw = cellsWide(target.width), ch = Math.ceil(target.height / CELL), offset = Math.floor((cellBrush - 1) / 2);
    for (let by = 0; by < cellBrush; by += 1) for (let bx = 0; bx < cellBrush; bx += 1) {
      const cx = (point.x >> 3) - offset + bx, cy = (point.y >> 3) - offset + by;
      if (cx >= 0 && cy >= 0 && cx < cw && cy < ch) target.priority[cy * cw + cx] = on ? 1 : 0;
    }
  }

  function drawShape(target: Doc, a: Point, b: Point, value: number) {
    if (tool === "rectFill") return fillRect(target.pixels, target.width, target.height, rectFrom(a.x, a.y, b.x, b.y), value, pattern);
    const points = tool === "line" ? linePoints(a.x, a.y, b.x, b.y)
      : tool === "ellipse" ? ellipsePoints(a.x, a.y, b.x, b.y)
      : [...linePoints(a.x, a.y, b.x, a.y), ...linePoints(b.x, a.y, b.x, b.y), ...linePoints(b.x, b.y, a.x, b.y), ...linePoints(a.x, b.y, a.x, a.y)];
    for (const [x, y] of points) dot(target.pixels, target.width, target.height, x, y, brush, value);
  }

  function pickShade(target: Doc, point: Point) {
    if (!inside(target, point)) return;
    const flat = target.float ? target.pixels.slice() : target.pixels;
    if (target.float) drop(flat, target.width, target.height, target.float);
    app.setShade(flat[point.y * target.width + point.x]);
  }

  /** With linked tiles on, what the last step painted goes to every identical copy of each tile it touched. */
  function followLinks(target: Doc) {
    const stroke = linkStroke.current;
    if (!stroke) return;
    syncLinked(target.pixels, stroke.previous, stroke.base, target.width, target.height, stroke.link);
    stroke.previous.set(target.pixels);
  }

  /** The brush's footprint under the pointer: pixels, tiles for the palette and priority brushes, or the stamp. */
  function drawOutline(point: Point) {
    const outline = app.brushRef.current;
    if (!doc || !outline) return;
    if (tool === "stamp") {
      // The stamp's footprint where it would land.
      const visible = inside(doc, point) && Boolean(stamp.current);
      // An area auto-tile paints one cell a click (a 32 px tree unit, a 16 px block cell, an 8 px tile): the outline
      // shows that cell where it lands, not the whole sheet. Other stamps show their whole size.
      const auto = stamp.current?.auto;
      const unit = auto === "forest" ? 32 : auto === "mound" || auto === "xp" || auto === "xpAnim" || auto === "xpCliff" || auto === "atlas" || auto === "atlasAnim" || auto === "atlasWall" ? 16 : auto === "wang" || auto === "edges" || auto === "path" || auto === "wallface" ? CELL : 0;
      const corner = auto === "corner";
      const left = corner ? Math.round(point.x / CELL) * CELL - CELL / 2 : unit ? Math.floor(point.x / unit) * unit : point.x & ~7;
      const top = corner ? Math.round(point.y / CELL) * CELL - CELL / 2 : unit ? Math.floor(point.y / unit) * unit : point.y & ~7;
      const width = corner ? CELL : unit || (stamp.current?.w ?? CELL), height = corner ? CELL : unit || (stamp.current?.h ?? CELL);
      Object.assign(outline.style, { display: visible ? "block" : "none", left: `${left * doc.zoom}px`, top: `${top * doc.zoom}px`, width: `${width * doc.zoom}px`, height: `${height * doc.zoom}px` });
    } else {
      const cells = tool === "palette" || tool === "priority" || tool === "collision", tall = tool === "palette" && doc.keyGreen;
      const cellH = tall ? 2 * CELL : CELL, cellOffset = Math.floor((cellBrush - 1) / 2);
      const size = cells ? CELL * cellBrush : brush, offset = cells ? 0 : Math.floor((brush - 1) / 2);
      const [x, y] = cells ? [(point.x & ~7) - cellOffset * CELL, (tall ? point.y & ~15 : point.y & ~7) - cellOffset * cellH] : [point.x - offset, point.y - offset];
      const visible = inside(doc, point) && tool !== "hand" && tool !== "select" && tool !== "move" && tool !== "text";
      Object.assign(outline.style, { display: visible ? "block" : "none", left: `${x * doc.zoom}px`, top: `${y * doc.zoom}px`, width: `${size * doc.zoom}px`, height: `${(cells ? cellH * cellBrush : size) * doc.zoom}px` });
    }
  }

  useEffect(() => {
    if (hover.current && doc && app.wrapRef.current) drawOutline(pointAt(hover.current));
  });

  function pointerDown(event: PointerEvent) {
    if (!doc || event.button === 1) return;
    const scroller = app.scrollerRef.current!;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "hand" || app.spaceDown.current) {
      drag.current = { kind: "pan", x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
      return;
    }
    const point = pointAt(event);
    const sel = doc.sel;
    if (event.button === 2 && sel && point.x >= sel.x && point.y >= sel.y && point.x < sel.x + sel.w && point.y < sel.y + sel.h) {
      app.onSelectionMenu(event.clientX, event.clientY);
      return;
    }
    if (event.button === 2 && tool === "stamp") {
      if (inside(doc, point)) takeStamp(doc, { x: point.x & ~7, y: point.y & ~7, w: CELL, h: CELL });
      return;
    }
    if (event.button === 2 && tool === "collision" && doc.collision?.scenes.length) {
      app.pushUndo(doc);
      setCollision(doc, point, true);
      drag.current = { kind: "collision", last: point, erase: true };
      return app.touch(doc);
    }
    if (event.button === 2 && tool === "priority" && doc.priority) {
      app.pushUndo(doc);
      setPriority(doc, point, false);
      drag.current = { kind: "priority", last: point, on: false };
      return app.touch(doc);
    }
    if (event.button === 2) {
      if (tool === "palette" && inside(doc, point)) app.setActivePalette(doc.cells[(point.y >> 3) * cellsWide(doc.width) + (point.x >> 3)]);
      else pickShade(doc, point);
      return;
    }
    const value = tool === "eraser" || tool === "fillErase" || (shade === CLEAR && !doc.hasAlpha) ? app.blank(doc) : shade;
    if (tool === "text") {
      // Inside the floating text: drag it; elsewhere: the text goes there.
      const float = doc.float;
      if (float && point.x >= float.x && point.y >= float.y && point.x < float.x + float.w && point.y < float.y + float.h) drag.current = { kind: "move", start: point, ox: float.x, oy: float.y };
      else app.onPlaceText(point);
      return;
    }
    linkStroke.current = linked && !["eyedropper", "select", "move", "palette", "hand"].includes(tool) ? { link: linkGroups(doc.pixels, doc.width, doc.height), base: doc.pixels.slice(), previous: doc.pixels.slice() } : null;
    if (tool === "eyedropper") {
      // Came here from the palette brush: pick the tile's palette instead of a shade.
      if (app.paintTool.current === "palette") { if (inside(doc, point)) app.setActivePalette(doc.cells[(point.y >> 3) * cellsWide(doc.width) + (point.x >> 3)]); }
      else pickShade(doc, point);
      app.setToolState(app.paintTool.current);
    } else if (tool === "select" || tool === "move") {
      const sel = doc.sel;
      if (tool === "move" || (sel && point.x >= sel.x && point.y >= sel.y && point.x < sel.x + sel.w && point.y < sel.y + sel.h)) {
        const floating = app.floatSelection(doc, event.altKey);
        if (floating) drag.current = { kind: "move", start: point, ox: floating.x, oy: floating.y };
      } else {
        app.dropFloat(doc);
        doc.sel = null;
        drag.current = { kind: "marquee", start: point };
      }
    } else if (tool === "stamp") {
      if (!stamp.current) { app.say("Right-click a tile to pick it up as the stamp, or select a block and pick the stamp tool again."); return; }
      app.dropFloat(doc);
      app.pushUndo(doc);
      const origin = { x: point.x & ~7, y: point.y & ~7 };
      const auto = stamp.current.auto;
      if (auto === "wang" || auto === "edges" || auto === "path" || auto === "wallface") {
        const erase = event.altKey;
        paintAuto(doc, point.x >> 3, point.y >> 3, erase);
        drag.current = { kind: "auto", last: point, erase };
      } else if (auto === "xp" || auto === "xpAnim" || auto === "xpCliff") {
        const erase = event.altKey;
        paintXp(doc, point.x >> 4, point.y >> 4, erase);
        drag.current = { kind: "xp", last: point, erase };
      } else if (auto === "mound") {
        const erase = event.altKey;
        paintMound(doc, point.x >> 4, point.y >> 4, erase);
        drag.current = { kind: "mound", last: point, erase };
      } else if (auto === "forest") {
        const erase = event.altKey;
        paintForest(doc, point.x >> 5, point.y >> 5, erase);
        drag.current = { kind: "forest", last: point, erase };
      } else if (auto === "atlas" || auto === "atlasAnim" || auto === "atlasWall") {
        const erase = event.altKey;
        paintAtlas(doc, point.x >> 4, point.y >> 4, erase);
        drag.current = { kind: "atlas", last: point, erase };
      } else if (auto === "corner") {
        const erase = event.altKey, vertex = { x: Math.round(point.x / CELL), y: Math.round(point.y / CELL) };
        paintCorner(doc, vertex.x, vertex.y, erase);
        drag.current = { kind: "corner", last: vertex, erase };
      } else if (auto === "box" || auto === "across" || auto === "down") {
        drag.current = { kind: "box", origin, base: doc.pixels.slice(), baseCells: doc.cells.slice() };
        putBox(doc, origin, origin);
      } else {
        putStamp(doc, point);
        drag.current = { kind: "stamp", origin, last: origin };
      }
    } else if (tool === "collision") {
      if (!doc.collision?.scenes.length) { app.say(doc.asset?.kind === "backgrounds" ? "GB Studio hasn't put this background in a scene yet: add it to a scene in GB Studio first, then open it here again." : "Collisions belong to a project background's GB Studio scene."); return; }
      app.pushUndo(doc);
      const erase = event.altKey;
      setCollision(doc, point, erase);
      drag.current = { kind: "collision", last: point, erase };
    } else if (tool === "priority") {
      if (!doc.priority) { app.say("The priority brush is for project backgrounds and tilesets (GB Studio's draw-over-sprites flag)."); return; }
      app.pushUndo(doc);
      const on = !event.altKey;
      setPriority(doc, point, on);
      drag.current = { kind: "priority", last: point, on };
    } else if (tool === "palette") {
      const blocked = app.paletteBlocked();
      if (blocked) { app.say(blocked); return; }
      app.pushUndo(doc);
      for (const [x, y] of event.shiftKey && lastPoint.current ? linePoints(lastPoint.current.x, lastPoint.current.y, point.x, point.y) : [[point.x, point.y]]) setCell(doc, { x, y });
      drag.current = { kind: "cells", last: point };
      lastPoint.current = point;
    } else if (tool === "fill" || tool === "fillErase") {
      app.pushUndo(doc);
      // Alt-click replaces that shade everywhere (inside the selection, if any) instead of filling one area.
      const changed = event.altKey ? replaceShade(doc.pixels, doc.width, doc.height, doc.pixels[point.y * doc.width + point.x], value, doc.sel) > 0 : floodFill(doc.pixels, doc.width, doc.height, point.x, point.y, value, pattern);
      if (!changed) doc.undo.pop();
    } else if (tool === "pencil" || tool === "eraser") {
      app.pushUndo(doc);
      for (const [x, y] of event.shiftKey && lastPoint.current ? linePoints(lastPoint.current.x, lastPoint.current.y, point.x, point.y) : [[point.x, point.y]]) mark(doc, { x, y }, value);
      drag.current = { kind: "stroke", last: point };
      lastPoint.current = point;
    } else if (tool === "spray") {
      app.pushUndo(doc);
      for (const [x, y] of mirrorPoints(point.x, point.y, doc.width, doc.height, mirror)) spray(doc.pixels, doc.width, doc.height, x, y, brush, value);
      drag.current = { kind: "spray", last: point };
    } else {
      app.pushUndo(doc);
      drag.current = { kind: "shape", start: point, base: doc.pixels.slice() };
      drawShape(doc, point, point, value);
    }
    followLinks(doc);
    app.touch(doc);
  }

  function pointerMove(event: PointerEvent) {
    if (!doc) return;
    const point = pointAt(event);
    if (app.readoutRef.current) app.readoutRef.current.textContent = inside(doc, point) ? `${point.x}, ${point.y} · tile ${point.x >> 3}, ${point.y >> 3}` : "";
    hover.current = { clientX: event.clientX, clientY: event.clientY };
    drawOutline(point);
    if (app.seamless && inside(doc, point) && (app.hoverCell?.x !== point.x >> 3 || app.hoverCell?.y !== point.y >> 3)) app.setHoverCell({ x: point.x >> 3, y: point.y >> 3 });
    const state = drag.current;
    if (!state) return;
    const value = tool === "eraser" || (shade === CLEAR && !doc.hasAlpha) ? app.blank(doc) : shade;
    if (state.kind === "pan") {
      const scroller = app.scrollerRef.current!;
      scroller.scrollLeft = state.left - (event.clientX - state.x);
      scroller.scrollTop = state.top - (event.clientY - state.y);
      return;
    }
    if (state.kind === "stroke") {
      for (const [x, y] of linePoints(state.last.x, state.last.y, point.x, point.y)) mark(doc, { x, y }, value);
      state.last = lastPoint.current = point;
    } else if (state.kind === "spray") {
      for (const [x, y] of mirrorPoints(point.x, point.y, doc.width, doc.height, mirror)) spray(doc.pixels, doc.width, doc.height, x, y, brush, value);
    } else if (state.kind === "cells") {
      for (const [x, y] of linePoints(state.last.x, state.last.y, point.x, point.y)) setCell(doc, { x, y });
      state.last = lastPoint.current = point;
    } else if (state.kind === "stamp") {
      // Copies tile outward from the first one, a stamp's size apart, so a block repeats seamlessly.
      const source = stamp.current;
      if (source) {
        const at = { x: state.origin.x + Math.floor((point.x - state.origin.x) / source.w) * source.w, y: state.origin.y + Math.floor((point.y - state.origin.y) / source.h) * source.h };
        if (at.x !== state.last.x || at.y !== state.last.y) {
          drop(doc.pixels, doc.width, doc.height, { ...source, ...at });
          if (source.cells && at.x % CELL === 0 && at.y % CELL === 0) putStamp(doc, at);
          state.last = at;
        }
      }
    } else if (state.kind === "auto") {
      for (const [x, y] of linePoints(state.last.x >> 3, state.last.y >> 3, point.x >> 3, point.y >> 3)) paintAuto(doc, x, y, state.erase);
      state.last = point;
    } else if (state.kind === "xp") {
      for (const [x, y] of linePoints(state.last.x >> 4, state.last.y >> 4, point.x >> 4, point.y >> 4)) paintXp(doc, x, y, state.erase);
      state.last = point;
    } else if (state.kind === "mound") {
      for (const [x, y] of linePoints(state.last.x >> 4, state.last.y >> 4, point.x >> 4, point.y >> 4)) paintMound(doc, x, y, state.erase);
      state.last = point;
    } else if (state.kind === "forest") {
      for (const [x, y] of linePoints(state.last.x >> 5, state.last.y >> 5, point.x >> 5, point.y >> 5)) paintForest(doc, x, y, state.erase);
      state.last = point;
    } else if (state.kind === "atlas") {
      for (const [x, y] of linePoints(state.last.x >> 4, state.last.y >> 4, point.x >> 4, point.y >> 4)) paintAtlas(doc, x, y, state.erase);
      state.last = point;
    } else if (state.kind === "corner") {
      const vertex = { x: Math.round(point.x / CELL), y: Math.round(point.y / CELL) };
      for (const [x, y] of linePoints(state.last.x, state.last.y, vertex.x, vertex.y)) paintCorner(doc, x, y, state.erase);
      state.last = vertex;
    } else if (state.kind === "box") {
      doc.pixels.set(state.base);
      doc.cells.set(state.baseCells);
      putBox(doc, state.origin, point);
    } else if (state.kind === "collision") {
      for (const [x, y] of linePoints(state.last.x, state.last.y, point.x, point.y)) setCollision(doc, { x, y }, state.erase);
      state.last = point;
    } else if (state.kind === "priority") {
      for (const [x, y] of linePoints(state.last.x, state.last.y, point.x, point.y)) setPriority(doc, { x, y }, state.on);
      state.last = point;
    } else if (state.kind === "shape") {
      doc.pixels.set(state.base);
      drawShape(doc, state.start, point, value);
    } else if (state.kind === "marquee") {
      const rect = rectFrom(state.start.x, state.start.y, point.x, point.y);
      doc.sel = clipRect(snap ? snapRect(rect, CELL) : rect, doc.width, doc.height);
    } else if (state.kind === "move") {
      const step = (distance: number) => snap ? Math.round(distance / CELL) * CELL : distance;
      app.moveFloat(doc, state.ox + step(point.x - state.start.x), state.oy + step(point.y - state.start.y));
    }
    if (state.kind === "stroke" || state.kind === "spray" || state.kind === "shape" || state.kind === "stamp" || state.kind === "box" || state.kind === "auto" || state.kind === "atlas" || state.kind === "xp" || state.kind === "mound" || state.kind === "forest" || state.kind === "corner") followLinks(doc);
    app.bump();
  }

  function pointerUp() {
    const state = drag.current;
    drag.current = null;
    linkStroke.current = null;
    if (!doc || !state || state.kind === "pan") return;
    if (state.kind === "marquee" && doc.sel && doc.sel.w < 2 && doc.sel.h < 2) doc.sel = null;
    if (state.kind !== "marquee") app.touch(doc);
    else app.bump();
  }

  /** Picks up a saved stamp (pixels, tile palettes when whole tiles, and the palettes they refer to). */
  function setStamp(value: HeldStamp) {
    stamp.current = value;
  }

  /** The stamp in hand (an animated Atlas block plays over the picture while it is held). */
  const heldStamp = () => stamp.current;
  return { takeStamp, setStamp, heldStamp, pointerDown, pointerMove, pointerUp };
}
