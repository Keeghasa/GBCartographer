/**
 * The Wizards gallery (2026-10-10; a mosaic in the Asset Catalog's neo-grotesk look since 2026-10-14): every wizard as
 * a flat tile with a short loop of it at work, its number, name and a line on what it does. A wizard that needs
 * something first (a project, an open picture) says what, and waits.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toRgba } from "../paint";
import { Dialog } from "../ui/kit";
import { PxRobotHappy } from "../ui/setIcons";
import { WIZARD_FRAMES, photoFrames, wizardThumb, type WizardThumb } from "./wizardThumbs";
import sammie from "./sammie.png";
import "./WizardGallery.css";

export interface WizardCard {
  thumb: WizardThumb; name: string; icon: ReactNode;
  /** What it does. */
  about: string;
  /** Why it can't start yet (null: it can). */
  blocked: string | null;
  /** What starting it will ask for first, shown instead of `about` (it can still start). */
  needs?: string;
  onStart: () => void;
}

/** The order the wizards show in, three to a row. */
const ORDER: WizardThumb[] = ["picture", "world", "cave", "dns", "paletteSet", "budget", "checkup"];
const still = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A wizard's loop, frame by frame (the last frame only, when the system asks for less motion). */
function Thumb({ id, playing }: { id: WizardThumb; playing: boolean }) {
  const { count, ms } = WIZARD_FRAMES[id];
  // Picture to background plays the author's photo of Sammie turning into pixels (loaded, then fitted).
  const [photo, setPhoto] = useState<ImageData[] | null>(null);
  useEffect(() => {
    if (id !== "picture") return;
    const image = new Image();
    image.onload = () => {
      const scratch = document.createElement("canvas");
      Object.assign(scratch, { width: image.width, height: image.height });
      const context = scratch.getContext("2d")!;
      context.drawImage(image, 0, 0);
      setPhoto(photoFrames(context.getImageData(0, 0, image.width, image.height), count));
    };
    image.src = sammie;
  }, [id, count]);
  const drawn = useMemo(() => Array.from({ length: count }, (_, frame) => {
    const picture = wizardThumb(id, frame);
    const cells = picture.cells ?? new Uint8Array(Math.ceil(picture.width / 8) * Math.ceil(picture.height / 8));
    const palettes = (picture.palettes ?? []).map(({ name, colors }) => ({ name, colors }));
    return new ImageData(toRgba(picture.pixels, cells, picture.width, palettes), picture.width, picture.height);
  }), [id, count]);
  const frames = photo ?? drawn;
  const [frame, setFrame] = useState(still() ? count - 1 : 0);
  const [target, setTarget] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!playing || still()) return;
    const timer = window.setInterval(() => setFrame((at) => (at + 1) % count), ms);
    return () => window.clearInterval(timer);
  }, [playing, count, ms]);
  useEffect(() => {
    if (!target) return;
    const image = frames[frame];
    Object.assign(target, { width: image.width, height: image.height });
    target.getContext("2d")!.putImageData(image, 0, 0);
  }, [frames, frame, target]);
  return <canvas ref={setTarget} className="wg-thumb" aria-hidden />;
}

export function WizardGallery({ cards, onClose }: { cards: WizardCard[]; onClose: () => void }) {
  const ready = cards.filter((card) => !card.blocked).length;
  const sorted = [...cards].sort((a, b) => ORDER.indexOf(a.thumb) - ORDER.indexOf(b.thumb));
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} full title="Wizards" sub="Step-by-step helpers" icon={<PxRobotHappy size={18} />}>
      <div className="wg">
        <div className="wg-head"><span>Pick one to start</span><span>{cards.length} wizards · {ready} ready now</span></div>
        <h1 className="wg-h1"><b>Wizards</b></h1>
        <div className="wg-mosaic">
          {sorted.map((card) => (
            <button key={card.thumb} type="button" className="wg-tile" disabled={Boolean(card.blocked)} title={card.blocked ?? card.needs ?? card.about}
              onClick={() => { onClose(); card.onStart(); }}>
              <span className="wg-art"><Thumb id={card.thumb} playing={!card.blocked} /></span>
              <span className="wg-text">
                <span className="wg-icon">{card.icon}</span>
                <span className="wg-name">{card.name}</span>
                <span className="wg-about">{card.blocked ?? card.needs ?? card.about}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
