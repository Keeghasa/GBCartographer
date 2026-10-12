/**
 * An animated-tile stamp's thumbnail (▶): its square frames, side by side in the file, played in turn (4 a second).
 */
import { useEffect, useRef, type CSSProperties } from "react";

export function AnimThumb({ src, className, style, frames: count }: { src: string; className?: string; style?: CSSProperties; /** Frames side by side (default: square frames, width / height). */ frames?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0, timer = 0;
    const image = new Image();
    image.onload = () => {
      const target = canvas.current;
      if (!target || !image.height) return;
      const frames = count ?? Math.max(1, Math.floor(image.width / image.height)), fw = Math.floor(image.width / frames), size = image.height;
      Object.assign(target, { width: fw, height: size });
      const context = target.getContext("2d")!;
      const draw = () => { context.clearRect(0, 0, fw, size); context.drawImage(image, frame * fw, 0, fw, size, 0, 0, fw, size); frame = (frame + 1) % frames; };
      draw();
      timer = window.setInterval(draw, 250);
    };
    image.src = src;
    return () => window.clearInterval(timer);
  }, [src, count]);
  return <canvas ref={canvas} className={className} style={{ imageRendering: "pixelated", ...style }} aria-hidden="true" />;
}
