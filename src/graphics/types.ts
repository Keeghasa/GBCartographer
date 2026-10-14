/**
 * The shape of a graphics library asset. The library itself (tiles, sprites, scenes, the catalog) stays on the
 * author's machines until its art is approved (2026-10-10: only palettes ship to GitHub); the Store shows its
 * Graphics aisle only when src/graphics/library.ts is there.
 */
import type { AssetKind } from "../app/model";
import type { Canvas } from "./pen";
import type { AutotileKind } from "../app/autotile";

export interface WireAsset {
  id: string; name: string; group: string; kind: AssetKind;
  /** What it is for, and how GB Studio reads it. */
  about?: string;
  make: () => Canvas;
  /** A stamp template that is an auto-tile (src/app/autotile.ts): added with its 9 or W already set. */
  autotile?: AutotileKind;
  /** Who made it, its license and where it comes from (2026-10-14: each piece credited; unset: the author, CC0). */
  credit?: PieceCredit;
}

export interface PieceCredit { author: string; license: string; source?: string }
/** The credit of a piece with none of its own: GB Cartographer's author. */
export const AUTHOR_CREDIT: PieceCredit = { author: "Keegan", license: "CC0", source: "https://github.com/Keeghasa/GBCartographer/tree/main/src/graphics" };
