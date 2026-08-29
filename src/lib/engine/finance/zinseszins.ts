import { applyRate, roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";

export type ContributionTiming = "begin" | "end";

export interface SparplanInput {
  /** Einmalanlage at the start of year 1. */
  startCapital: Money;
  /** Recurring contribution, paid every month. */
  monthlyContribution: Money;
  /** Effective return per year, e.g. 7 for 7 %. */
  annualReturn: Percent;
  /** Whole years to project. */
  years: number;
  /** Contribution paid at the start (vorschuessig) or end (nachschuessig) of the month. */
  timing: ContributionTiming;
  /** Annual inflation used for the real, purchasing-power column. 0 disables it. */
  annualInflation: Percent;
  /** Yearly increase of the monthly contribution (Dynamik), e.g. 2 for 2 %. */
  contributionIncrease: Percent;
}

export interface SparplanYear {
  year: number;
  /** The contribution paid in each month of this year, after any Dynamik. */
  monthlyContribution: Money;
  openingBalance: Money;
  contributions: Money;
  interest: Money;
  closingBalance: Money;
  /** Start capital plus every contribution paid so far. */
  totalPaidIn: Money;
  /** Every euro of interest earned so far. */
  totalInterest: Money;
  /** closingBalance discounted to today's purchasing power. */
  realClosingBalance: Money;
}

export interface SparplanResult {
  years: SparplanYear[];
  finalBalance: Money;
  totalPaidIn: Money;
  totalInterest: Money;
  realFinalBalance: Money;
  /** What the monthly contribution has grown to in the final year. */
  finalMonthlyContribution: Money;
  /** Effective monthly rate actually used for compounding. */
  monthlyRate: number;
}

/**
 * Compound a monthly savings plan with an optional one-off starting capital.
 *
 * The stated return is an *effective* annual return: the monthly rate is
 * `(1 + r)^(1/12) - 1`, so 7 % p.a. compounds to exactly 7 % over twelve
 * months. The simpler `r / 12` used by many German calculators quietly
 * overstates the result, because twelve months of r/12 compound above r.
 *
 * Interest is rounded to whole cents every month, which is what a bank or
 * broker statement does, rather than once at the end.
 */
export function calculateSparplan(input: SparplanInput): SparplanResult {
  const {
    startCapital,
    monthlyContribution,
    annualReturn,
    years,
    timing,
    annualInflation,
    contributionIncrease,
  } = input;

  const annualRate = toDecimal(annualReturn);
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  const inflationRate = toDecimal(annualInflation);
  const increaseRate = toDecimal(contributionIncrease);

  const rows: SparplanYear[] = [];
  let balance = startCapital;
  let totalPaidIn = startCapital;
  let totalInterest = 0;
  let contribution = monthlyContribution;

  for (let year = 1; year <= years; year += 1) {
    const openingBalance = balance;
    let contributions = 0;
    let interest = 0;

    for (let month = 0; month < 12; month += 1) {
      if (timing === "begin") {
        balance += contribution;
        contributions += contribution;
      }

      const monthlyInterest = applyRate(balance, monthlyRate);
      balance += monthlyInterest;
      interest += monthlyInterest;

      if (timing === "end") {
        balance += contribution;
        contributions += contribution;
      }
    }

    totalPaidIn += contributions;
    totalInterest += interest;

    rows.push({
      year,
      monthlyContribution: contribution,
      openingBalance,
      contributions,
      interest,
      closingBalance: balance,
      totalPaidIn,
      totalInterest,
      realClosingBalance: roundHalfAwayFromZero(
        balance / Math.pow(1 + inflationRate, year),
      ),
    });

    contribution = roundHalfAwayFromZero(contribution * (1 + increaseRate));
  }

  const last = rows[rows.length - 1];

  return {
    years: rows,
    finalBalance: last?.closingBalance ?? startCapital,
    totalPaidIn: last?.totalPaidIn ?? startCapital,
    totalInterest: last?.totalInterest ?? 0,
    realFinalBalance: last?.realClosingBalance ?? startCapital,
    finalMonthlyContribution: last?.monthlyContribution ?? monthlyContribution,
    monthlyRate,
  };
}

/**
 * Solve for the monthly contribution that reaches `target`.
 *
 * The closed form for an annuity does not survive Dynamik or the per-month
 * cent rounding, so this binary-searches the real calculation instead: the
 * answer is by construction consistent with the table shown next to it, which
 * a formula-derived figure would not be.
 *
 * Returns the smallest whole-cent contribution whose final balance reaches the
 * target, 0 if the start capital gets there on its own, or null if no
 * contribution can (a negative return can outrun any deposit).
 */
export function solveMonthlyContribution(
  input: Omit<SparplanInput, "monthlyContribution">,
  target: Money,
): Money | null {
  const balanceFor = (monthlyContribution: Money) =>
    calculateSparplan({ ...input, monthlyContribution }).finalBalance;

  if (balanceFor(0) >= target) return 0;

  // Bracket the answer before searching: double until the target is cleared.
  let high = 10_000;
  const ceiling = 1_000_000_000_00;
  while (balanceFor(high) < target) {
    high *= 2;
    if (high > ceiling) return null;
  }

  let low = 0;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (balanceFor(mid) >= target) high = mid;
    else low = mid + 1;
  }
  return low;
}

/**
 * Solve for the number of whole years needed to reach `target`.
 *
 * A linear scan rather than a bisection: the balance is not guaranteed to rise
 * monotonically with time once the return is negative, and at eighty
 * iterations of a projection this costs nothing. Returns 0 when the start
 * capital already covers the target, or null when it is not reached within
 * `maxYears`.
 */
export function solveYears(
  input: Omit<SparplanInput, "years">,
  target: Money,
  maxYears: number,
): number | null {
  if (input.startCapital >= target) return 0;

  for (let years = 1; years <= maxYears; years += 1) {
    if (calculateSparplan({ ...input, years }).finalBalance >= target) {
      return years;
    }
  }
  return null;
}
