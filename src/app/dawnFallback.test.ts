import { describe, expect, it } from "vitest";
import { timeVariant, timeVersionName } from "../paint";
import { palettesWithTimes, timeColors } from "./useTimeOfDay";
import { fixKind } from "./checkupFixes";

// Beta.3 and older named Morning versions "<base> D" (Dawn); they keep working after the rename (2026-11-20).
describe("old Dawn names read as Morning", () => {
  const day = { name: "Forest", colors: ["#ffffff", "#aaaaaa", "#555555", "#000000"] };
  const dawn = { name: "Forest D", colors: ["#ffeedd", "#ccbbaa", "#665544", "#110000"] };
  const morning = { name: "Forest M", colors: ["#eeffee", "#bbccbb", "#445544", "#001100"] };
  it("timeVariant reads D as M and marks it", () => {
    expect(timeVariant("Forest D")).toEqual({ base: "Forest", variant: "M", dawn: true });
    expect(timeVariant("Forest M")).toEqual({ base: "Forest", variant: "M" });
  });
  it("a D stands in for a missing M, and an M wins over a D", () => {
    expect(timeVersionName(new Set(["Forest D"]), "Forest", "M")).toBe("Forest D");
    expect(timeVersionName(new Set(["Forest D", "Forest M"]), "Forest", "M")).toBe("Forest M");
    expect(timeVersionName(new Set(["Forest D"]), "Forest", "N")).toBeNull();
  });
  it("the preview shows the old D in the morning", () => {
    const view = { from: "M" as const, to: "M" as const, mix: 1 };
    expect(timeColors(day, [day, dawn], view)).toEqual(dawn.colors);
    expect(timeColors(day, [day, dawn, morning], view)).toEqual(morning.colors);
    expect(palettesWithTimes([day], [day, dawn])).toBe(1);
  });
  it("the check-up offers the rename", () => {
    expect(fixKind({ level: "warning", kind: "palettes", file: "Forest D", title: "Old Dawn name", detail: "" })).toBe("dawn");
  });
});
