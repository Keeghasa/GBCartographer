import { describe, expect, it } from "vitest";
import { shotName } from "./shotName";

describe("shotName", () => {
  it("is the model's name and the local time to the second, without the extension or colons", () => {
    expect(shotName("rubber_duck_toy.gltf", new Date(2026, 9, 27, 14, 3, 5))).toBe("rubber_duck_toy 2026-10-27 14-03-05");
    expect(shotName("Sample house", new Date(2026, 0, 1, 0, 0, 0))).toBe("Sample house 2026-01-01 00-00-00");
  });
});
