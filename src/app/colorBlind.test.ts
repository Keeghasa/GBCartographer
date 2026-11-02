import { describe, expect, it } from "vitest";
import { checkSet, simulate, visionClashes } from "./colorBlind";

describe("colour-blind check", () => {
  it("keeps greys, white and black as they are", () => {
    for (const vision of ["protanopia", "deuteranopia", "tritanopia"] as const) {
      expect(simulate("#FFFFFF", vision)).toBe("#FFFFFF");
      expect(simulate("#000000", vision)).toBe("#000000");
    }
  });

  it("brings red and green together for protanopia and deuteranopia, not tritanopia", () => {
    const palette = ["#FFFFFF", "#A05050", "#507850", "#000000"];
    for (const vision of ["protanopia", "deuteranopia"] as const) expect(visionClashes(palette, vision)).toContainEqual(expect.objectContaining({ a: 1, b: 2 }));
    expect(visionClashes(palette, "tritanopia")).toEqual([]);
  });

  it("brings blue and green together for tritanopia, not the others", () => {
    const palette = ["#FFFFFF", "#4080C0", "#40A080", "#000000"];
    expect(visionClashes(palette, "tritanopia")).toContainEqual(expect.objectContaining({ a: 1, b: 2 }));
    expect(visionClashes(palette, "deuteranopia")).toEqual([]);
  });

  it("leaves pairs already too close for everyone to the usual warning", () => {
    expect(visionClashes(["#FFFFFF", "#808080", "#828282", "#000000"], "deuteranopia")).toEqual([]);
  });

  it("finds nothing in the Game Boy greens, and checks a whole set", () => {
    const greens = ["#E0F8D0", "#88C070", "#346856", "#081820"];
    const result = checkSet([greens, greens], "deuteranopia");
    expect(result).toHaveLength(2);
    expect(result[0].clashes).toEqual([]);
    expect(result[0].colors).toHaveLength(4);
  });
});
