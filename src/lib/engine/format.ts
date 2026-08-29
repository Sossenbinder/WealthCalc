import { roundHalfAwayFromZero, type Money } from "./money";

/**
 * German number input and output.
 *
 * German users type `1.234,56`, but they also paste `1234.56` out of a
 * spreadsheet and type `1234`. Getting this wrong produces answers that are
 * wrong by a factor of 100 while still looking entirely plausible, so every
 * rule below is pinned by a test.
 */

const CURRENCY_NOISE = /[\s   €]|EUR/gi;

/**
 * Reduce user input to a canonical `-1234.56` string, or null if it is not a
 * number at all.
 *
 * Separator rules:
 * - A comma is always the decimal separator; dots are then thousands groupings.
 * - With dots only, several dots are thousands groupings.
 * - A single dot followed by exactly three digits is a thousands grouping
 *   (`1.234` is 1234, the German reading), otherwise it is a decimal point
 *   (`1.5` is 1.5, the spreadsheet reading).
 */
export function normalizeGermanNumber(input: string): string | null {
  const cleaned = input.replace(CURRENCY_NOISE, "");
  if (cleaned === "") return null;

  const signMatch = /^([+-])?(.*)$/.exec(cleaned);
  if (!signMatch) return null;
  const sign = signMatch[1] === "-" ? "-" : "";
  let body = signMatch[2];

  if (!/^[\d.,]+$/.test(body)) return null;

  const commaCount = (body.match(/,/g) ?? []).length;
  const dotCount = (body.match(/\./g) ?? []).length;

  if (commaCount > 1) return null;

  if (commaCount === 1) {
    body = body.replace(/\./g, "").replace(",", ".");
  } else if (dotCount > 1) {
    body = body.replace(/\./g, "");
  } else if (dotCount === 1) {
    const [whole, frac] = body.split(".");
    if (whole.length > 0 && frac.length === 3) body = whole + frac;
  }

  if (!/^\d*\.?\d*$/.test(body)) return null;
  if (body === "" || body === ".") return null;

  return sign + body;
}

/** Parse user input into a plain number, or null if it is not a number. */
export function parseGermanNumber(input: string): number | null {
  const normalized = normalizeGermanNumber(input);
  if (normalized === null) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parse user input into whole cents without ever going through a float, so
 * `0,07` is 7 cents rather than 7.000000000000001.
 */
export function parseMoney(input: string): Money | null {
  const normalized = normalizeGermanNumber(input);
  if (normalized === null) return null;

  const negative = normalized.startsWith("-");
  const unsigned = normalized.replace(/^[+-]/, "");
  const [whole = "0", fraction = ""] = unsigned.split(".");

  const centsFromWhole = Number(whole || "0") * 100;
  const paddedFraction = (fraction + "00").slice(0, 3);
  const centsFromFraction = Number(paddedFraction.slice(0, 2));
  const roundingDigit = Number(paddedFraction[2] ?? "0");

  let cents = centsFromWhole + centsFromFraction + (roundingDigit >= 5 ? 1 : 0);
  if (!Number.isFinite(cents)) return null;
  if (negative) cents = -cents;
  return cents;
}

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const euroWholeFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** `123456` -> `1.234,56 €` */
export function formatEuro(value: Money): string {
  return euroFormatter.format(value / 100);
}

/** `123456` -> `1.235 €` — for table columns where cents are noise. */
export function formatEuroWhole(value: Money): string {
  return euroWholeFormatter.format(roundHalfAwayFromZero(value / 100));
}

/** `7` -> `7,00 %` */
export function formatPercent(value: number, fractionDigits = 2): string {
  return (
    new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value) + " %"
  );
}

/** Plain de-DE number, for editing back into an input field. */
export function formatNumber(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * de-DE number for an editable field: no trailing zeros, but every digit the
 * user actually entered. Rounding here would silently change the value,
 * because the field is re-parsed to drive the calculation.
 *
 * Ten places is past any meaningful precision for a percentage while staying
 * clear of both failure modes at the extremes: `maximumFractionDigits: 20`
 * surfaces float artifacts (0.1 + 0.2 renders as "0,30000000000000004"), and
 * `String(value)` switches to exponential notation below 1e-6, which the
 * German parser then rejects.
 */
export function formatNumberInput(value: number, maxFractionDigits = 10): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

/** Money as an editable de-DE string without the currency symbol. */
export function formatMoneyInput(value: Money): string {
  return formatNumber(value / 100, value % 100 === 0 ? 0 : 2);
}
