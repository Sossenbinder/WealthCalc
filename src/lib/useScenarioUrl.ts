"use client";

import { useEffect, useState } from "react";

/**
 * Keep a calculator's scenario in the query string, so a reload or a shared
 * link reproduces it.
 *
 * The ordering is the whole point. On mount the writing effect would otherwise
 * run before the reading one has applied the incoming query string, overwrite
 * it with the defaults, and leave a shared link quietly showing different
 * numbers than the sender saw. Writing is gated until the URL has been read.
 *
 * Writing is also suppressed while `writable` is false — an incomplete or
 * out-of-range form must not publish a scenario nobody entered.
 */
export function useScenarioUrl(
  applyFromUrl: (params: URLSearchParams) => void,
  buildParams: () => URLSearchParams,
  writable: boolean,
  watch: unknown,
) {
  const [urlApplied, setUrlApplied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length > 0) applyFromUrl(params);
    setUrlApplied(true);
    // Runs once, on mount, before anything is written back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!urlApplied || !writable) return;
    window.history.replaceState(null, "", `?${buildParams().toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlApplied, writable, watch]);
}

/**
 * Read a money value written by {@link moneyParam}.
 *
 * Query values are machine-written and always use a dot as the decimal point,
 * so they must not go through the German input parser, where a dot before
 * three digits means thousands.
 */
export function readMoney(
  params: URLSearchParams,
  key: string,
  fallback: number,
  max: number,
): number {
  const raw = params.get(key);
  if (raw === null || !/^-?\d*\.?\d*$/.test(raw.trim()) || raw.trim() === "") {
    return fallback;
  }
  const cents = Math.round(Number(raw) * 100);
  return Number.isFinite(cents) ? Math.min(Math.max(cents, 0), max) : fallback;
}

/** Read a plain number written by {@link numberParam}. */
export function readNumber(
  params: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
}

export const moneyParam = (cents: number) => String(cents / 100);
export const numberParam = (value: number) => String(value);
