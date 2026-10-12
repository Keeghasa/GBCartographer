/** A name box with a dice button for another random "Kind-Name" (names.ts; the author, 2026-10-12). */
import { Dices } from "lucide-react";
import { IconButton } from "../ui/kit";
import { randomName, type NameKind } from "./names";

export function NameInput({ kind, value, onChange, taken = [], autoFocus, placeholder, label = "Name" }: {
  kind: NameKind; value: string; onChange: (name: string) => void;
  /** Names already used (the dice never offers one). */
  taken?: readonly string[];
  autoFocus?: boolean; placeholder?: string; label?: string;
}) {
  return (
    <span className="k-row app-name-input">
      <input className="k-input" aria-label={label} autoFocus={autoFocus} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      <IconButton label="Another name" onClick={() => onChange(randomName(kind, taken, Math.random, value))}><Dices /></IconButton>
    </span>
  );
}
