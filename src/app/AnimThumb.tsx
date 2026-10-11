/**
 * An animated-tile stamp's thumbnail (▶): its square frames, side by side in the file, played in turn (4 a second).
 */
import { useEffect, useRef, type CSSProperties } from "react";

export function AnimThumb({ src, className, style }: { src: string; className?: string; style?: CSSProperties }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0, timer = 0;
    const image = new Image();
    image.onload = () => {
      const target = canvas.current;
      if (!target || !image.height) return;
      const size = image.height, frames = Math.max(1, Math.floor(image.width / size));
      Object.assign(target, { width: size, height: size });
      const context = target.getContext("2d")!;
      const draw = () => { context.clearRect(0, 0, size, size); context.drawImage(image, frame * size, 0, size, size, 0, 0, size, size); frame = (frame + 1) % frames; };
      draw();
      timer = window.setInterval(draw, 250);
    };
    image.src = src;
    return () => window.clearInterval(timer);
  }, [src]);
  return <canvas ref={canvas} className={className} style={{ imageRendering: "pixelated", ...style }} aria-hidden="true" />;
}
