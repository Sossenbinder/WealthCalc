"use client";

import { useEffect, useState, type ReactNode } from "react";

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
 * Copy the current scenario's link.
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
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-4 print:hidden">
      {children}
      <button
        type="button"
        onClick={copy}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        Link kopieren
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
