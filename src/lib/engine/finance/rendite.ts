import type { Money } from "../money";
import { calculateSparplan } from "./zinseszins";

export interface RenditeInput {
  startkapital: Money;
  endkapital: Money;
  /** Regular monthly contribution paid in over the period, 0 if none. */
  monatlicheEinzahlung: Money;
  jahre: number;
}

export interface RenditeResult {
  /** Effective annual return, as a percentage. */
  rendite: number;
  /** Start capital plus every contribution. */
  eingezahlt: Money;
  /** End value less everything paid in — can be negative. */
  gewinn: Money;
  /**
   * Growth per year ignoring contributions. Only equal to `rendite` when
   * nothing was paid in along the way; otherwise it flatters the result,
   * because it credits the return with money that was not invested for the
   * full period.
   */
  einfacheWertsteigerung: number;
}

/** The end value cannot be reached by any return in the searched range. */
export const UNERREICHBAR = "unerreichbar";

const MIN_RENDITE = -99.9;
const MAX_RENDITE = 1000;

/**
 * Work out the annual return a portfolio actually achieved.
 *
 * With contributions there is no closed form — a euro paid in last month has
 * not had a year to grow — so this bisects the same projection the
 * Sparplanrechner uses: the answer is the rate that reproduces the end value
 * from the start value and the contributions. That makes it money-weighted,
 * the return on the money as it was actually invested.
 */
export function berechneRendite(
  input: RenditeInput,
): RenditeResult | typeof UNERREICHBAR {
  const eingezahlt =
    input.startkapital + input.monatlicheEinzahlung * 12 * input.jahre;

  const endwertBei = (rendite: number) =>
    calculateSparplan({
      startCapital: input.startkapital,
      monthlyContribution: input.monatlicheEinzahlung,
      annualReturn: rendite,
      years: input.jahre,
      timing: "end",
      annualInflation: 0,
      contributionIncrease: 0,
    }).finalBalance;

  if (endwertBei(MIN_RENDITE) > input.endkapital) return UNERREICHBAR;
  if (endwertBei(MAX_RENDITE) < input.endkapital) return UNERREICHBAR;

  // Bisection on the rate: the end value rises monotonically with it.
  let low = MIN_RENDITE;
  let high = MAX_RENDITE;
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    if (endwertBei(mid) < input.endkapital) low = mid;
    else high = mid;
  }
  let rendite = (low + high) / 2;

  // Interest is rounded to the cent each month, so a whole band of rates
  // reproduces the same end value and the bisection settles on its lower edge
  // — reporting -0,0006 % for a portfolio that did not move. Where a flat
  // return fits the data just as well, say flat.
  if (Math.abs(rendite) < 0.01 && endwertBei(0) === input.endkapital) {
    rendite = 0;
  }

  const einfacheWertsteigerung =
    input.startkapital > 0
      ? (Math.pow(input.endkapital / input.startkapital, 1 / input.jahre) - 1) *
        100
      : 0;

  return {
    rendite,
    eingezahlt,
    gewinn: input.endkapital - eingezahlt,
    einfacheWertsteigerung,
  };
}
