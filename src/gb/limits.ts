export const TILE_SIZE = 8;
export const MIN_MAP_WIDTH_PX = 160;
export const MIN_MAP_HEIGHT_PX = 144;
export const MAX_MAP_WIDTH_PX = 2040;
export const MAX_MAP_HEIGHT_PX = 2040;
export const MAX_MAP_AREA_PX = 1_048_320;
export const UNIQUE_TILE_LIMITS = {
  monochrome: 192,
  colorMonochrome: 192,
  colorOnly: 384,
} as const;
export type ColorMode = keyof typeof UNIQUE_TILE_LIMITS;
export const MONOCHROME_PALETTE = ["#E0F8CF", "#86C06C", "#306850", "#071821"] as const;
export const MAX_BACKGROUND_PALETTES = 7;
export const COLORS_PER_TILE = 4;

/**
 * A Logo scene's tiles (GB Studio 4.3.2, checked 2026-10-13): Logo scenes are 160 × 144, can't show text or actors,
 * and GB Studio doesn't check their tile count; a full screen is 20 × 18 = 360 tiles, so that is all one can use.
 * Other scenes keep 192 (GB, GB + Color) or 384 (Color only); the dialogue frame and text have their own 64 tiles.
 */
export const LOGO_TILES = 360;
/** Whether a picture could be a Logo scene with more tiles than its scene limit allows. */
export const logoHelps = (width: number, height: number, limit: number) => width === 160 && height === 144 && limit < LOGO_TILES;
