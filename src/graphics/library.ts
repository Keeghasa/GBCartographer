/**
 * The graphics library (2026-10-10): placeholder art for everything a GB Studio game needs to start, to paint over
 * in your own way. All drawn here in code (the author's, CC0), nothing copied: people, creatures, things, emotes,
 * avatars, the UI frame and cursor, tile sheets and whole scenes. Each asset knows its GB Studio kind, so the store
 * can put it in a project's assets/<kind>/ as a new PNG (sprites in the classic 16-pixel-tall layout, which GB Studio
 * animates by itself). Later: auto-tiles and animated tiles (water, flowers).
 */
import type { WireAsset } from "./types";
import { scenes, tileSheet, ui, villageMap, villageScreen } from "./scenes";
import { animated, avatar, emote, emotes, things, walker, type Look } from "./sprites";
import { INDOOR, OUTDOOR, SIDE } from "./tiles";
import { acrossTemplate, animTemplate, boxTemplate, cornerTemplate, downTemplate, edgesTemplate, pathTemplate, wallFaceTemplate, wangTemplate } from "./autotiles";

export type { WireAsset };

const PEOPLE: [string, string, Look][] = [
  ["hero", "Hero", { hat: "cap", shirt: 2 }],
  ["villager", "Villager", { hair: 2, shirt: 1 }],
  ["traveler", "Traveler", { hat: "hood", shirt: 2 }],
];

const WALKS = "Six frames: down, down step, up, up step, right, right step (GB Studio sets up walking in four directions; left is right flipped).";
const LOOP = (frames: number) => `${frames} frames, one looping animation.`;
const TWO = (a: string, b: string) => `Two frames: ${a}, ${b} (one animation; pick a frame from an event).`;

export const GRAPHICS: WireAsset[] = [
  ...PEOPLE.map(([id, name, look]): WireAsset => ({ id: `person-${id}`, name, group: "People", kind: "sprites", about: WALKS, make: () => walker(look) })),
  ...Object.entries(things).map(([id, make]): WireAsset => ({ id: `thing-${id}`, name: ({ coinStill: "Coin", bullet: "Bullet" } as Record<string, string>)[id] ?? id[0].toUpperCase() + id.slice(1), group: "Things", kind: "sprites", about: "One frame.", make })),
  ...Object.entries(animated).map(([id, make]): WireAsset => {
    const names: Record<string, [string, string]> = { chest: ["Chest", TWO("closed", "open")], door: ["Door", TWO("closed", "open")], lever: ["Lever", TWO("left", "right")], switch: ["Switch", TWO("up", "pressed")], checkbox: ["Checkbox", TWO("empty", "ticked")], coin: ["Spinning coin", LOOP(4)], sparkle: ["Sparkle", LOOP(4)], explosion: ["Explosion", LOOP(4)] };
    return { id: `anim-${id}`, name: names[id]?.[0] ?? id, group: "Animated things", kind: "sprites", about: names[id]?.[1], make };
  }),
  ...Object.entries(emotes).map(([id, { name }]): WireAsset => ({ id: `emote-${id}`, name, group: "Emotes", kind: "emotes", about: "16 × 16, shown above an actor's head.", make: () => emote(id) })),
  ...[...PEOPLE.map(([id, name, look]) => [id, name, look] as const), ["mystery", "Mystery", "mystery"] as const]
    .map(([id, name, look]): WireAsset => ({ id: `avatar-${id}`, name, group: "Avatars", kind: "avatars", about: "16 × 16 face for dialogue boxes.", make: () => avatar(look) })),
  { id: "ui-frame-round", name: "Frame (rounded)", group: "UI", kind: "ui", about: "GB Studio's window frame: 24 × 24, cut in 8 × 8 corners, edges and middle. It reads ui/frame.png.", make: ui.frameRound },
  { id: "ui-frame-double", name: "Frame (double line)", group: "UI", kind: "ui", about: "A window frame (ui/frame.png).", make: ui.frameDouble },
  { id: "ui-frame-thick", name: "Frame (thick)", group: "UI", kind: "ui", about: "A window frame (ui/frame.png).", make: ui.frameThick },
  { id: "ui-frame-dark", name: "Frame (dark)", group: "UI", kind: "ui", about: "A dark window frame (ui/frame.png).", make: ui.frameDark },
  { id: "ui-cursor-arrow", name: "Cursor (arrow)", group: "UI", kind: "ui", about: "The 8 × 8 menu cursor (ui/cursor.png).", make: ui.cursorArrow },
  { id: "ui-cursor-dot", name: "Cursor (dot)", group: "UI", kind: "ui", about: "The 8 × 8 menu cursor (ui/cursor.png).", make: ui.cursorDot },
  { id: "tiles-outdoor", name: "Outdoor tiles", group: "Tile sheets", kind: "tilesets", about: `${Object.keys(OUTDOOR).length} tiles of 16 × 16 (the tall oaks and pines 16 × 32): grass, paths, water, trees, roofs and walls…`, make: () => tileSheet(Object.keys(OUTDOOR)) },
  { id: "tiles-indoor", name: "Indoor tiles", group: "Tile sheets", kind: "tilesets", about: `${Object.keys(INDOOR).length} tiles: floors, walls, furniture.`, make: () => tileSheet(Object.keys(INDOOR)) },
  { id: "tiles-side", name: "Side-view tiles", group: "Tile sheets", kind: "tilesets", about: `${Object.keys(SIDE).length} tiles for platformers: ground, platforms, ladders.`, make: () => tileSheet(Object.keys(SIDE)) },
  { id: "autotile-box", name: "Box auto-tile (9)", group: "Auto-tiles", kind: "stamps", autotile: "box", about: "A 3 × 3-tile stamp template: drag a rectangle and it stretches (corners, edges, middle). Repaint it as your own box, wall or window.", make: boxTemplate },
  { id: "autotile-wang", name: "Wang auto-tile (W)", group: "Auto-tiles", kind: "stamps", autotile: "wang", about: "The 47-tile Wang (blob) sheet, 8 × 6 tiles: paint tiles with it and each fits its neighbours. Placeholder walls to repaint as real art.", make: wangTemplate },
  { id: "autotile-across", name: "3-slice across (↔)", group: "Auto-tiles", kind: "stamps", autotile: "across", about: "A fence, 3 × 2 tiles: drag a line and the posts cap the ends while the rails repeat. Repaint as a bridge, shelf or platform.", make: acrossTemplate },
  { id: "autotile-down", name: "3-slice down (↕)", group: "Auto-tiles", kind: "stamps", autotile: "down", about: "A ladder, 2 × 3 tiles: drag down and the top and foot cap the ends while the rungs repeat. Repaint as a pillar, vine or waterfall.", make: downTemplate },
  { id: "autotile-path", name: "Path (P)", group: "Auto-tiles", kind: "stamps", autotile: "path", about: "16 tiles, 4 × 4: a road joining up, down, left and right (mask N 1, E 2, S 4, W 8; column mask % 4, row mask / 4). Repaint as a river, rail or fence.", make: pathTemplate },
  { id: "autotile-edges", name: "Wang edges (E)", group: "Auto-tiles", kind: "stamps", autotile: "edges", about: "16 tiles, 4 × 4: a wall outlined on its open sides (no inner corners). Repaint as water, hedges or paths.", make: edgesTemplate },
  { id: "autotile-corner", name: "Corner Wang (C)", group: "Auto-tiles", kind: "stamps", autotile: "corner", about: "16 tiles, 4 × 4: grass and water by corner (NW 1, NE 2, SW 4, SE 8 is water). Paint at the grid's corners and the shore draws itself. Repaint as any two grounds.", make: cornerTemplate },
  { id: "autotile-wallface", name: "Wall face (F)", group: "Auto-tiles", kind: "stamps", autotile: "wallface", about: "4 × 3 tiles: floor and nothing, then the upper and lower wall rows (middle, left end, right end, both ends). Paint floor and the walls grow above it.", make: wallFaceTemplate },
  { id: "autotile-anim", name: "Animated tile (▶)", group: "Auto-tiles", kind: "stamps", autotile: "anim", about: "Water in four 8 × 8 frames side by side: stamps the first frame; the card plays them. Repaint as flowers, torches or lava.", make: animTemplate },
  { id: "scene-title", name: "Title screen", group: "Scenes", kind: "backgrounds", make: scenes.title },
  { id: "scene-logo", name: "Logo splash", group: "Scenes", kind: "backgrounds", make: scenes.logo },
  { id: "scene-menu", name: "Menu", group: "Scenes", kind: "backgrounds", make: scenes.menu },
  { id: "scene-town", name: "Town", group: "Scenes", kind: "backgrounds", about: "2 × 2 screens.", make: scenes.town },
  { id: "scene-house", name: "House", group: "Scenes", kind: "backgrounds", make: scenes.house },
  { id: "scene-shop", name: "Shop", group: "Scenes", kind: "backgrounds", make: scenes.shop },
  { id: "scene-cave", name: "Cave", group: "Scenes", kind: "backgrounds", about: "2 × 2 screens (the cave generator makes more).", make: scenes.cave },
  { id: "scene-overworld", name: "Overworld", group: "Scenes", kind: "backgrounds", about: "3 × 3 screens (the overworld generator makes more).", make: scenes.overworld },
  { id: "scene-level", name: "Platformer level", group: "Scenes", kind: "backgrounds", about: "3 screens wide.", make: scenes.level },
  { id: "scene-battle", name: "Battle screen", group: "Scenes", kind: "backgrounds", make: scenes.battle },
  { id: "scene-dialogue", name: "Dialogue", group: "Scenes", kind: "backgrounds", about: "The village's first screen with a dialogue box.", make: scenes.dialogue },
  { id: "scene-village", name: "Village (whole)", group: "Map screens", kind: "backgrounds", about: "The whole village, 480 × 288, before it is cut into screens.", make: villageMap },
  ...[0, 1].flatMap((row) => [0, 1, 2].map((column): WireAsset => ({ id: `village-${column}-${row}`, name: `Village ${column + 1}-${row + 1}`, group: "Map screens", kind: "backgrounds", about: `Screen ${column + 1} of 3 across, ${row + 1} of 2 down. Neighbours share their edge tiles, so they join in the Map Room.`, make: () => villageScreen(column, row) }))),
  { id: "scene-room", name: "Point-and-click room", group: "Scenes", kind: "backgrounds", make: scenes.room },
];

export const GRAPHIC_GROUPS = [...new Set(GRAPHICS.map((asset) => asset.group))];
