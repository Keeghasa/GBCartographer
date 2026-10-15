/**
 * The graphics library (2026-10-10): placeholder art for everything a GB Studio game needs to start, to paint over
 * in your own way. All drawn here in code (the author's, CC0), nothing copied: people, creatures, things, emotes,
 * avatars, the UI frame and cursor, tile sheets and whole scenes. Each asset knows its GB Studio kind, so the store
 * can put it in a project's assets/<kind>/ as a new PNG (sprites in the classic 16-pixel-tall layout, which GB Studio
 * animates by itself). Later: auto-tiles and animated tiles (water, flowers).
 */
import { AUTHOR_CREDIT, type WireAsset } from "./types";
import { FONTS } from "./fonts";
import { scenes, tileSheet, ui, villageMap, villageScreen } from "./scenes";
import { animated, avatar, emote, emotes, things, walker, type Look } from "./sprites";
import { INDOOR, OUTDOOR, SIDE } from "./tiles";
import { pieces } from "./pieces";
import { APPROVED, TEMP_ASSETS } from "./temp";
import { AUTHORED } from "./authored";
import { CAVE_DEFAULTS, drawCave } from "../app/generators";
import { OPENGAMEART } from "./opengameart";
import { setCatalogArt } from "./areas";
import { CLEAR, canvas, type Canvas } from "./pen";
import { acrossTemplate, animTemplate, flowerTileTemplate, atlasWaterTemplate, boxTemplate, cornerTemplate, downTemplate, edgesTemplate, pathTemplate, roadTemplate, shoreTemplate, wallFaceTemplate, wangTemplate, xpCliffTemplate, xpGroundTemplate, xpWaterTemplate } from "./autotiles";

export type { WireAsset };

const PEOPLE: [string, string, Look][] = [
  ["hero", "Hero", { hat: "cap", shirt: 2 }],
  ["villager", "Townsfolk", { hair: 2, shirt: 1 }],
  ["traveler", "Traveler", { hat: "hood", shirt: 2 }],
];

const WALKS = "Six frames: down, down step, up, up step, right, right step (GB Studio sets up walking in four directions; left is right flipped).";
const LOOP = (frames: number) => `${frames} frames, one looping animation.`;
const TWO = (a: string, b: string) => `Two frames: ${a}, ${b} (one animation; pick a frame from an event).`;

/** Taken out at the author's word (2026-10-13: what they hid in the Asset Catalog project, they didn't like). */
const DROPPED = new Set(["person-villager", "person-traveler", "thing-bullet", "thing-bush", "thing-coinStill", "thing-crate", "thing-potion", "anim-chest", "anim-checkbox",
  // Deleted by the author in the Asset Catalog project (2026-10-13).
  "scene-menu", "scene-house", "scene-shop", "scene-cave", "scene-overworld", "scene-battle", "scene-dialogue", "scene-room",
  // The village came back remade after the author's Town (2026-10-13).
  // Unticked in the shipped-art review (the author, 2026-10-13).
  "piece-mound", "autotile-wallface", "pat-sand", "pat-water",
  // One Wang sheet, not two (the author, 2026-10-13): Wang (W) does what Wang edges did and more; Corner Wang (C) stays.
  "autotile-edges",
  // Taken out at the author's word (2026-10-13).
  "tiles-indoor"]);

/** A picture from the author's rows (src/graphics/authored.ts). */
function fromAuthored(rows: readonly string[]): Canvas {
  const out = canvas(rows[0].length, rows.length, CLEAR);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") out.pixels[y * out.width + x] = Number(ch); }));
  return out;
}

const ALL: WireAsset[] = [
  ...PEOPLE.map(([id, name, look]): WireAsset => ({ id: `person-${id}`, name, group: "People", kind: "sprites", about: WALKS, make: () => walker(look) })),
  ...Object.entries(things).map(([id, make]): WireAsset => ({ id: `thing-${id}`, name: ({ coinStill: "Coin", bullet: "Bullet" } as Record<string, string>)[id] ?? id[0].toUpperCase() + id.slice(1), group: "Things", kind: "sprites", about: "One frame.", make })),
  ...Object.entries(animated).map(([id, make]): WireAsset => {
    const names: Record<string, [string, string]> = { chest: ["Chest", TWO("closed", "open")], door: ["Door", TWO("closed", "open")], lever: ["Lever", TWO("left", "right")], switch: ["Switch", TWO("up", "pressed")], checkbox: ["Checkbox", TWO("empty", "ticked")], coin: ["Spinning coin", LOOP(4)], sparkle: ["Sparkle", LOOP(4)], explosion: ["Explosion", LOOP(4)] };
    return { id: `anim-${id}`, name: names[id]?.[0] ?? id, group: "Animated things", kind: "sprites", about: names[id]?.[1], make };
  }),
  ...Object.entries(emotes).map(([id, { name }]): WireAsset => ({ id: `emote-${id}`, name, group: "Emotes", kind: "emotes", about: "16 × 16, shown above an actor's head.", make: () => emote(id) })),
  ...[...PEOPLE.map(([id, name, look]) => [id, name, look] as const), ["mystery", "Mystery", "mystery"] as const]
    // The hero's and the townsfolk's faces trade names (the author, 2026-10-13: the graphics suit the other name).
    .map(([id, name, look]): WireAsset => ({ id: `avatar-${id}`, name: ({ hero: "Townsfolk", villager: "Hero" } as Record<string, string>)[id] ?? name, group: "Avatars", kind: "avatars", about: "16 × 16 face for dialogue boxes.", make: () => avatar(look) })),
  { id: "ui-frame-round", name: "Frame (rounded)", group: "UI", kind: "ui", about: "GB Studio's window frame: 24 × 24, cut in 8 × 8 corners, edges and middle. It reads ui/frame.png.", make: ui.frameRound },
  { id: "ui-frame-double", name: "Frame (double line)", group: "UI", kind: "ui", about: "A window frame (ui/frame.png).", make: ui.frameDouble },
  { id: "ui-frame-thick", name: "Frame (thick)", group: "UI", kind: "ui", about: "A window frame (ui/frame.png).", make: ui.frameThick },
  { id: "ui-frame-dark", name: "Frame (dark)", group: "UI", kind: "ui", about: "A dark window frame (ui/frame.png).", make: ui.frameDark },
  { id: "ui-cursor-arrow", name: "Cursor (arrow)", group: "UI", kind: "ui", about: "The 8 × 8 menu cursor (ui/cursor.png).", make: ui.cursorArrow },
  { id: "ui-cursor-dot", name: "Cursor (dot)", group: "UI", kind: "ui", about: "The 8 × 8 menu cursor (ui/cursor.png).", make: ui.cursorDot },
  // The fonts (2026-10-13), both CC0; see src/graphics/fonts.ts for their makers.
  { id: "font-public-pixel", name: "Public Pixel", group: "Fonts", kind: "fonts", credit: { author: "GGBotNet (font), Santiago Crespo (GB Studio sheet)", license: "CC0", source: "https://santiagocrespo.itch.io/public-pixel-for-gbs" }, about: "8 × 8 capitals and lowercase, fixed width. The font by GGBotNet, the GB Studio sheet by Santiago Crespo; both CC0.", make: () => fromAuthored(FONTS["public-pixel"]) },
  { id: "font-varigram", name: "Varigram", group: "Fonts", kind: "fonts", credit: { author: "Keegan, from monogram by datagoblin", license: "CC0", source: "https://datagoblin.itch.io/monogram" }, about: "A small, very readable font, variable width (magenta marks each letter's unused columns). Made from monogram by datagoblin (CC0).", make: () => fromAuthored(FONTS.varigram) },
  { id: "tiles-outdoor", name: "Outdoor tiles", group: "Tile sheets", kind: "tilesets", about: `${Object.keys(OUTDOOR).length} tiles of 16 × 16 (the tall oaks and pines 16 × 32): grass, paths, water, trees, roofs and walls…`, make: () => tileSheet(Object.keys(OUTDOOR)) },
  { id: "tiles-indoor", name: "Indoor tiles", group: "Tile sheets", kind: "tilesets", about: `${Object.keys(INDOOR).length} tiles: floors, walls, furniture.`, make: () => tileSheet(Object.keys(INDOOR)) },
  { id: "tiles-side", name: "Side-view tiles", group: "Tile sheets", kind: "tilesets", about: `${Object.keys(SIDE).length} tiles for platformers: ground, platforms, ladders.`, make: () => tileSheet(Object.keys(SIDE)) },
  { id: "autotile-box", name: "9-slice box", group: "Auto-tiles", kind: "stamps", autotile: "box", about: "A 3 × 3-tile stamp template: drag a rectangle and it stretches (corners, edges, middle). Repaint it as your own box, wall or window.", make: boxTemplate },
  { id: "autotile-wang", name: "Wang (47)", group: "Auto-tiles", kind: "stamps", autotile: "wang", about: "The 47-tile Wang (blob) sheet, 8 × 6 tiles: paint tiles with it and each fits its neighbours. Placeholder walls to repaint as real art.", make: wangTemplate },
  { id: "autotile-across", name: "Fence style", group: "Auto-tiles", kind: "stamps", autotile: "across", about: "A fence, 3 × 2 tiles: drag a line and the posts cap the ends while the rails repeat. Repaint as a bridge, shelf or platform.", make: acrossTemplate },
  { id: "autotile-down", name: "Ladder style", group: "Auto-tiles", kind: "stamps", autotile: "down", about: "A ladder, 2 × 3 tiles: drag down and the top and foot cap the ends while the rungs repeat. Repaint as a pillar, vine or waterfall.", make: downTemplate },
  { id: "autotile-path", name: "Road", group: "Auto-tiles", kind: "stamps", autotile: "path", about: "16 tiles, 4 × 4: a road joining up, down, left and right (mask N 1, E 2, S 4, W 8; column mask % 4, row mask / 4). Repaint as a river, rail or fence.", make: pathTemplate },
  { id: "autotile-edges", name: "Wang edges (E)", group: "Auto-tiles", kind: "stamps", autotile: "edges", about: "16 tiles, 4 × 4: a wall outlined on its open sides (no inner corners). Repaint as water, hedges or paths.", make: edgesTemplate },
  { id: "autotile-corner", name: "Corner Wang", group: "Auto-tiles", kind: "stamps", autotile: "corner", about: "16 tiles, 4 × 4: grass and water by corner (NW 1, NE 2, SW 4, SE 8 is water). Paint at the grid's corners and the shore draws itself. Repaint as any two grounds.", make: cornerTemplate },
  { id: "autotile-shore", name: "Overworld shore", group: "Auto-tiles", kind: "stamps", autotile: "corner", about: "16 tiles, 4 × 4, in the overworld's look: grass and water by corner with a dark shoreline. The overworld generator's Shores draws its water with it; paint shores by hand at the grid's corners.", make: shoreTemplate },
  { id: "autotile-road", name: "Overworld road", group: "Auto-tiles", kind: "stamps", autotile: "path", about: "16 tiles, 4 × 4, in the overworld's look: a dirt road joining up, down, left and right. The overworld generator's Roads draws its roads with it.", make: roadTemplate },
  { id: "autotile-wallface", name: "Wall face (F)", group: "Auto-tiles", kind: "stamps", autotile: "wallface", about: "4 × 2 tiles: floor and nothing, then the wall's face (middle, left end, right end, both ends), no top. Paint floor and the face grows above it.", make: wallFaceTemplate },
  { id: "xp-ground", name: "Ground XP", group: "Outdoor pieces", kind: "stamps", autotile: "xp", about: "48 × 64, RPG Maker XP's layout: a lone patch, the inner corners and a 3 × 3 block. Paint 16 px cells: edges, corners and inner corners fit. Repaint as sand, dirt, snow or carpet.", make: xpGroundTemplate },
  { id: "xp-water", name: "Water XP", group: "Outdoor pieces", kind: "stamps", autotile: "xpAnim", about: "144 × 64: the XP block in three animation frames, a dark shore with foam inside. Paint 16 px cells; the picture plays the frames while it is in hand. Save writes frame 1.", make: xpWaterTemplate },
  { id: "xp-cliff", name: "Cliff XP", group: "Outdoor pieces", kind: "stamps", autotile: "xpCliff", about: "48 × 80: a grassy plateau whose bottom cells become the rock face, sides running down beside a face, inside corners and a lone mound. Paint 16 px cells.", make: xpCliffTemplate },
  // The author's own (2026-10-14), drawn in the Asset Catalog project: the dungeon wizard's walls.
  { id: "piece-room-border", name: "Room Border", group: "Outdoor pieces", kind: "stamps", autotile: "xp", about: "48 × 64 in the XP layout: dark walls outlined where they meet the floor. Paint 16 px cells; the Cave or dungeon wizard builds dungeons with it.", make: xpGroundTemplate },
  { id: "piece-pines", name: "Pine forest", group: "Outdoor pieces", kind: "stamps", autotile: "forest", about: "64 × 32: a clump of three pines and one pine on its own. Paint in 32 px tree units: the clump inside the forest, single pines along its edge.", make: pieces.pines },
  { id: "piece-round-trees", name: "Round forest", group: "Outdoor pieces", kind: "stamps", autotile: "forest", about: "64 × 32: a clump of three round trees and one on its own. Paint in 32 px tree units: the clump inside, single trees along the edge.", make: pieces.roundTrees },
  { id: "piece-water", name: "Water", group: "Outdoor pieces", kind: "stamps", autotile: "atlasAnim", about: "96 × 48: a 2 × 3 water block in three animation frames, in the ledge's style (rounded corners, a dark outline with foam inside). Paint 16 px cells: shores fit; the picture plays the frames while it is in hand. Save writes frame 1.", make: atlasWaterTemplate },
  { id: "piece-mound", name: "Mound ledge", group: "Outdoor pieces", kind: "stamps", autotile: "mound", about: "48 × 64: the ledge as an auto-tile. Paint 16 px cells: a plateau with a rounded top plate; the rock face grows under its bottom edge and a rock column up its sides.", make: pieces.moundSheet },
  { id: "autotile-anim", name: "Animated tile", group: "Auto-tiles", kind: "stamps", autotile: "anim", about: "Flowers swaying in four 16 × 16 frames side by side: stamps the first frame; the card plays them. Repaint as torches or lava.", make: animTemplate },
  { id: "autotile-anim-flower", name: "Animated flower", group: "Auto-tiles", kind: "stamps", autotile: "anim", about: "One flower in one 8 × 8 tile, swaying over four frames side by side.", make: flowerTileTemplate },
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
  // A sample of each map the cave wizard makes (the author, 2026-10-14), one screen each, so the catalog shows them.
  { id: "gen-cave", name: "Cave (generated)", group: "Generated maps", kind: "backgrounds", about: "One screen from the Cave or dungeon wizard: a cave in Cliff XP's 32 px walls. The wizard makes more, any size.", make: () => drawCave({ ...CAVE_DEFAULTS, columns: 1, rows: 1, seed: 8, fill: 50 }) },
  { id: "gen-dungeon", name: "Dungeon (generated)", group: "Generated maps", kind: "backgrounds", about: "One screen from the Cave or dungeon wizard: rooms and corridors walled with Room Border.", make: () => drawCave({ ...CAVE_DEFAULTS, style: "dungeon", columns: 1, rows: 1, seed: 4, rooms: 5, roomSize: 4 }) },
  { id: "gen-forest", name: "Forest (generated)", group: "Generated maps", kind: "backgrounds", about: "One screen from the Cave or dungeon wizard with forest walls: clearings among pines.", make: () => drawCave({ ...CAVE_DEFAULTS, columns: 1, rows: 1, seed: 3, walls: "pines" }) },
  { id: "scene-room", name: "Point-and-click room", group: "Scenes", kind: "backgrounds", make: scenes.room },
  // The temp assets the author approved (swipe review, 2026-10-13): XP area auto-tiles and seamless patterns.
  ...TEMP_ASSETS.filter((asset) => APPROVED.has(asset.id)).map((asset): WireAsset => ({ id: asset.id, name: asset.name, group: asset.family === "xp" ? "XP auto-tiles" : "Patterns", kind: "stamps", about: asset.about, make: asset.make, ...(asset.autotile ? { autotile: asset.autotile } : {}) })),
  // CC0 packs from OpenGameArt (the author's pick, 2026-10-14), each piece credited to its maker.
  ...OPENGAMEART.map(({ rows, ...piece }): WireAsset => ({ ...piece, make: () => fromAuthored(rows) })),
];

/** The catalog: the author's hand-edited versions (from the Asset Catalog project) in place of the code-drawn art. */
/** A graphic as the code draws it, before any hand edit (scripts/import-authored.ts skips files that match it). */
export const codeDrawn = (id: string): Canvas | null => ALL.find((asset) => asset.id === id)?.make() ?? null;
const CATALOG: WireAsset[] = ALL.filter((asset) => !DROPPED.has(asset.id)).map((asset) => AUTHORED[asset.id] ? { ...asset, make: () => fromAuthored(AUTHORED[asset.id]) } : asset);
/**
 * The window frames as 9-slice auto-tiles too (the author, 2026-10-13): GB Studio's frame is the Box (9) layout, 24 × 24
 * in 8 × 8 corners, edges and middle, so each frame (the author's edits included) doubles as a box stamp.
 */
const FRAME_BOXES: WireAsset[] = CATALOG.filter((asset) => asset.id.startsWith("ui-frame-")).map((frame) => ({
  id: `box-${frame.id.slice(3)}`, name: `${frame.name} 9-slice`, group: "Auto-tiles", kind: "stamps", autotile: "box",
  about: `${frame.name} as a 9-slice box: drag it to any size, the corners stay, the edges and middle repeat.`, make: frame.make,
}));
export const GRAPHICS: WireAsset[] = [...CATALOG, ...FRAME_BOXES];

// The wizards, the village and the tile sheets draw with the catalog's versions (the author's edits) of the sheets.
setCatalogArt((id) => GRAPHICS.find((asset) => asset.id === id)?.make() ?? null);

/** Who made a project picture that came from the catalog (matched by kind and name; null when it's not a catalog piece). */
const CREDITS = new Map(GRAPHICS.map((asset) => [`${asset.kind}/${asset.name.toLowerCase()}`, asset.credit ?? AUTHOR_CREDIT]));
export const catalogCredit = (kind: string, name: string) => CREDITS.get(`${kind}/${name.toLowerCase()}`) ?? null;

export const GRAPHIC_GROUPS = [...new Set(GRAPHICS.map((asset) => asset.group))];
