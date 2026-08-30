"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckIcon, CopyIcon, PrintIcon } from "@/components/icons";

interface CopyLinkButtonProps {
  /**
   * Changes whenever the scenario does. A "Link kopiert" that outlives the
   * link it confirmed is a small lie, so the confirmation clears with it.
   */
  scenarioKey?: string;
  /** Rendered before the copy button — e.g. a hand-over action. */
  children?: ReactNode;
}

/**
 * Take the scenario with you: copy its link, or print the page.
 *
 * The scenario already lives in the query string; this exists because nothing
 * on the page said so. The URLs run past a hundred characters, which is not
 * something anyone is going to pick out of a phone's address bar.
 */
export function CopyLinkButton({ scenarioKey, children }: CopyLinkButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    setState("idle");
  }, [scenarioKey]);

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 print:hidden">
      {children}
      <button
        type="button"
        onClick={copy}
        className="btn btn-secondary"
        // The label stays put while the state changes: a button whose text
        // swaps under the pointer is easy to click twice by accident.
      >
        {state === "copied" ? (
          <CheckIcon width={16} height={16} className="text-accent" />
        ) : (
          <CopyIcon width={16} height={16} />
        )}
        Link kopieren
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="btn btn-secondary"
      >
        <PrintIcon width={16} height={16} />
        Drucken
      </button>
      <span aria-live="polite" className="text-sm text-muted">
        {state === "copied"
          ? "Link kopiert — er enthält deine Eingaben."
          : state === "failed"
            ? "Kopieren nicht möglich — bitte die Adresszeile verwenden."
            : ""}
      </span>
    </div>
  );
}
