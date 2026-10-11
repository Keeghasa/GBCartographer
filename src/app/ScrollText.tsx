/**
 * One line of text that doesn't fit: cut off at rest, and on hover it slides along to show its end (the author,
 * 2026-10-11: "no wrap, just scroll on hover"), at an even reading speed.
 */
import { useRef, type CSSProperties } from "react";

export function ScrollText({ text, className }: { text: string; className?: string }) {
  const outer = useRef<HTMLSpanElement>(null), inner = useRef<HTMLSpanElement>(null);
  const measure = () => {
    const box = outer.current, line = inner.current;
    if (!box || !line) return;
    const shift = Math.max(0, line.scrollWidth - box.clientWidth);
    box.style.setProperty("--shift", `${-shift}px`);
    box.style.setProperty("--time", `${Math.max(0.3, shift / 60)}s`);
  };
  return (
    <span ref={outer} className={`app-scroll-text${className ? ` ${className}` : ""}`} title={text} onMouseEnter={measure} style={{ "--shift": "0px" } as CSSProperties}>
      <span ref={inner}>{text}</span>
    </span>
  );
}
