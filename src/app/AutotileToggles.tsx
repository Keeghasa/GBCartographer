/**
 * A saved stamp's auto-tile, on hover beside its pencil (the author, 2026-10-10): one button showing its glyph (9 box,
 * W Wang, ↔ ↕ 3-slice, P path, E Wang edges, C corner Wang, F wall face, ▶ animated; lit when set) that opens the
 * list. Kinds the stamp's size doesn't fit are greyed, with the size they need.
 */
import { Check, LayoutGrid } from "lucide-react";
import { Menu } from "../ui/kit";
import type { Asset } from "./model";
import { AUTOTILES, autotileOf, shownStyle, styleFor, type AutotileKind } from "./autotile";
import { AutotileIcon } from "./autotileIcons";

export function AutotileToggles({ stamp, onAutotile }: { stamp: Asset; onAutotile: (asset: Asset, autotile: AutotileKind | null) => void }) {
  const current = autotileOf(stamp.autotile), shown = shownStyle(current?.id);
  return (
    <Menu align="end" items={[
      { heading: `Auto-tile: ${stamp.name}` },
      { label: "None (a plain stamp)", icon: current ? <span className="app-auto-glyph" /> : <Check />, onSelect: () => onAutotile(stamp, null) },
      { separator: true },
      // Dropped and folded-in styles aren't offered, unless this stamp still has one.
      ...AUTOTILES.filter((kind) => !kind.hidden || (kind.id === current?.id && kind.id === shown)).map((kind) => {
        const fits = kind.fits(stamp.width, stamp.height);
        return { label: <span className="app-auto-item"><b>{kind.name}</b><small>{fits ? kind.about : `needs ${kind.size}`}</small></span>, icon: <span className="app-auto-glyph" data-on={shown === kind.id || undefined}><AutotileIcon kind={kind.id} glyph={kind.glyph} /></span>,
          disabled: !fits && shown !== kind.id, title: fits ? undefined : `${kind.name} needs ${kind.size} (this stamp is ${stamp.width} × ${stamp.height})`,
          onSelect: () => onAutotile(stamp, shown === kind.id ? null : styleFor(kind.id, stamp.width, stamp.height)) };
      }),
    ]} trigger={
      <button type="button" className="app-stamp-edit app-stamp-auto" aria-pressed={Boolean(current)} title={current ? `${current.name}: ${current.about}. Click to change.` : "Auto-tile: make this stamp a box, 3-slice, path, Wang, wall face or animated tile"} aria-label={`Auto-tile for ${stamp.name}`} onClick={(event) => event.stopPropagation()}>
        {current ? <AutotileIcon kind={current.id} glyph={current.glyph} size={11} /> : <LayoutGrid size={11} />}
      </button>
    } />
  );
}
