import { useEffect, useRef, useState } from "react";
import { FolderOpen, FolderTree, Gamepad2, TriangleAlert } from "lucide-react";
import { Button, Chip, Kbd } from "../ui/kit";
import "./StartScreen.css";

/**
 * The splash without a project (dev server or desktop app), the author's pick C2e (2026-10-12): a bar with the ways
 * in (open a project, the demo, PNG files), then the recent projects as big names, each row with its backgrounds
 * lined up behind it, last edited first (nearest the right). At rest they're dim, in the Game Boy greens; hovering a
 * row shows them in their own colors, and the one under the pointer comes up (← → do the same from the keyboard).
 */
/** A path with the home folder as ~ (/Users/name, /home/name, C:\\Users\\name), shorter to read. */
const homeShort = (path: string) => path.replace(/^(\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)/, "~");

interface Background { file: string; name: string; mtime: number }
const GREENS = [[224, 248, 207], [134, 192, 108], [48, 104, 80], [7, 24, 33]];
const ago = (mtime: number) => {
  const minutes = Math.max(0, (Date.now() - mtime) / 60000);
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  const days = Math.round(minutes / 60 / 24);
  return days === 1 ? "yesterday" : days < 14 ? `${days} days ago` : new Date(mtime).toLocaleDateString();
};

/** Draws a background's PNG in the four Game Boy greens, lightest to darkest by its own shades. */
function GreenPicture({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const canvas = ref.current;
      if (!canvas) return;
      Object.assign(canvas, { width: image.width, height: image.height });
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, image.width, image.height), d = data.data;
      const light = (at: number) => Math.round(0.299 * d[at] + 0.587 * d[at + 1] + 0.114 * d[at + 2]);
      const levels = new Set<number>();
      for (let at = 0; at < d.length; at += 4) if (levels.size <= 4) levels.add(light(at));
      const sorted = [...levels].sort((a, b) => b - a);
      for (let at = 0; at < d.length; at += 4) {
        const value = light(at), rank = sorted.length <= 4 ? sorted.indexOf(value) : 3 - Math.min(3, Math.floor(value / 64));
        d.set(GREENS[Math.max(0, rank)], at); d[at + 3] = 255;
      }
      context.putImageData(data, 0, 0);
    };
    image.src = src;
  }, [src]);
  return <canvas ref={ref} className="ss-pic ss-pic--green" />;
}

/** One recent project: its name and path, its backgrounds behind it. */
function RecentRow({ name, path, onOpen }: { name: string; path: string; onOpen: () => void }) {
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [shown, setShown] = useState(0);
  const cells = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    let live = true;
    fetch(`./__cartographer/recent-backgrounds?${new URLSearchParams({ path })}`, { cache: "no-cache" }).then((reply) => reply.json() as Promise<{ backgrounds?: Background[] }>)
      .then((result) => { if (live) setBackgrounds(result.backgrounds ?? []); }).catch(() => undefined);
    return () => { live = false; };
  }, [path]);
  const picture = (file: string, color: boolean) => `./__cartographer/recent-picture?${new URLSearchParams({ path, file, ...(color ? { color: "1" } : {}) })}`;
  return (
    <button type="button" className="ss-row" title={path} onClick={onOpen}
      onPointerMove={(event) => { const hit = cells.current.findIndex((cell) => { const box = cell?.getBoundingClientRect(); return box && event.clientX >= box.left && event.clientX < box.right; }); if (hit >= 0 && hit !== shown) setShown(hit); }}
      onPointerLeave={() => setShown(0)}
      onKeyDown={(event) => { if (backgrounds.length && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); setShown((shown + (event.key === "ArrowLeft" ? 1 : backgrounds.length - 1)) % backgrounds.length); } }}>
      <span className="ss-strip" aria-hidden>
        {/* Last edited first, nearest the right edge: laid out right to left. */}
        {backgrounds.map((background, k) => (
          <span key={background.file} ref={(cell) => { cells.current[k] = cell; }} className={`ss-cell${k === shown ? " on" : ""}`} style={{ order: backgrounds.length - k }}>
            <GreenPicture src={picture(background.file, false)} />
            <img className="ss-pic ss-pic--color" src={picture(background.file, true)} alt="" loading="lazy" />
            <span className="ss-stamp">{background.name} · {ago(background.mtime)}</span>
          </span>
        ))}
      </span>
      <span className="ss-name"><b>{name}</b><span>{homeShort(path)}{backgrounds.length ? ` · ${backgrounds.length === 8 ? "8+" : backgrounds.length} background${backgrounds.length === 1 ? "" : "s"}` : ""}</span></span>
    </button>
  );
}

export function StartScreen({ recent, onChooseProject, onDemo, onOpenFiles, onOpenRecent, onAbout }: { recent: { name: string; path: string }[]; onChooseProject: () => void; onDemo: (() => void) | null; onOpenFiles: () => void; onOpenRecent: (path: string) => void; onAbout: () => void }) {
  return (
    <div className="ss-splash k">
      <header className="ss-bar">
        <span className="ss-brand"><img src={`${import.meta.env.BASE_URL}app-icon.png`} alt="" width={32} height={32} /><span className="k-wordmark">GB Cartographer</span> <Chip tone="acc">ALPHA</Chip></span>
        <nav className="ss-ways">
          <Button variant="primary" icon={<FolderTree />} onClick={onChooseProject} title="The folder with the .gbsproj file: backgrounds, sprites, tilesets and fonts open here and save back">Open a project</Button>
          {onDemo && <Button icon={<Gamepad2 />} onClick={onDemo} title="A small project with CC0 and MIT art, credited inside; opens a copy you can paint in">Try the demo</Button>}
          <Button icon={<FolderOpen />} onClick={onOpenFiles} title="Any Game Boy picture on its own; or drop files anywhere, or paste from the clipboard">Open PNG <Kbd>Ctrl+O</Kbd></Button>
        </nav>
      </header>
      {recent.length > 0 ? (
        <section className="ss-recent">
          <div className="ss-head"><span>Recent projects</span><span>Hover to see a project's backgrounds in color · move across to pick one</span></div>
          {recent.map((item) => <RecentRow key={item.path} name={item.name} path={item.path} onOpen={() => onOpenRecent(item.path)} />)}
        </section>
      ) : (
        <section className="ss-empty"><h2>Open a GB Studio project to start.</h2><p className="k-muted">Its backgrounds, sprites, tilesets and fonts open here and save back. Projects you open show up here next time.</p></section>
      )}
      <p className="ss-alpha" role="note"><TriangleAlert size={16} aria-hidden /><span><b>Experimental alpha.</b> Only use it on GB Studio projects you have backed up: Save writes into the project. Close GB Studio while you work.</span></p>
      <footer className="ss-foot"><span>Save writes only the PNG, tile and slice palettes, palette files and palette slots into your project. The old file is kept in Backups.</span><Button variant="ghost" size="sm" onClick={onAbout}>About · {__APP_VERSION__}</Button></footer>
    </div>
  );
}
