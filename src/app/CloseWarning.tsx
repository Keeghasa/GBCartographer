/**
 * The "too alike" warning (two shades of a palette hard to tell apart) with an Ignore button (the author, 2026-10-14).
 * Ignoring remembers that palette's exact colors on this computer, so the warning stays away for it (here, in the
 * palette set wizard and in the palette panel's message); a change to its colors can warn again.
 */
import { useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Chip } from "../ui/kit";
import { readStored, store } from "./storage";

const KEY = "gbc-ignored-close";
const keyOf = (colors: readonly string[]) => colors.map((color) => color.replace(/^#/, "").toUpperCase()).join("-");
export const closeIgnored = (colors: readonly string[]) => readStored<string[]>(KEY, []).includes(keyOf(colors));

export function CloseWarning({ colors, label = "too alike", title }: { colors: readonly string[]; label?: string; title: string }) {
  const [ignored, setIgnored] = useState(() => closeIgnored(colors));
  if (ignored) return null;
  return (
    <span className="k-row close-warning">
      <Chip tone="warn" title={title}><TriangleAlert size={11} />{label}</Chip>
      <button type="button" className="close-warning-ignore" title="Ignore: don't warn about this palette again" aria-label="Ignore this warning"
        onClick={() => { store(KEY, [...new Set([...readStored<string[]>(KEY, []), keyOf(colors)])]); setIgnored(true); }}><X size={11} />Ignore</button>
    </span>
  );
}
