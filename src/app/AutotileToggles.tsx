/**
 * A saved stamp's auto-tile, on hover beside its pencil (the author, 2026-10-10): one button showing its glyph (9 box,
 * W Wang, ↔ ↕ 3-slice, P path, E Wang edges, C corner Wang, F wall face, ▶ animated; lit when set) that opens the
 * list. Kinds the stamp's size doesn't fit are greyed, with the size they need.
 */
import { Check, LayoutGrid } from "lucide-react";
import { Menu } from "../ui/kit";
import type { Asset } from "./model";
import { AUTOTILES, autotileOf, type AutotileKind } from "./autotile";

export function AutotileToggles({ stamp, onAutotile }: { stamp: Asset; onAutotile: (asset: Asset, autotile: AutotileKind | null) => void }) {
  const current = autotileOf(stamp.autotile);
  return (
    <Menu align="end" items={[
      { heading: `Auto-tile: ${stamp.name}` },
      { label: "None (a plain stamp)", icon: current ? <span className="app-auto-glyph" /> : <Check />, onSelect: () => onAutotile(stamp, null) },
      { separator: true },
      ...AUTOTILES.map((kind) => {
        const fits = kind.fits(stamp.width, stamp.height);
        return { label: <span className="app-auto-item"><b>{kind.name}</b><small>{fits ? kind.about : `needs ${kind.size}`}</small></span>, icon: <span className="app-auto-glyph" data-on={current?.id === kind.id || undefined}>{kind.glyph}</span>,
          disabled: !fits && current?.id !== kind.id, title: fits ? undefined : `${kind.name} needs ${kind.size} (this stamp is ${stamp.width} × ${stamp.height})`,
          onSelect: () => onAutotile(stamp, current?.id === kind.id ? null : kind.id) };
      }),
    ]} trigger={
      <button type="button" className="app-stamp-edit app-stamp-auto" aria-pressed={Boolean(current)} title={current ? `${current.name} (${current.glyph}): ${current.about}. Click to change.` : "Auto-tile: make this stamp a box, 3-slice, path, Wang, wall face or animated tile"} aria-label={`Auto-tile for ${stamp.name}`} onClick={(event) => event.stopPropagation()}>
        {current ? current.glyph : <LayoutGrid size={11} />}
      </button>
    } />
  );
}
