/**
 * A wizard as one neo-grotesk page (the author, 2026-10-14: "single page wizards, none of this steps and pages"): a
 * mono line over a 2 px rule, the big title with its green full stop, then everything the wizard needs at once. The
 * Wizards gallery, the Asset Catalog and 3D Snapshot share the look.
 */
import type { ReactNode } from "react";
import { Dialog } from "../ui/kit";
import "./WizardPage.css";

export function WizardPage({ title, sub, icon, line, footer, busy, onClose, children }: {
  title: string; sub?: string; icon: ReactNode;
  /** The mono line above the title: a word or two on the left, the facts on the right. */
  line: [ReactNode, ReactNode];
  footer?: ReactNode; busy?: boolean; onClose: () => void; children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }} full title={title} sub={sub} icon={icon} footer={footer}>
      <div className="wp">
        <div className="wp-top"><span>{line[0]}</span><span>{line[1]}</span></div>
        <h1 className="wp-h1"><b>{title}</b></h1>
        {children}
      </div>
    </Dialog>
  );
}
