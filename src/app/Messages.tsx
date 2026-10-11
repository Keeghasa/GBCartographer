/**
 * Messages (the author, 2026-10-11): each message slides in at the bottom left and stays 4 seconds plus a little per
 * letter (up to 10); a click puts it away. Every message of this session is kept for the Messages window (the button
 * at the foot of the left rail), to reread one that went too fast. They live in memory only: gone when the app
 * closes or opens again.
 */
import { MessageSquareText, Trash2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button, Dialog } from "../ui/kit";
import "./Messages.css";

export interface Message { id: number; text: string; time: number }

const SHOWN_AT_ONCE = 3;

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showing, setShowing] = useState<Message[]>([]);
  const [readUpTo, setReadUpTo] = useState(0);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setShowing((now) => now.filter((item) => item.id !== id)), []);
  const say = useCallback((text: string) => {
    if (!text) return;
    const message = { id: next.current++, text, time: Date.now() };
    setMessages((now) => [...now, message]);
    setShowing((now) => [...now.filter((item) => item.text !== text), message].slice(-SHOWN_AT_ONCE));
    window.setTimeout(() => dismiss(message.id), Math.min(10000, 4000 + text.length * 40));
  }, [dismiss]);
  const unread = messages.filter((item) => item.id > readUpTo).length;
  const markRead = useCallback(() => setReadUpTo(next.current - 1), []);
  const clear = useCallback(() => { setMessages([]); setShowing([]); }, []);
  return { messages, showing, say, dismiss, unread, markRead, clear };
}

/** The messages on screen: bottom left, newest at the bottom, each sliding in. */
export function Toasts({ showing, onDismiss }: { showing: Message[]; onDismiss: (id: number) => void }) {
  if (!showing.length) return null;
  return (
    <div className="msg-toasts" role="status" aria-live="polite">
      {showing.map((item) => <button type="button" key={item.id} className="app-toast msg-toast" title="Click to put it away" onClick={() => onDismiss(item.id)}>{item.text}</button>)}
    </div>
  );
}

const clock = (time: number) => new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Every message of this session, newest first. */
export function MessagesWindow({ messages, onClose, onClear }: { messages: Message[]; onClose: () => void; onClear: () => void }) {
  return (
    <Dialog open wide onOpenChange={(open) => { if (!open) onClose(); }} title="Messages" sub="Everything GB Cartographer said since it opened (gone when it closes)" icon={<MessageSquareText size={18} />}
      footer={<>{messages.length > 0 && <Button icon={<Trash2 />} onClick={onClear}>Clear</Button>}<span className="k-spacer" /><Button variant="primary" icon={<X />} onClick={onClose}>Close</Button></>}>
      {messages.length === 0
        ? <p className="k-muted k-small">No messages yet.</p>
        : <ol className="msg-list">{[...messages].reverse().map((item) => <li key={item.id}><time className="k-mono">{clock(item.time)}</time><span>{item.text}</span></li>)}</ol>}
    </Dialog>
  );
}
