/**
 * Wireframe sprites, emotes and avatars. Sprite sheets are 16 pixels tall, frames 16 wide side by side, in GB
 * Studio's classic layout so it sets their animations up by itself: 1 frame still, 3 frames facing down / up /
 * right, 6 frames walking (down, down step, up, up step, right, right step), any other count one looping animation.
 * Sprites and emotes keep shade 0 out (it is see-through on sprites): shade 1 is the lightest that shows, CLEAR
 * around them. Avatars are background tiles, so they use all four shades.
 */
import { CLEAR, Pen, canvas, type Canvas } from "./pen";

/** A sheet of `frames` 16 × 16 frames, each drawn by `draw(pen, frame)`. */
export function sheet(frames: number, draw: (p: Pen, frame: number) => void, height = 16): Canvas {
  const out = canvas(frames * 16, height, CLEAR);
  for (let frame = 0; frame < frames; frame += 1) draw(new Pen(out, frame * 16, 0, 16, height), frame);
  return out;
}

// ---- people -------------------------------------------------------------------------------------------------------------

type Facing = "down" | "up" | "right";
export interface Look {
  hat?: "cap" | "hood";
  /** Hair shade (none: covered). */
  hair?: number;
  /** Shirt (body) shade. */
  shirt: number;
}

/** A person, facing down, up or right, standing (step 0) or mid-step (1). */
export function person(p: Pen, look: Look, facing: Facing, step: number) {
  // Legs and arms first, so the body's outline sits on top.
  if (facing === "right") {
    if (step) { p.rect(5, 13, 2, 3, 3); p.rect(9, 13, 2, 2, 3); } else p.rect(6, 13, 4, 3, 3);
  } else if (step) { p.rect(5, 13, 2, 2, 3); p.rect(9, 13, 2, 3, 3); } else { p.rect(5, 13, 2, 3, 3); p.rect(9, 13, 2, 3, 3); }
  p.panel(4, 8, 8, 6, look.shirt);
  if (facing === "right") p.rect(7, 9 + step, 2, 3, 3);
  else { p.rect(3, 9 + step, 1, 3, 3); p.rect(12, 10 - step, 1, 3, 3); }
  // Head.
  p.round(4, 0, 8, 8, 1);
  if (facing === "up") p.rect(5, 1, 6, 6, look.hair ?? 1);
  else {
    if (look.hair !== undefined) { p.rect(5, 1, 6, 2, look.hair); if (facing === "right") p.rect(5, 3, 2, 3, look.hair); }
    if (facing === "right") p.dot(9, 4, 3); else { p.dot(6, 4, 3); p.dot(9, 4, 3); }
  }
  if (look.hat === "cap") { p.panel(4, 0, 8, 3, 2); if (facing === "down") p.rect(3, 3, 10, 1, 3); if (facing === "right") p.rect(9, 3, 5, 1, 3); }
  if (look.hat === "hood") { p.rect(4, 0, 8, 2, 2); p.rect(4, 0, 1, 7, 2); p.rect(11, 0, 1, 7, 2); p.box(3, 0, 10, 8, 3); }
}

/** A walking sheet (six frames, classic layout). */
export const walker = (look: Look) => sheet(6, (p, frame) => person(p, look, (["down", "down", "up", "up", "right", "right"] as const)[frame], frame % 2));

// ---- things ------------------------------------------------------------------------------------------------------------

export const things = {
  sign: () => sheet(1, (p) => { p.rect(7, 9, 2, 7, 3); p.panel(1, 2, 14, 8, 1); p.rect(3, 4, 10, 1, 2); p.rect(3, 6, 7, 1, 2); }),
  crate: () => sheet(1, (p) => { p.panel(1, 1, 14, 14, 2); p.box(3, 3, 10, 10, 3); p.line(3, 3, 12, 12, 3); p.line(12, 3, 3, 12, 3); }),
  bush: () => sheet(1, (p) => { p.oval(1, 3, 14, 12, 1); p.dot(5, 7, 2); p.dot(10, 6, 2); p.dot(8, 11, 2); }),
  heart: () => sheet(1, (p) => p.bitmap(1, 2, [
    "..333....333..",
    ".31113..31113.",
    "31211131111113",
    "31211111111113",
    "31111111111113",
    ".311111111113.",
    "..3111111113..",
    "...31111113...",
    "....311113....",
    ".....3113.....",
    "......33......",
  ])),
  potion: () => sheet(1, (p) => { p.oval(3, 5, 10, 10, 2); p.rect(6, 1, 4, 5, 1); p.box(6, 1, 4, 5, 3); p.rect(5, 0, 6, 1, 3); p.dot(5, 8, 1); }),
  coinStill: () => sheet(1, (p) => { p.oval(3, 2, 10, 12, 1); p.rect(7, 5, 2, 6, 2); }),
  bullet: () => sheet(1, (p) => { p.oval(5, 5, 6, 6, 1); }),
};

/** Two-state things (first frame, second frame) and loops. */
export const animated = {
  chest: () => sheet(2, (p, open) => { p.panel(1, 6, 14, 9, 2); p.rect(1, 9, 14, 1, 3); if (open) { p.panel(1, 1, 14, 6, 3); p.rect(3, 3, 10, 2, 1); } else { p.round(1, 3, 14, 5, 2); p.panel(6, 8, 4, 4, 1); } }),
  door: () => sheet(2, (p, open) => { p.panel(1, 0, 14, 16, 2); if (open) p.rect(3, 2, 10, 14, 3); else { p.rect(4, 2, 1, 14, 3); p.rect(11, 2, 1, 14, 3); p.dot(9, 9, 1); } }),
  lever: () => sheet(2, (p, on) => { p.panel(3, 11, 10, 4, 2); if (on) p.line(8, 11, 12, 4, 3); else p.line(8, 11, 4, 4, 3); p.oval(on ? 10 : 2, 2, 4, 4, 1); }),
  switch: () => sheet(2, (p, down) => { p.panel(1, 11, 14, 4, 2); p.panel(4, down ? 9 : 6, 8, down ? 3 : 6, 1); }),
  checkbox: () => sheet(2, (p, on) => { p.panel(3, 3, 10, 10, 1); if (on) { p.line(5, 8, 7, 10, 3); p.line(7, 10, 11, 5, 3); } }),
  coin: () => sheet(4, (p, frame) => { const w = [10, 6, 2, 6][frame]; p.oval(8 - w / 2, 2, w, 12, 1); if (w > 4) p.rect(7, 5, 2, 6, 2); }),
  sparkle: () => sheet(4, (p, frame) => { const r = [1, 3, 5, 3][frame]; p.rect(8 - r, 7, r * 2 + 1, 1, 1); p.rect(7, 8 - r - 1, 1, r * 2 + 1, 1); p.dot(7, 7, 3); if (frame === 2) { p.dot(4, 4, 2); p.dot(11, 11, 2); p.dot(11, 4, 2); p.dot(4, 11, 2); } }),
  explosion: () => sheet(4, (p, frame) => { const r = [3, 6, 7, 7][frame]; p.oval(8 - r, 8 - r, r * 2, r * 2, frame === 3 ? null : 1, frame === 3 ? 2 : 3); if (frame >= 1) p.oval(8 - r / 2, 8 - r / 2, r, r, frame === 3 ? null : 2, frame === 3 ? 1 : 3); }),
};

// ---- emotes (16 × 16 bubbles) ----------------------------------------------------------------------------------------------

function bubble(p: Pen) { p.round(1, 0, 14, 12, 1); p.peak(4, 11, 5, 4, 1); p.rect(5, 11, 3, 1, 1); }

export const emotes: Record<string, { name: string; draw: (p: Pen) => void }> = {
  shock: { name: "Shock", draw: (p) => { bubble(p); p.rect(7, 2, 2, 5, 3); p.rect(7, 8, 2, 2, 3); } },
  sleep: { name: "Sleep", draw: (p) => { bubble(p); p.text(3, 4, "Z", 3); p.text(7, 2, "Z", 3); p.dot(12, 2, 3); } },
  pause: { name: "Pause", draw: (p) => { bubble(p); for (const x of [4, 7, 10]) p.rect(x, 5, 2, 2, 3); } },
  happy: { name: "Happy", draw: (p) => { bubble(p); p.dot(5, 4, 3); p.dot(10, 4, 3); p.rect(5, 7, 6, 1, 3); p.dot(4, 6, 3); p.dot(11, 6, 3); } },
};

export const emote = (id: keyof typeof emotes) => sheet(1, (p) => emotes[id].draw(p));

// ---- avatars (16 × 16 faces for dialogue, background tiles) --------------------------------------------------------------------

export function avatar(look: Look | "mystery"): Canvas {
  const out = canvas(16, 16, 0), p = new Pen(out);
  p.box(0, 0, 16, 16, 2);
  if (look === "mystery") { p.oval(3, 2, 10, 10, 3); p.rect(2, 11, 12, 5, 3); p.text(7, 4, "?", 0); return out; }
  p.panel(3, 12, 10, 4, look.shirt);
  p.round(3, 2, 10, 11, 1);
  if (look.hair !== undefined) p.rect(4, 3, 8, 2, look.hair);
  p.rect(5, 7, 2, 2, 3); p.rect(9, 7, 2, 2, 3); p.rect(6, 10, 4, 1, 2);
  if (look.hat === "cap") { p.panel(3, 1, 10, 4, 2); p.rect(2, 4, 12, 1, 3); }
  if (look.hat === "hood") { p.rect(2, 1, 12, 3, 2); p.rect(2, 1, 2, 12, 2); p.rect(12, 1, 2, 12, 2); }
  return out;
}
