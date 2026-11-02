import { describe, expect, it } from "vitest";
import { restoreSettings, settingsKey, withLocalPreset, wizardPresets } from "./wizardSettings";

describe("wizard settings", () => {
  const defaults = { seed: 1, size: "small", walls: true, mix: [0, 1] };

  it("lays saved values that still fit over the defaults", () => {
    expect(restoreSettings(defaults, { seed: 7, size: "big", junk: 3 })).toEqual({ seed: 7, size: "big", walls: true, mix: [0, 1] });
    expect(restoreSettings(defaults, { seed: "7", walls: 1, mix: ["a"] })).toEqual(defaults);
    expect(restoreSettings(defaults, { seed: Number.NaN })).toEqual(defaults);
    expect(restoreSettings(defaults, null)).toEqual(defaults);
    expect(restoreSettings(defaults, [1, 2])).toEqual(defaults);
  });

  it("keeps a string setting to its choices", () => {
    expect(restoreSettings(defaults, { size: "huge" }, { size: ["small", "big"] }).size).toBe("small");
    expect(restoreSettings(defaults, { size: "big" }, { size: ["small", "big"] }).size).toBe("big");
  });

  it("keys by wizard and project", () => {
    expect(settingsKey("cave", "/a/Game")).not.toBe(settingsKey("cave", "/b/Game"));
    expect(settingsKey("cave", null)).toBe("gbc-wizard:cave:(no project)");
  });

  it("saves, lists and deletes local presets", () => {
    let all = withLocalPreset(null, "cave", "Ice", { seed: 2 });
    all = withLocalPreset(all, "cave", "Desert", { seed: 4 });
    expect(wizardPresets(all, "cave").map(([name]) => name)).toEqual(["Desert", "Ice"]);
    all = withLocalPreset(all, "cave", "Ice", null);
    all = withLocalPreset(all, "cave", "Desert", null);
    expect(all).toEqual({});
    expect(wizardPresets({ cave: [1] }, "cave")).toEqual([]);
  });
});
