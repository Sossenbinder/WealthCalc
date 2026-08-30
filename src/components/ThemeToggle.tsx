"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon, SystemIcon } from "@/components/icons";

export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "wealthcalc-theme";
const CHANGE_EVENT = "wealthcalc:theme";
const ORDER: ThemeChoice[] = ["system", "light", "dark"];

const LABEL: Record<ThemeChoice, string> = {
  system: "Systemeinstellung",
  light: "Hell",
  dark: "Dunkel",
};

/**
 * The script that runs before the first paint.
 *
 * Without it the page renders in the OS theme, then swaps to the stored choice
 * once React hydrates — a white flash for anyone who picked dark. Inlined in
 * <head> and deliberately tiny; it only sets the attribute the CSS reads.
 */
export const themeInitScript = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(c==="light"||c==="dark"){document.documentElement.dataset.theme=c}}catch(e){}})()`;

/**
 * The stored choice, as an external store.
 *
 * localStorage is exactly what `useSyncExternalStore` is for: the server cannot
 * read it, so hydration uses the server snapshot and the real value lands right
 * after — no effect, no re-render cascade, and no flash of the wrong icon. The
 * `storage` event keeps a second tab in step.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // A browser with storage blocked still gets a working toggle; it just does
    // not remember the choice between visits.
  }
  return "system";
}

const serverChoice = (): ThemeChoice => "system";

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, readChoice, serverChoice);

  const next = () => {
    const value = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];

    const root = document.documentElement;
    if (value === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = value;
    }

    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignored — see above.
    }
    // `storage` does not fire in the tab that wrote it.
    window.dispatchEvent(new Event(CHANGE_EVENT));

    // Colour transitions are opt-in for the duration of the swap only, so that
    // ordinary interaction is not permanently animated.
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 260);
  };

  const Icon =
    choice === "light" ? SunIcon : choice === "dark" ? MoonIcon : SystemIcon;

  return (
    <button
      type="button"
      onClick={next}
      className="btn btn-ghost btn-icon"
      // Naming the current state and not just "Theme" means a screen reader
      // announces what changed after the press, since the label updates.
      aria-label={`Darstellung: ${LABEL[choice]}. Umschalten.`}
      title={`Darstellung: ${LABEL[choice]}`}
    >
      <Icon />
    </button>
  );
}
