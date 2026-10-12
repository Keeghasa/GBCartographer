import { describe, expect, it } from "vitest";
import { NAME_WORDS, isSuggestedName, randomName, type NameKind } from "./names";

describe("random names", () => {
  it("names a new thing Kind-Name, file-safe, never one the project has", () => {
    for (const kind of Object.keys(NAME_WORDS) as NameKind[]) {
      const name = randomName(kind);
      expect(name.startsWith(`${kind}-`)).toBe(true);
      expect(/^[\w ()\-.]+$/.test(name)).toBe(true);
      expect(isSuggestedName(kind, name)).toBe(true);
    }
    const taken = NAME_WORDS.Cave.slice(1).map((word) => `cave-${word.toLowerCase()}`);
    expect(randomName("Cave", taken)).toBe(`Cave-${NAME_WORDS.Cave[0]}`);
    // All taken: round two, numbered.
    expect(randomName("Cave", NAME_WORDS.Cave.map((word) => `Cave-${word}`), () => 0)).toBe(`Cave-${NAME_WORDS.Cave[0]} 2`);
    expect(randomName("Map", [], () => 0, `Map-${NAME_WORDS.Map[0]}`)).toBe(`Map-${NAME_WORDS.Map[1]}`);
    expect(isSuggestedName("Cave", "My cave")).toBe(false);
  });

  it("uses no word twice in a list", () => {
    for (const words of Object.values(NAME_WORDS)) expect(new Set(words).size).toBe(words.length);
  });
});
