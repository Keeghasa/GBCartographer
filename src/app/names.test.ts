import { describe, expect, it } from "vitest";
import { NAME_WORDS, defaultName, isSuggestedName, randomName, type NameKind } from "./names";

describe("names", () => {
  it("names a new thing after its kind and the moment, as the author wrote it (Dungeon-20261012249)", () => {
    const at = new Date(2026, 9, 12, 14, 49);
    expect(defaultName("Dungeon", [], at)).toBe("Dungeon-20261012249");
    expect(defaultName("Cave", [], new Date(2026, 0, 5, 0, 7))).toBe("Cave-202601051207");
    expect(defaultName("Dungeon", ["dungeon-20261012249"], at)).toBe("Dungeon-20261012249-2");
    expect(isSuggestedName("Dungeon", "Dungeon-20261012249")).toBe(true);
  });

  it("rolls three-word names from the dice, file-safe, never one the project has", () => {
    for (const kind of Object.keys(NAME_WORDS) as NameKind[]) {
      const name = randomName(kind);
      expect(name).toMatch(new RegExp(`^${kind}-[A-Z][a-z]+-[A-Z][a-z]+-[A-Z][a-z]+$`));
      expect(/^[\w ()\-.]+$/.test(name)).toBe(true);
      expect(isSuggestedName(kind, name)).toBe(true);
    }
    const zero = () => 0;
    const first = randomName("Cave", [], zero);
    expect(first).toBe("Cave-Cold-Dunes-Cove");
    expect(randomName("Cave", [first], zero)).toBe("Cave-Cold-Dunes-Cove-2");
    expect(isSuggestedName("Cave", "My cave")).toBe(false);
  });
});
