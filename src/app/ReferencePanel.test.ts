import { describe, expect, it } from "vitest";
import { REFERENCE_HOME, referenceUrl } from "./ReferencePanel";

describe("the reference browser's address box", () => {
  it("opens an address as it is, adding https to a bare one", () => {
    expect(referenceUrl("https://www.gbstudio.dev/docs")).toBe("https://www.gbstudio.dev/docs");
    expect(referenceUrl("http://example.com")).toBe("http://example.com");
    expect(referenceUrl("gbstudio.dev")).toBe("https://gbstudio.dev");
    expect(referenceUrl("opengameart.org/art-search?keys=cave")).toBe("https://opengameart.org/art-search?keys=cave");
    expect(referenceUrl("localhost:5173")).toBe("https://localhost:5173");
  });

  it("searches DuckDuckGo for anything that isn't an address", () => {
    expect(referenceUrl("game boy palette ideas")).toBe("https://duckduckgo.com/?q=game%20boy%20palette%20ideas");
    expect(referenceUrl("tileset")).toBe("https://duckduckgo.com/?q=tileset");
    expect(referenceUrl("what is 1.5x")).toBe("https://duckduckgo.com/?q=what%20is%201.5x");
    expect(referenceUrl("  ")).toBe(REFERENCE_HOME);
  });
});
