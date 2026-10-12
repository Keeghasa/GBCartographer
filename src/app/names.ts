/**
 * Random default names (the author, 2026-10-12): a new thing gets a "Kind-Name" suggestion, like a city builder names
 * a town (Cave-HowlingWinds, Dungeon-WhisperingWoods), editable, with a dice button for another. One word list per
 * kind, all here. No game names. A name already in the project is never suggested again (the file would be a new PNG
 * anyway, never replacing one).
 */
export type NameKind = "Cave" | "Dungeon" | "Background" | "Overworld" | "Stamp" | "Map" | "Palette";

export const NAME_WORDS: Record<NameKind, readonly string[]> = {
  Cave: ["HowlingWinds", "Wintercove", "Mossmouth", "EchoingHollow", "GlimmerDeep", "DrippingDark", "BatwingGrotto", "FrostbiteCavern", "AmberDepths", "SilentSink", "CobwebCrawl", "MurkyMarrow", "CrystalWhisper", "SnailshellDen"],
  Dungeon: ["WhisperingWoods", "DastardlyCaverns", "GloomkeepVaults", "RustyRatsNest", "SunkenCrypt", "MoldyMazes", "ShadowfallKeep", "ClatteringHalls", "BrimstoneBasement", "TwistedTomb", "ForgottenForge", "HauntedHatchery", "GrimGarrison", "CursedCellar"],
  Background: ["SleepyHarbor", "DustyCrossroads", "MarigoldMeadow", "LanternAlley", "CopperHills", "QuietQuay", "FoggyFerry", "PebbleBeach", "MapleHollow", "TinRoofRow", "SaltflatSunrise", "MidnightMarket"],
  Overworld: ["Sunderland", "Emberreach", "Thistlemoor", "GreenwaterIsles", "AshfallVale", "Pinecrest", "DriftwoodCoast", "Bramblewild", "Highmeadow", "StarlitStraits"],
  Stamp: ["LittleOak", "MossyRock", "WobblyFence", "TinyHut", "CrackedWell", "FlowerPatch", "BrokenCart", "StoneArch", "CampfireRing", "ReedBunch"],
  Map: ["HomeValley", "TheLongWalk", "NorthernPass", "MarketTown", "WestwoodTrail", "LakesideLoop", "TheNarrows", "CrossroadsCountry"],
  Palette: ["PeachFizz", "SeaGlass", "MossAndMilk", "CandleSmoke", "BerrySoda", "DesertDusk", "MintChoc", "PlumNight", "ButterToast", "SlateRain"],
};

/**
 * A "Kind-Name" not in `taken` (compared without case), picked by `random` (0 ≤ r < 1). When every word is taken,
 * the words come round again with a number: Cave-Mossmouth 2.
 */
export function randomName(kind: NameKind, taken: Iterable<string> = [], random: () => number = Math.random, not?: string): string {
  const used = new Set([...taken].map((name) => name.toLowerCase()));
  if (not) used.add(not.toLowerCase());
  const words = NAME_WORDS[kind];
  for (let round = 1; round < 1000; round += 1) {
    const free = words.map((word) => `${kind}-${word}${round > 1 ? ` ${round}` : ""}`).filter((name) => !used.has(name.toLowerCase()));
    if (free.length) return free[Math.floor(random() * free.length) % free.length];
  }
  return `${kind}-${Date.now()}`;
}

/** Whether `name` is one of the suggestions for `kind` (so a kind change may swap it for another kind's). */
export const isSuggestedName = (kind: NameKind, name: string) => new RegExp(`^${kind}-(${NAME_WORDS[kind].join("|")})( \\d+)?$`).test(name.trim());
