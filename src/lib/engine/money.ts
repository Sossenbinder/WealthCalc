/**
 * Money is represented as an integer number of cents.
 *
 * Every currency amount in WealthCalc is an integer, and every rate
 * application rounds explicitly at the point where it happens. Floating
 * point euros cannot produce cent-exact results, and "round only at the
 * end" silently drifts once interest compounds monthly over decades.
 */
export type Money = number;

export const ZERO: Money = 0;

/**
 * Commercial rounding (kaufmaennisches Runden): halves go away from zero,
 * so -2.5 becomes -3 rather than JavaScript's -2.
 */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Build Money from a euro amount. Prefer parseMoney for user input. */
export function euros(amount: number): Money {
  return roundHalfAwayFromZero(amount * 100);
}

export function toEuros(value: Money): number {
  return value / 100;
}

export function add(a: Money, b: Money): Money {
  return a + b;
}

export function subtract(a: Money, b: Money): Money {
  return a - b;
}

/**
 * Apply a decimal rate (0.07 for 7 %) and round to whole cents.
 * This is the only sanctioned way to multiply Money by a rate.
 */
export function applyRate(value: Money, rate: number): Money {
  return roundHalfAwayFromZero(value * rate);
}

/**
 * Banker's rounding: halves go to the nearest even cent.
 *
 * The tax engine uses this rather than {@link roundHalfAwayFromZero}, because
 * the C# `TaxEngine` it is ported from rounds every money operation with
 * `MidpointRounding.ToEven`. The ported test vectors only reproduce to the cent
 * if the rounding mode is carried across with them.
 */
export function roundHalfToEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Apply a decimal rate with banker's rounding, as the tax engine requires. */
export function applyRateToEven(value: Money, rate: number): Money {
  return roundHalfToEven(value * rate);
}
