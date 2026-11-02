import { describe, expect, it } from "vitest";
import { budgetTone, slotsUsed } from "./TileBudget";

describe("tile budget", () => {
  it("counts the palette slots a picture's cells use", () => {
    expect(slotsUsed(Uint16Array.of(0, 0, 3, 7, 3))).toBe(3);
    expect(slotsUsed(undefined)).toBe(1);
  });
  it("goes amber near the limit and red over it", () => {
    expect([budgetTone(100, 192), budgetTone(180, 192), budgetTone(193, 192)]).toEqual([undefined, "warn", "bad"]);
  });
});
