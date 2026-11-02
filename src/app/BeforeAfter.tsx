/**
 * Before / after (the author, 2026-11-02: "only if it makes sense"): two pictures of the same size, one over the
 * other, and a slider that wipes from the before to the after. Used where a wizard has a real "before": Picture to
 * background (your picture framed vs. the result), Tile budget fixer (as opened vs. now), Dawn, sunset and night
 * (day vs. a picked time).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Slider } from "../ui/kit";
import "./BeforeAfter.css";

function Layer({ rgba, width, height, clip }: { rgba: Uint8ClampedArray; width: number; height: number; clip?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current;
    if (!target || rgba.length !== width * height * 4) return;
    if (target.width !== width || target.height !== height) Object.assign(target, { width, height });
    target.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  }, [rgba, width, height]);
  return <canvas ref={canvas} width={width} height={height} style={clip === undefined ? undefined : { clipPath: `inset(0 0 0 ${clip}%)` }} />;
}

export function BeforeAfter({ before, after, width, height, beforeLabel = "Before", afterLabel = "After", extra }: {
  before: Uint8ClampedArray; after: Uint8ClampedArray; width: number; height: number;
  beforeLabel?: ReactNode; afterLabel?: ReactNode;
  /** Beside the labels (a choice of which "after"). */
  extra?: ReactNode;
}) {
  const [at, setAt] = useState(50);
  return (
    <figure className="ba">
      <figcaption className="k-row ba-labels"><span className="k-eyebrow">{beforeLabel}</span><span className="k-spacer" />{extra}<span className="k-eyebrow">{afterLabel}</span></figcaption>
      <div className="ba-frame" style={{ aspectRatio: `${width} / ${height}` }}>
        <Layer rgba={before} width={width} height={height} />
        <Layer rgba={after} width={width} height={height} clip={at} />
        <i className="ba-line" style={{ left: `${at}%` }} aria-hidden />
      </div>
      <Slider label="Before / after" value={at} onChange={setAt} min={0} max={100} />
    </figure>
  );
}
