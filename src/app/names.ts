/**
 * Names for new things (the author, 2026-10-12). By default a new thing is named after its kind and the moment it is
 * made, like "Dungeon-20261012249": the date, then the hour (12-hour, no leading zero) and minute, as the author
 * wrote it. The dice button makes a name from three words after the kind instead, "Dungeon-Cold-Ruins-North",
 * "Cave-Desert-Dunes-Cove": a first word, a place word and a last word, with lists per kind, all here. No game
 * names. A name already in the project is never given again (the file would be a new PNG anyway, never replacing one).
 */
export type NameKind = "Cave" | "Dungeon" | "Background" | "Overworld" | "Stamp" | "Map" | "Palette";

/** Three word lists per kind: the first word, the place, the last word. */
export const NAME_WORDS: Record<NameKind, readonly [readonly string[], readonly string[], readonly string[]]> = {
  Cave: [["Cold", "Damp", "Deep", "Dark", "Echo", "Crystal", "Frost", "Amber", "Mossy", "Silent", "Desert", "Bat"], ["Dunes", "Hollow", "Grotto", "Cavern", "Sink", "Marrow", "Den", "Chasm", "Burrow", "Shelf"], ["Cove", "North", "South", "East", "West", "Mouth", "Pass", "Reach", "Bend", "Drop"]],
  Dungeon: [["Cold", "Cursed", "Grim", "Haunted", "Moldy", "Rusty", "Sunken", "Twisted", "Forgotten", "Shadow", "Brimstone", "Clattering"], ["Ruins", "Crypt", "Keep", "Halls", "Vaults", "Cellar", "Tomb", "Forge", "Garrison", "Maze"], ["North", "South", "East", "West", "Below", "Depths", "Gate", "Heart", "Edge", "End"]],
  Background: [["Sleepy", "Dusty", "Marigold", "Lantern", "Copper", "Quiet", "Foggy", "Pebble", "Maple", "Tin", "Saltflat", "Midnight"], ["Harbor", "Crossroads", "Meadow", "Alley", "Hills", "Quay", "Ferry", "Beach", "Hollow", "Market"], ["Dawn", "Noon", "Dusk", "Rain", "Snow", "Mist", "Wind", "Calm", "Glow", "Fair"]],
  Overworld: [["Sunder", "Ember", "Thistle", "Greenwater", "Ashfall", "Pine", "Driftwood", "Bramble", "High", "Starlit", "Wide", "Lost"], ["Land", "Reach", "Moor", "Isles", "Vale", "Crest", "Coast", "Wild", "Meadow", "Straits"], ["North", "South", "East", "West", "Realm", "Shore", "March", "Ridge", "Crossing", "Expanse"]],
  Stamp: [["Little", "Mossy", "Wobbly", "Tiny", "Cracked", "Flower", "Broken", "Stone", "Campfire", "Reed", "Old", "Round"], ["Oak", "Rock", "Fence", "Hut", "Well", "Patch", "Cart", "Arch", "Ring", "Bunch"], ["One", "Two", "Pair", "Set", "Bit", "Piece", "Prop", "Mark", "Spot", "Thing"]],
  Map: [["Home", "Long", "Northern", "Market", "Westwood", "Lakeside", "Narrow", "Crossroads", "Upper", "Lower", "Green", "Grey"], ["Valley", "Walk", "Pass", "Town", "Trail", "Loop", "Way", "Country", "Fields", "Shore"], ["North", "South", "East", "West", "Route", "Round", "Reach", "Span", "Run", "Stretch"]],
  Palette: [["Peach", "Sea", "Moss", "Candle", "Berry", "Desert", "Mint", "Plum", "Butter", "Slate", "Rose", "Ash"], ["Fizz", "Glass", "Milk", "Smoke", "Soda", "Dusk", "Choc", "Night", "Toast", "Rain"], ["Day", "Dawn", "Dusk", "Night", "Soft", "Deep", "Pale", "Warm", "Cool", "Bright"]],
};

/** A name that `taken` doesn't have (compared without case): `wanted`, else "wanted-2", "wanted-3"… */
function untaken(wanted: string, taken: Iterable<string>, not?: string): string {
  const used = new Set([...taken].map((name) => name.toLowerCase()));
  if (not) used.add(not.toLowerCase());
  let name = wanted;
  for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${wanted}-${n}`;
  return name;
}

/** The moment as the author writes it: "20261012249" (12 October 2026, 2:49; 12-hour, no leading zero on the hour). */
function moment(now: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}${now.getHours() % 12 || 12}${two(now.getMinutes())}`;
}

/** The default name: the kind and the moment, "Dungeon-20261012249" (12 October 2026, 2:49). */
export function defaultName(kind: NameKind, taken: Iterable<string> = [], now: Date = new Date()): string {
  return untaken(`${kind}-${moment(now)}`, taken);
}

/**
 * A copy's name (Duplicate, the author 2026-10-12): the original's name and the moment, "Cave-20261012311"; a copy of
 * a copy swaps the old moment for the new one instead of piling them up ("Cave-20261012311-2" → "Cave-20261012315").
 */
export function copyName(name: string, taken: Iterable<string> = [], now: Date = new Date()): string {
  const base = name.replace(/-\d{9,12}(-\d+)?$/, "") || name;
  return untaken(`${base}-${moment(now)}`, taken);
}

/** A three-word name from the dice: "Cave-Desert-Dunes-Cove", never one in `taken` nor `not` (the name shown now). */
export function randomName(kind: NameKind, taken: Iterable<string> = [], random: () => number = Math.random, not?: string): string {
  const [firsts, places, lasts] = NAME_WORDS[kind];
  const pick = (list: readonly string[]) => list[Math.floor(random() * list.length) % list.length];
  const used = new Set([...taken].map((name) => name.toLowerCase()));
  if (not) used.add(not.toLowerCase());
  for (let tries = 0; tries < 200; tries += 1) {
    const name = `${kind}-${pick(firsts)}-${pick(places)}-${pick(lasts)}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  return untaken(`${kind}-${pick(firsts)}-${pick(places)}-${pick(lasts)}`, taken, not);
}

/** Whether `name` is one this file made for `kind` (a default or a dice name), so a kind change may swap it. */
export const isSuggestedName = (kind: NameKind, name: string) => new RegExp(`^${kind}-(\\d{11,12}|[A-Z][a-z]+-[A-Z][a-z]+-[A-Z][a-z]+)(-\\d+)?$`).test(name.trim());
