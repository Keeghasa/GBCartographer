/**
 * Palette themes for the map generators (2026-10-10): which library palettes a generated map wears. An overworld
 * theme has seven palettes, one per terrain (grass, forest, mountain, water, shore, road, town), every terrain on
 * grass sharing shade 0 so cells meet cleanly; or one palette for the whole map. A cave theme is one palette (floor
 * shade 0, rock shades 2–3). The SpicyGame themes (public domain) use only that set's own colors, arranged by terrain.
 */
import library from "../palettes/library.json";

export interface MapPalette { name: string; colors: string[] }
export interface MapTheme { id: string; name: string; /** Who the colors are by, and their license. */ credit: string; palettes: MapPalette[] }

const named = (name: string): MapPalette | null => {
  for (const collection of library.collections) for (const palette of collection.palettes) if (palette.name === name) return { name, colors: [...palette.colors] };
  return null;
};
const terrains = (base: string, sets: string[][]): MapPalette[] => ["Grass", "Forest", "Mountain", "Water", "Shore", "Road", "Town"].map((terrain, at) => ({ name: `${base} ${terrain}`, colors: sets[at] }));
const SPICY = "SpicyGame, public domain";

/** The author's Overworld set, as it is in the library. */
export const OVERWORLD_PALETTES: MapPalette[] = (library.collections.find((group) => group.name === "Overworld")?.palettes ?? []).map(({ name, colors }) => ({ name, colors: [...colors] }));

export const WORLD_THEMES: MapTheme[] = [
  { id: "overworld", name: "Overworld", credit: "Keegan, CC0", palettes: OVERWORLD_PALETTES },
  { id: "vibe20", name: "VIBE-20", credit: SPICY, palettes: terrains("VIBE-20", [
    ["#43BD35", "#007A49", "#3E4A6D", "#1C162D"],
    ["#43BD35", "#A7FF19", "#007A49", "#1C162D"],
    ["#43BD35", "#96A3B0", "#5A7088", "#1C162D"],
    ["#FFEEE5", "#0099DB", "#124E89", "#1C162D"],
    ["#FFD09C", "#B94F38", "#0099DB", "#1C162D"],
    ["#43BD35", "#FFD09C", "#B94F38", "#1C162D"],
    ["#43BD35", "#FFEEE5", "#DA2424", "#1C162D"],
  ]) },
  { id: "vibrant14", name: "Vibrant-14", credit: SPICY, palettes: terrains("Vibrant-14", [
    ["#43BD35", "#07E5A0", "#124E89", "#1C162D"],
    ["#43BD35", "#07E5A0", "#124E89", "#1C162D"],
    ["#43BD35", "#5A7088", "#3E4A6D", "#1C162D"],
    ["#FFEEE5", "#0099DB", "#124E89", "#1C162D"],
    ["#FEE761", "#ECAB11", "#0099DB", "#1C162D"],
    ["#43BD35", "#FEE761", "#ECAB11", "#1C162D"],
    ["#43BD35", "#FFEEE5", "#DA2424", "#1C162D"],
  ]) },
  // The biomes' own palettes (the author, 2026-11-02: desert, snow, swamp), invented here for GB Cartographer, CC0.
  { id: "biome-desert", name: "Desert", credit: "GB Cartographer, CC0", palettes: terrains("Desert", [
    ["#F2E2B0", "#D9B878", "#A8784A", "#3A2218"],
    ["#F2E2B0", "#8FB060", "#4E7A44", "#3A2218"],
    ["#F2E2B0", "#D88A5A", "#9A4A36", "#3A1A20"],
    ["#E8F6EA", "#58BCC0", "#2E7C9C", "#14243A"],
    ["#FFF0C8", "#E2C68E", "#58BCC0", "#14243A"],
    ["#F2E2B0", "#C89E68", "#8A6040", "#3A2218"],
    ["#F2E2B0", "#FAF0DC", "#C46A3C", "#3A2218"],
  ]) },
  { id: "biome-snow", name: "Snow", credit: "GB Cartographer, CC0", palettes: terrains("Snow", [
    ["#F4F8FC", "#C8D8E8", "#7E96B4", "#1C2438"],
    ["#F4F8FC", "#7AA898", "#3E6A64", "#1C2438"],
    ["#F4F8FC", "#A8B4C8", "#5E6A88", "#20203A"],
    ["#E0F0FA", "#86BEE0", "#3E78B0", "#16204A"],
    ["#F4F8FC", "#D2E2EE", "#86BEE0", "#16204A"],
    ["#F4F8FC", "#C2B4A0", "#7E6A58", "#1C2438"],
    ["#F4F8FC", "#F0E6D8", "#B0484C", "#1C2438"],
  ]) },
  { id: "biome-swamp", name: "Swamp", credit: "GB Cartographer, CC0", palettes: terrains("Swamp", [
    ["#B8C88A", "#8A9E5C", "#56683E", "#1E2414"],
    ["#B8C88A", "#6E8A4C", "#3C5432", "#1E2414"],
    ["#B8C88A", "#9A9070", "#5E5644", "#1E1C18"],
    ["#A8B890", "#6A8A68", "#3E5A4A", "#141E1A"],
    ["#C8C496", "#9E9466", "#6A8A68", "#141E1A"],
    ["#B8C88A", "#A08A60", "#6A5638", "#1E2414"],
    ["#B8C88A", "#E0D8B8", "#8A4A3A", "#1E2414"],
  ]) },
  ...["SG-Winter Forest GB", "SG-Campfire GB"].flatMap((name) => { const palette = named(name); return palette ? [{ id: name, name: name.replace("SG-", ""), credit: SPICY, palettes: [palette] }] : []; }),
];

export const CAVE_THEMES: MapTheme[] = [
  ["V20-5-Stone", "Stone (VIBE-20)", SPICY], ["Vibrant14-5-Stone", "Stone (Vibrant-14)", SPICY], ["SG-Winter Forest GB", "Winter Forest GB", SPICY],
  ["SG-Campfire GB", "Campfire GB", SPICY], ["DWC-1-Cliffs", "Dustwatch cliffs (Chorbi)", "Keegan, CC0"], ["DWC-6-MauveBldg", "Dustwatch mauve (Chorbi)", "Keegan, CC0"],
].flatMap(([palette, name, credit]) => { const found = named(palette); return found ? [{ id: palette, name, credit, palettes: [found] }] : []; });

export const themeOf = (themes: MapTheme[], id: string) => themes.find((theme) => theme.id === id) ?? null;
