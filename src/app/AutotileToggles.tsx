/**
 * A saved stamp's auto-tile toggles, shown on hover beside its pencil: 9 (box: stretched over a dragged rectangle)
 * and W (Wang: each tile fits its neighbours). One at a time; clicking the lit one makes it a plain stamp again.
 */
import type { Asset } from "./model";
import { canBox, canWang } from "./autotile";

export function AutotileToggles({ stamp, onAutotile }: { stamp: Asset; onAutotile: (asset: Asset, autotile: "box" | "wang" | null) => void }) {
  const box = canBox(stamp.width, stamp.height), wang = canWang(stamp.width, stamp.height);
  return <>
    <button type="button" className="app-stamp-edit app-stamp-auto" aria-pressed={stamp.autotile === "box"} disabled={!box && stamp.autotile !== "box"}
      title={box ? `Box auto-tile (9): drag a rectangle and ${stamp.name} stretches over it (corners, edges, middle)` : "Box auto-tile (9) needs a stamp of whole tiles, at least 3 × 3"}
      aria-label={`Box auto-tile for ${stamp.name}`} onClick={(event) => { event.stopPropagation(); onAutotile(stamp, stamp.autotile === "box" ? null : "box"); }}>9</button>
    <button type="button" className="app-stamp-edit app-stamp-auto" aria-pressed={stamp.autotile === "wang"} disabled={!wang && stamp.autotile !== "wang"}
      title={wang ? `Wang auto-tile (W): ${stamp.name} is a 47-tile sheet; painted tiles fit their neighbours` : "Wang auto-tile (W) needs a 47-tile sheet of 8 × 6 tiles (64 × 48 px), like the Wang template in Graphics → Art"}
      aria-label={`Wang auto-tile for ${stamp.name}`} onClick={(event) => { event.stopPropagation(); onAutotile(stamp, stamp.autotile === "wang" ? null : "wang"); }}>W</button>
  </>;
}
