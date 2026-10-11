/**
 * GB Studio's scene collisions (the author's pick, 2026-10-11): one byte per 8 × 8 tile in a scene's
 * `collisions` (packed like a background's tileColors), drawn and painted the way GB Studio 4.3 does.
 *
 * What each value means depends on the scene's type. The definitions below are GB Studio's own, from its engine
 * (appData/engine/engine.json, GB Studio 4.3, MIT, Chris Maltby and contributors): a value matches a definition
 * when its bits under the definition's `mask` equal its `flag`; `multi` ones (the one-way sides) combine.
 * Plugins can add scene types with their own definitions (read from the project, server side).
 */
export interface CollisionTileDef {
  key: string;
  /** "#RRGGBBAA" */
  color: string;
  /** 8 × 8 one-bit icon, 16 hex digits, a row a byte. */
  icon?: string;
  flag: number;
  mask?: number;
  multi?: boolean;
  group?: string;
  /** A name for the brush (GB Studio's own are language keys; ours are words). */
  name?: string;
}

const SIDES: CollisionTileDef[] = [
  { key: "solid", name: "Solid", color: "#FA2828FF", mask: 15, flag: 15, icon: "FFFFFFFFFFFFFFFF" },
  { key: "top", name: "Top", color: "#2828FAFF", mask: 15, flag: 1, icon: "FFFFFF0000000000", multi: true },
  { key: "bottom", name: "Bottom", color: "#FFFA28FF", mask: 15, flag: 2, icon: "0000000000FFFFFF", multi: true },
  { key: "left", name: "Left", color: "#FA28FAFF", mask: 15, flag: 4, icon: "E0E0E0E0E0E0E0E0", multi: true },
  { key: "right", name: "Right", color: "#28FAFAFF", mask: 15, flag: 8, icon: "0707070707070707", multi: true },
];
const withMask = (defs: CollisionTileDef[], mask: number) => defs.map((def) => ({ ...def, mask }));

/** GB Studio's built-in scene types and their collision tiles (scene `type` → definitions). */
export const SCENE_TYPE_COLLISIONS: Record<string, CollisionTileDef[]> = {
  TOPDOWN: SIDES,
  SHMUP: SIDES,
  PLATFORM: [
    ...SIDES,
    { key: "ladder", name: "Ladder", color: "#008000FF", mask: 240, flag: 16, icon: "667E7E66667E7E66", group: "prop" },
    { key: "slope_45_right", name: "Slope 45° right", color: "#0000FFFF", mask: 240, flag: 32, icon: "0103070F1F3F7FFF", group: "slope" },
    { key: "slope_45_left", name: "Slope 45° left", color: "#0000FFFF", mask: 240, flag: 48, icon: "80C0E0F0F8FCFEFF", group: "slope" },
    { key: "slope_22_right_bot", name: "Slope 22° right, low", color: "#0000FFFF", mask: 240, flag: 64, icon: "00000000030F3FFF", group: "slope" },
    { key: "slope_22_right_top", name: "Slope 22° right, high", color: "#0000FFFF", mask: 240, flag: 96, icon: "030F3FFF00000000", group: "slope" },
    { key: "slope_22_left_top", name: "Slope 22° left, high", color: "#0000FFFF", mask: 240, flag: 112, icon: "C0F0FCFF00000000", group: "slope" },
    { key: "slope_22_left_bot", name: "Slope 22° left, low", color: "#0000FFFF", mask: 240, flag: 80, icon: "00000000C0F0FCFF", group: "slope" },
  ],
  ADVENTURE: [
    ...withMask(SIDES, 31),
    { key: "slope_tl", name: "Corner, top left", color: "#0000FFFF", mask: 31, flag: 21, icon: "0F3F7F7FFCF8F0F0", group: "corner" },
    { key: "slope_tr", name: "Corner, top right", color: "#0000FFFF", mask: 31, flag: 25, icon: "F0FCFEFE3F1F0F0F", group: "corner" },
    { key: "slope_bl", name: "Corner, bottom left", color: "#0000FFFF", mask: 31, flag: 22, icon: "F0F0F8FC7F7F3F0F", group: "corner" },
    { key: "slope_br", name: "Corner, bottom right", color: "#0000FFFF", mask: 31, flag: 26, icon: "0F0F1F3FFEFEFCF0", group: "corner" },
  ],
  POINTNCLICK: [SIDES[0]],
  LOGO: [SIDES[0]],
};
/** Scene types GB Studio doesn't list draw with the plain sides, as GB Studio does. */
export const DEFAULT_COLLISIONS = SIDES;

/** GB Studio's matching rule (isCollisionTileActive): does `value` show this definition? */
export function collisionMatches(value: number, def: CollisionTileDef, defs: readonly CollisionTileDef[]): boolean {
  const mask = def.mask || 0xff;
  const masked = value & mask;
  const exact = defs.find((other) => other.flag === (value & (other.mask ?? 0xff)));
  if (def === exact) return true;
  if (exact) return false;
  if (def.multi) return masked !== mask && (masked & def.flag) !== 0;
  return masked === def.flag;
}

/** The definitions a value shows, and whatever bits none of them explains (GB Studio writes those as hex). */
export function collisionLook(value: number, defs: readonly CollisionTileDef[]): { shown: CollisionTileDef[]; unknown: boolean } {
  let rest = value;
  const shown: CollisionTileDef[] = [];
  let unknown = value !== 0;
  for (const def of defs) {
    if (!collisionMatches(rest, def, defs)) continue;
    shown.push(def);
    if (def.icon) unknown = false;
    rest &= ~def.flag;
  }
  return { shown, unknown };
}

/** GB Studio's brush: the tile keeps its bits outside `mask` and takes `value`'s bits inside it. */
export const paintCollision = (old: number, value: number, mask: number) => ((old & ~mask) | (value & mask)) & 0xff;

/** What a brush of one or more definitions writes: their flags together, under their mask (an eraser clears all). */
export function collisionBrush(picked: readonly CollisionTileDef[]): { value: number; mask: number } {
  if (!picked.length) return { value: 0, mask: 0xff };
  return { value: picked.reduce((bits, def) => bits | def.flag, 0), mask: picked.reduce((bits, def) => bits | (def.mask ?? 0xff), 0) };
}

/** The icon's 64 pixels (true: drawn), for drawing it at any size. */
export function iconPixels(icon: string | undefined): boolean[] {
  const bits = (icon ?? "FFFFFFFFFFFFFFFF").split("").map((digit) => parseInt(digit, 16).toString(2).padStart(4, "0")).join("");
  return Array.from({ length: 64 }, (_, at) => bits[at] === "1");
}
