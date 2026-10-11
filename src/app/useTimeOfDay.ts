/**
 * Time of day preview (roadmap 53, the author's pick 2026-10-10): shows the open picture at dawn, sunset or night by
 * drawing each palette as its "<base> D", "<base> S" or "<base> N" version from the project, fading between them.
 * The palette as painted is the day. Only the view changes: nothing is written, and painting still uses the day
 * palettes.
 */
import { useEffect, useRef, useState } from "react";
import { hexRgb, timeVariant } from "../paint";

export type TimeKey = "day" | "D" | "S" | "N";
export const TIMES: { key: TimeKey; name: string }[] = [{ key: "day", name: "Day" }, { key: "D", name: "Dawn" }, { key: "S", name: "Sunset" }, { key: "N", name: "Night" }];
/** The order a day plays in. */
const PLAY: TimeKey[] = ["D", "day", "S", "N"];
const FADE_MS = 700, HOLD_MS = 1800;

export interface TimeView { from: TimeKey; to: TimeKey; mix: number }

export function useTimeOfDay() {
  const [view, setView] = useState<TimeView>({ from: "day", to: "day", mix: 1 });
  const [playing, setPlaying] = useState(false);
  const current = useRef(view);
  current.current = view;
  const frame = useRef(0);

  /** Fades to a time of day (from wherever the view is now). */
  function go(next: TimeKey) {
    cancelAnimationFrame(frame.current);
    const from = current.current.mix >= 0.5 ? current.current.to : current.current.from;
    if (from === next) { setView({ from: next, to: next, mix: 1 }); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const mix = Math.min(1, (now - start) / FADE_MS);
      setView({ from, to: next, mix });
      if (mix < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (!playing) return;
    const step = () => go(PLAY[(PLAY.indexOf(current.current.to) + 1) % PLAY.length]);
    step();
    const timer = window.setInterval(step, FADE_MS + HOLD_MS);
    return () => window.clearInterval(timer);
  }, [playing]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return { view, go, playing, setPlaying };
}

const blend = (a: readonly string[], b: readonly string[], mix: number) => a.map((color, at) => {
  const x = hexRgb(color), y = hexRgb(b[at] ?? color);
  return `#${x.map((value, channel) => Math.round(value + (y[channel] - value) * mix).toString(16).padStart(2, "0")).join("")}`;
});

/** A palette's colors at this time of day: its D / S / N version from `all` when there is one, else its own. */
export function timeColors(palette: { name: string; colors: readonly string[] }, all: readonly { name: string; colors: readonly string[] }[], view: TimeView): readonly string[] {
  if (view.from === "day" && view.to === "day") return palette.colors;
  const base = timeVariant(palette.name)?.base ?? palette.name;
  const at = (key: TimeKey) => key === "day" ? palette.colors : all.find((item) => item.name === `${base} ${key}`)?.colors ?? palette.colors;
  return view.mix >= 1 ? at(view.to) : blend(at(view.from), at(view.to), view.mix);
}

/** How many of these palettes have at least one dawn, sunset or night version in `all`. */
export function palettesWithTimes(list: readonly { name: string }[], all: readonly { name: string }[]): number {
  const names = new Set(all.map((item) => item.name));
  return list.filter((palette) => { const base = timeVariant(palette.name)?.base ?? palette.name; return ["D", "S", "N"].some((key) => names.has(`${base} ${key}`)); }).length;
}
