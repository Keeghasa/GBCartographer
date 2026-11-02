/**
 * Colour-blind check (the author, 2026-11-02): a palette as seen with protanopia, deuteranopia or tritanopia, and
 * which of its colors run together then. Simulation: Machado, Oliveira and Fernandes 2009, severity 1.0, applied in
 * linear RGB. Pairs are measured as paint.ts measures colors (CIE L*a*b* distance).
 */
import { LOW_CONTRAST, colorDistance, hexRgb } from "../paint";

export type Vision = "protanopia" | "deuteranopia" | "tritanopia";
export const VISIONS: { key: Vision; name: string; hint: string }[] = [
  { key: "protanopia", name: "Protanopia", hint: "No red cones" },
  { key: "deuteranopia", name: "Deuteranopia", hint: "No green cones (the most common)" },
  { key: "tritanopia", name: "Tritanopia", hint: "No blue cones" },
];

/** Machado 2009, severity 1.0 (rows give linear R, G, B). */
const MATRICES: Record<Vision, number[][]> = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};

const toLinear = (value: number) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toByte = (value: number) => { const c = Math.max(0, Math.min(1, value)); return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255); };

/** "#RRGGBB" as someone with this vision sees it. */
export function simulate(hex: string, vision: Vision): string {
  const linear = hexRgb(hex).map(toLinear);
  return `#${MATRICES[vision].map((row) => toByte(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * Under this distance two colors run together for that vision: a little above LOW_CONTRAST (12), since simulated
 * colors are an estimate and the check should catch pairs that are only just apart.
 */
export const VISION_CONTRAST = 16;

export interface Clash { a: number; b: number; delta: number }

/**
 * Pairs of colors (any two, not only neighbours) that are hard to tell apart with this vision but were fine for
 * typical vision: those two run together only for some players. Colors already too close for everyone are left to
 * the usual low-contrast warning.
 */
export function visionClashes(colors: readonly string[], vision: Vision, threshold = VISION_CONTRAST): Clash[] {
  const seen = colors.map((color) => simulate(color, vision));
  const found: Clash[] = [];
  for (let a = 0; a < colors.length; a += 1) for (let b = a + 1; b < colors.length; b += 1) {
    if (colors[a].toUpperCase() === colors[b].toUpperCase() || colorDistance(colors[a], colors[b]) < LOW_CONTRAST) continue;
    const delta = colorDistance(seen[a], seen[b]);
    if (delta < threshold) found.push({ a, b, delta: Math.round(delta * 10) / 10 });
  }
  return found;
}

/** Every palette of a set under one vision: the colors as seen and the pairs that clash. */
export function checkSet(palettes: readonly (readonly string[])[], vision: Vision): { colors: string[]; clashes: Clash[] }[] {
  return palettes.map((colors) => ({ colors: colors.map((color) => simulate(color, vision)), clashes: visionClashes(colors, vision) }));
}
