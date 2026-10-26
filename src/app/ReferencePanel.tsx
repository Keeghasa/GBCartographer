/**
 * The reference browser (the author, 2026-10-25: "I just want to have a reference browser"): a small web browser in
 * the project panel, on DuckDuckGo to start, with back, forward and one address box (anything that isn't an address
 * is a DuckDuckGo search). Desktop app only: it's an Electron <webview>, locked down in electron/main.ts (no preload,
 * no Node, sandboxed, its own cookies, http and https only, pop-ups open in the browser). Mobile pages suit the
 * panel's width, so it asks for them.
 */
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconButton } from "../ui/kit";
import "./ReferencePanel.css";

export const REFERENCE_HOME = "https://duckduckgo.com/";
/** A phone's browser: most sites send their small-screen layout, which fits the panel. */
const MOBILE_AGENT = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

/** What the address box was given, as a page to open: an address as it is (https added), anything else a search. */
export function referenceUrl(text: string): string {
  const typed = text.trim();
  if (!typed) return REFERENCE_HOME;
  if (/^https?:\/\//i.test(typed)) return typed;
  // A word with a dot and no spaces (gbstudio.dev, opengameart.org/art) reads as an address; localhost too.
  if (!/\s/.test(typed) && (/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(typed) || /^localhost(:\d+)?([/?#].*)?$/i.test(typed))) return `https://${typed}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(typed)}`;
}

/** The parts of Electron's <webview> element used here. */
interface WebviewElement extends HTMLElement {
  canGoBack(): boolean; canGoForward(): boolean; goBack(): void; goForward(): void; reload(): void; loadURL(url: string): Promise<void>; getURL(): string;
}

export function ReferencePanel() {
  const view = useRef<WebviewElement | null>(null);
  const [address, setAddress] = useState(REFERENCE_HOME);
  const [editing, setEditing] = useState(false);
  const [nav, setNav] = useState({ back: false, forward: false, loading: false });

  useEffect(() => {
    const element = view.current;
    if (!element) return;
    const sync = () => {
      try { setNav((was) => ({ ...was, back: element.canGoBack(), forward: element.canGoForward() })); if (!editing) setAddress(element.getURL()); } catch { /* not attached yet */ }
    };
    const start = () => setNav((was) => ({ ...was, loading: true })), stop = () => { setNav((was) => ({ ...was, loading: false })); sync(); };
    element.addEventListener("did-navigate", sync);
    element.addEventListener("did-navigate-in-page", sync);
    element.addEventListener("did-start-loading", start);
    element.addEventListener("did-stop-loading", stop);
    return () => {
      element.removeEventListener("did-navigate", sync);
      element.removeEventListener("did-navigate-in-page", sync);
      element.removeEventListener("did-start-loading", start);
      element.removeEventListener("did-stop-loading", stop);
    };
  }, [editing]);

  function go(event: FormEvent) {
    event.preventDefault();
    const next = referenceUrl(address);
    setAddress(next);
    setEditing(false);
    void view.current?.loadURL(next).catch(() => { /* a page that fails shows its own error */ });
    (document.activeElement as HTMLElement | null)?.blur();
  }

  return (
    <div className="rb">
      <form className="rb-bar" onSubmit={go}>
        <IconButton size="sm" variant="ghost" label="Back" disabled={!nav.back} onClick={() => view.current?.goBack()}><ArrowLeft /></IconButton>
        <IconButton size="sm" variant="ghost" label="Forward" disabled={!nav.forward} onClick={() => view.current?.goForward()}><ArrowRight /></IconButton>
        <IconButton size="sm" variant="ghost" label="Reload" onClick={() => view.current?.reload()}><RotateCw className={nav.loading ? "rb-spin" : undefined} /></IconButton>
        <input className="k-input rb-address" type="text" spellCheck={false} aria-label="Address or DuckDuckGo search" placeholder="Search or type an address" value={address}
          onFocus={(event) => { setEditing(true); event.target.select(); }} onBlur={() => setEditing(false)} onChange={(event) => setAddress(event.target.value)} />
      </form>
      <webview ref={(element) => { view.current = element as unknown as WebviewElement | null; }} className="rb-view" src={REFERENCE_HOME} partition="persist:reference" useragent={MOBILE_AGENT} />
    </div>
  );
}
