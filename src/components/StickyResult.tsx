"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@/components/icons";

/**
 * The answer, kept on screen while you change the inputs.
 *
 * On a phone the result card sits above a form that is taller than the
 * viewport, so adjusting a rate meant scrolling down to type and back up to see
 * what it did — the one loop these calculators exist for. This mirrors the
 * headline figure into a bar at the bottom edge as soon as the card itself
 * scrolls away, and disappears again when it comes back.
 *
 * It reads the card rather than taking the value as a prop: the figure is
 * already rendered, in 21 different calculators, and each one formats and
 * labels it differently. Mirroring the DOM keeps that single source and needs
 * nothing from the calculators but three data attributes.
 */
export function StickyResult() {
  const [text, setText] = useState<{ label: string; value: string } | null>(
    null,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const card = document.querySelector<HTMLElement>("[data-result-card]");
    if (!card) return;

    const read = () => {
      const label = card
        .querySelector<HTMLElement>("[data-result-label]")
        ?.textContent?.trim();
      const value = card
        .querySelector<HTMLElement>("[data-result-value]")
        ?.textContent?.trim();
      if (!label || !value) return;
      setText((current) =>
        current?.label === label && current?.value === value
          ? current
          : { label, value },
      );
    };

    read();

    // The calculators re-render on every keystroke, so the mirrored figure has
    // to follow the card rather than being read once.
    const mutations = new MutationObserver(read);
    mutations.observe(card, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    const intersection = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      // A card that is only just off the top counts as gone; the small margin
      // stops the bar flickering in and out at the boundary.
      { rootMargin: "-72px 0px 0px 0px", threshold: 0 },
    );
    intersection.observe(card);

    return () => {
      mutations.disconnect();
      intersection.disconnect();
    };
  }, []);

  if (!text) return null;

  return (
    <div
      // Hidden rather than unmounted so the slide is animatable, and inert
      // while hidden so the button never turns up in the tab order behind the
      // page. Desktop keeps the card in view beside the form, so it is only a
      // small-screen affordance.
      inert={!visible}
      aria-hidden={!visible}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 py-2.5 transition-transform duration-200 lg:hidden print:hidden"
      style={{
        boxShadow: "var(--shadow-lg)",
        paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))",
        transform: visible ? "translateY(0)" : "translateY(110%)",
      }}
    >
      <button
        type="button"
        onClick={() =>
          document
            .querySelector("[data-result-card]")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-muted">
            {text.label}
          </span>
          <span className="block truncate text-lg font-semibold tabular-nums">
            {text.value}
          </span>
        </span>
        <span className="badge shrink-0">
          Zum Ergebnis
          <ArrowRightIcon width={14} height={14} />
        </span>
      </button>
    </div>
  );
}
