/**
 * The stamps' four shelves on the rail (the author, 2026-10-13): Objects (plain stamps: a tree, a house), Repeat
 * tiles (seamless patterns, tagged "pattern"; they open with the seamless 3 × 3 view on), Autotiles (any auto-tile
 * that doesn't play) and Animated tiles (water and anything else that plays its frames).
 */
import type { Asset } from "./model";

export type StampGroup = "objects" | "repeat" | "autotiles" | "animated";
export const STAMP_GROUPS: [StampGroup, string][] = [["objects", "Objects"], ["repeat", "Repeat tiles"], ["autotiles", "Autotiles"], ["animated", "Animated tiles"]];
export const PATTERN_TAG = "pattern";
const ANIMATED = new Set(["anim", "atlasAnim", "xpAnim"]);

export function stampGroup(stamp: Pick<Asset, "autotile" | "tags">): StampGroup {
  if (stamp.autotile && ANIMATED.has(stamp.autotile)) return "animated";
  if (stamp.autotile) return "autotiles";
  return stamp.tags?.includes(PATTERN_TAG) ? "repeat" : "objects";
}
