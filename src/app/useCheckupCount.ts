/**
 * The check-up run quietly when a project opens (the author, 2026-11-02): the number of issues it would show, for a
 * badge on its card and on the Wizards button. It waits until the page is idle (opening is never held up), runs again
 * when `stamp` changes (the check-up closed), and says nothing when it fails.
 */
import { useEffect, useState } from "react";
import { checkupBadge, type CheckupIssue } from "./checkupFixes";

const HEALTH_URL = "./__cartographer/project-health";

/** `project`: the open project's path (null: none, no count). */
export function useCheckupCount(project: string | null, stamp: unknown): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (!project) return;
    let live = true;
    const run = () => fetch(HEALTH_URL, { cache: "no-cache" })
      .then((response) => response.ok ? response.json() as Promise<{ issues?: CheckupIssue[] }> : null)
      .then((report) => { if (live && report?.issues) setCount(checkupBadge(report.issues)); })
      .catch(() => undefined);
    const idle = window.requestIdleCallback ? window.requestIdleCallback(() => void run(), { timeout: 4000 }) : null;
    const timer = idle === null ? window.setTimeout(() => void run(), 1500) : null;
    return () => {
      live = false;
      if (idle !== null) window.cancelIdleCallback(idle);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [project, stamp]);
  return count;
}
