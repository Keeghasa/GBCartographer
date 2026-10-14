/**
 * The auto-tile styles' icons (the author's picks, 2026-10-14, review/autotile-names): Lucide icons, two drawn here in
 * Lucide's line style (no ladder or trapezoid in the set), and Wang keeping its W.
 */
import { Fence, Film, Grid3x3, Proportions, Road, SquareRoundCorner, Trees, Waves } from "lucide-react";
import type { ReactNode } from "react";
import type { AutotileKind } from "./autotile";

const Line = ({ size, children }: { size: number; children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
/** A ladder: two rails and three rungs (3-slice down, "Ladder style"). */
const Ladder = ({ size }: { size: number }) => <Line size={size}><path d="M7 2v20M17 2v20M7 6h10M7 12h10M7 18h10" /></Line>;
/** A trapezoid: a plateau with sloping sides (Cliff). */
const Trapezoid = ({ size }: { size: number }) => <Line size={size}><path d="M8 6h8l5 13H3Z" /></Line>;

export function AutotileIcon({ kind, glyph, size = 13 }: { kind: AutotileKind; glyph: string; size?: number }): ReactNode {
  switch (kind) {
    case "box": return <Grid3x3 size={size} />;
    case "across": return <Fence size={size} />;
    case "down": return <Ladder size={size} />;
    case "path": return <Road size={size} />;
    case "corner": return <SquareRoundCorner size={size} />;
    case "anim": return <Film size={size} />;
    case "xp": case "atlas": return <Proportions size={size} />;
    case "xpAnim": case "atlasAnim": return <Waves size={size} />;
    case "xpCliff": return <Trapezoid size={size} />;
    case "forest": return <Trees size={size} />;
    default: return glyph;
  }
}
