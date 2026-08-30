"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * A value that only exists in the browser.
 *
 * The alternative — computing it in an effect and calling setState — makes the
 * component re-render itself the moment it mounts, which is exactly what
 * `react-hooks/set-state-in-effect` is about. `useSyncExternalStore` is the
 * supported way to say "the server does not know this": it renders the server
 * snapshot during hydration, so the markup matches, and swaps in the real value
 * immediately afterwards.
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  // `read` has to return the same value for the same state — React calls it on
  // every render and loops if the result is a fresh object each time.
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}
