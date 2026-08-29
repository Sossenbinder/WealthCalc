import { describe, expect, it } from "vitest";
import {
  calculateSparplan,
  solveMonthlyContribution,
  solveYears,
  type SparplanInput,
} from "@/lib/engine/finance/zinseszins";

const calculateSolved = solveMonthlyContribution;

const base: SparplanInput = {
  startCapital: 0,
  monthlyContribution: 0,
  annualReturn: 0,
  years: 10,
  timing: "end",
  annualInflation: 0,
  contributionIncrease: 0,
};

describe("calculateSparplan", () => {
  it("compounds a one-off investment at the stated effective annual rate", () => {
    const result = calculateSparplan({
      ...base,
      startCapital: 1_000_000,
      annualReturn: 7,
      years: 1,
    });

    // 10.000 € at an effective 7 % is 10.700 € after twelve months, give or
    // take the cent-rounding applied each month.
    expect(result.finalBalance).toBeGreaterThan(1_069_990);
    expect(result.finalBalance).toBeLessThan(1_070_010);
  });

  it("compounds over multiple years", () => {
    const result = calculateSparplan({
      ...base,
      startCapital: 1_000_000,
      annualReturn: 7,
      years: 10,
    });

    const expected = 1_000_000 * Math.pow(1.07, 10);
    expect(Math.abs(result.finalBalance - expected)).toBeLessThan(200);
  });

  it("adds contributions without interest when the return is zero", () => {
    const result = calculateSparplan({
      ...base,
      startCapital: 500_000,
      monthlyContribution: 10_000,
      years: 10,
    });

    expect(result.finalBalance).toBe(500_000 + 10_000 * 12 * 10);
    expect(result.totalInterest).toBe(0);
    expect(result.totalPaidIn).toBe(result.finalBalance);
  });

  it("keeps paid-in plus interest equal to the balance in every year", () => {
    const result = calculateSparplan({
      ...base,
      startCapital: 250_000,
      monthlyContribution: 25_000,
      annualReturn: 6.5,
      years: 25,
    });

    for (const row of result.years) {
      expect(row.totalPaidIn + row.totalInterest).toBe(row.closingBalance);
    }
    expect(result.totalPaidIn + result.totalInterest).toBe(result.finalBalance);
  });

  it("pays more when contributions land at the start of the month", () => {
    const atEnd = calculateSparplan({
      ...base,
      monthlyContribution: 20_000,
      annualReturn: 7,
      timing: "end",
    });
    const atStart = calculateSparplan({
      ...base,
      monthlyContribution: 20_000,
      annualReturn: 7,
      timing: "begin",
    });

    expect(atStart.finalBalance).toBeGreaterThan(atEnd.finalBalance);
  });

  it("raises the contribution once per year when a Dynamik is set", () => {
    const result = calculateSparplan({
      ...base,
      monthlyContribution: 10_000,
      contributionIncrease: 10,
      years: 2,
    });

    expect(result.years[0].contributions).toBe(10_000 * 12);
    expect(result.years[1].contributions).toBe(11_000 * 12);
    expect(result.totalPaidIn).toBe(10_000 * 12 + 11_000 * 12);
  });

  it("discounts the closing balance to today's purchasing power", () => {
    const result = calculateSparplan({
      ...base,
      startCapital: 1_000_000,
      annualInflation: 2,
      years: 10,
    });

    expect(result.finalBalance).toBe(1_000_000);
    const expected = 1_000_000 / Math.pow(1.02, 10);
    expect(Math.abs(result.realFinalBalance - expected)).toBeLessThan(1);
  });

  it("returns the start capital when the horizon is zero years", () => {
    const result = calculateSparplan({ ...base, startCapital: 700_000, years: 0 });
    expect(result.years).toHaveLength(0);
    expect(result.finalBalance).toBe(700_000);
  });
});

describe("solveMonthlyContribution", () => {
  const goal = {
    startCapital: 0,
    annualReturn: 6,
    years: 25,
    timing: "end" as const,
    annualInflation: 2,
    contributionIncrease: 0,
  };

  it("finds the rate that reaches the target", () => {
    const rate = calculateSolved(goal, 50_000_000);
    expect(rate).not.toBeNull();
    const reached = calculateSparplan({
      ...goal,
      monthlyContribution: rate!,
    }).finalBalance;
    expect(reached).toBeGreaterThanOrEqual(50_000_000);
  });

  it("returns the smallest contribution that still reaches the target", () => {
    const rate = calculateSolved(goal, 50_000_000)!;
    const oneCentLess = calculateSparplan({
      ...goal,
      monthlyContribution: rate - 1,
    }).finalBalance;
    expect(oneCentLess).toBeLessThan(50_000_000);
  });

  it("asks for nothing when the start capital already gets there", () => {
    expect(
      calculateSolved({ ...goal, startCapital: 50_000_000 }, 10_000_000),
    ).toBe(0);
  });

  it("solves with a Dynamik applied", () => {
    const dynamic = { ...goal, contributionIncrease: 3 };
    const rate = calculateSolved(dynamic, 50_000_000)!;
    expect(
      calculateSparplan({ ...dynamic, monthlyContribution: rate })
        .finalBalance,
    ).toBeGreaterThanOrEqual(50_000_000);
    // A rising contribution needs a lower starting rate than a flat one.
    expect(rate).toBeLessThan(calculateSolved(goal, 50_000_000)!);
  });

  it("gives up when no contribution can reach the target", () => {
    // Over a zero-year horizon nothing is ever paid in, so no rate helps.
    expect(calculateSolved({ ...goal, years: 0 }, 10_000_000)).toBeNull();
  });

  it("still answers when the required rate is punitive rather than impossible", () => {
    // A brutal negative return does not make a target unreachable, it just
    // makes it expensive — the solver must return the number, not null.
    const rate = calculateSolved({ ...goal, annualReturn: -50 }, 1_000_000_00);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0);
  });
});

describe("contribution growth is reported, not just applied", () => {
  it("records the contribution actually paid in each year", () => {
    const result = calculateSparplan({
      ...base,
      monthlyContribution: 30_000,
      contributionIncrease: 10,
      years: 3,
    });

    expect(result.years.map((row) => row.monthlyContribution)).toEqual([
      30_000, 33_000, 36_300,
    ]);
  });

  it("keeps the yearly total consistent with the monthly figure it reports", () => {
    const result = calculateSparplan({
      ...base,
      monthlyContribution: 30_000,
      contributionIncrease: 3,
      years: 35,
    });

    for (const row of result.years) {
      expect(row.contributions).toBe(row.monthlyContribution * 12);
    }
  });

  it("reports what the rate has grown to by the final year", () => {
    const result = calculateSparplan({
      ...base,
      monthlyContribution: 30_000,
      contributionIncrease: 3,
      years: 35,
    });

    expect(result.finalMonthlyContribution).toBe(
      result.years[result.years.length - 1].monthlyContribution,
    );
    // 300 € rising 3 % a year for 34 further years is roughly 820 €.
    expect(result.finalMonthlyContribution).toBeGreaterThan(81_000);
    expect(result.finalMonthlyContribution).toBeLessThan(83_000);
  });

  it("reports the unchanged rate when there is no Dynamik", () => {
    const result = calculateSparplan({ ...base, monthlyContribution: 25_000 });
    expect(result.finalMonthlyContribution).toBe(25_000);
  });
});

describe("solveYears", () => {
  const plan = {
    startCapital: 1_000_000,
    monthlyContribution: 40_000,
    annualReturn: 6,
    timing: "end" as const,
    annualInflation: 2,
    contributionIncrease: 0,
  };

  it("finds the first year that reaches the target", () => {
    const years = solveYears(plan, 100_000_00, 80);
    expect(years).toBe(12);
  });

  it("returns the FIRST such year, not merely one that works", () => {
    const years = solveYears(plan, 100_000_00, 80)!;
    expect(
      calculateSparplan({ ...plan, years }).finalBalance,
    ).toBeGreaterThanOrEqual(100_000_00);
    expect(
      calculateSparplan({ ...plan, years: years - 1 }).finalBalance,
    ).toBeLessThan(100_000_00);
  });

  it("answers zero when the start capital already covers the target", () => {
    expect(solveYears({ ...plan, startCapital: 50_000_00 }, 10_000_00, 80)).toBe(0);
  });

  it("gives up when the target is out of reach within the horizon", () => {
    expect(solveYears(plan, 100_000_000_00, 80)).toBeNull();
  });

  it("needs fewer years with a Dynamik than without", () => {
    const flat = solveYears(plan, 200_000_00, 80)!;
    const rising = solveYears({ ...plan, contributionIncrease: 5 }, 200_000_00, 80)!;
    expect(rising).toBeLessThanOrEqual(flat);
  });
});
