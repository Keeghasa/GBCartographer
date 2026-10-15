/**
 * Settings (the author, 2026-10-14: "where is our settings menu? … change font to OpenDyslexic and themes"): the
 * app's look, kept per computer. The font (Inter, JetBrains Mono, Public Pixel or OpenDyslexic, fetched the first
 * time) and the theme (the OLED Game Boy green the author chose, or one of the others kept in src/ui/theme.ts).
 */
import { Settings } from "lucide-react";
import { useState } from "react";
import { Dialog } from "../ui/kit";
import { FONTS, THEMES, applyTheme, loadTheme, type FontChoice, type ThemeChoice } from "../ui/theme";
import "./SettingsWindow.css";

const SWATCH: Partial<Record<ThemeChoice, string[]>> = {
  "oled-gb": ["#000000", "#306850", "#86C06C", "#E0F8CF"], slate: ["#1E2228", "#3A404A", "#E8783C", "#E8EAEE"],
  oled: ["#000000", "#1A1A1A", "#F08A3C", "#F4F4F4"], "oled-green": ["#000000", "#1A1F1A", "#86C06C", "#F4F4F4"],
  shuffle: ["#000000", "#F08A3C", "#86C06C", "#306850"], fuchsia: ["#0a0408", "#351d2e", "#E0349B", "#f4e8f0"],
};

export function SettingsWindow({ font, onFont, onClose }: { font: FontChoice; onFont: (font: FontChoice) => void; onClose: () => void }) {
  const [theme, setTheme] = useState<ThemeChoice>(() => loadTheme());
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title="Settings" sub="The app's look, kept on this computer" icon={<Settings size={18} />}>
      <div className="stw">
        <section className="stw-group">
          <h2 className="k-heading">Font</h2>
          <div className="stw-fonts" role="radiogroup" aria-label="Font">
            {FONTS.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={font === item.id} title={item.title} className={`k-card k-card--button stw-font stw-font--${item.id}`} onClick={() => onFont(item.id)}>
                <b>Aa</b><span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="stw-group">
          <h2 className="k-heading">Theme</h2>
          <div className="stw-themes" role="radiogroup" aria-label="Theme">
            {THEMES.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={theme === item.id} title={item.title} className="k-card k-card--button stw-theme"
                onClick={() => { setTheme(item.id); applyTheme(item.id); }}>
                <span className="stw-swatch">{(item.colors ? [...item.colors].reverse() : SWATCH[item.id] ?? []).map((color) => <i key={color} style={{ background: color }} />)}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Dialog>
  );
}
