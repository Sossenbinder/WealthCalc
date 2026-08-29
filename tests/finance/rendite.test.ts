import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import { calculateSparplan } from "@/lib/engine/finance/zinseszins";
import {
  berechneRendite,
  UNERREICHBAR,
  type RenditeInput,
} from "@/lib/engine/finance/rendite";

const run = (over: Partial<RenditeInput> = {}) => {
  const r = berechneRendite({
    startkapital: euros(10_000),
    endkapital: euros(20_000),
    monatlicheEinzahlung: 0,
    jahre: 10,
    ...over,
  });
  if (r === UNERREICHBAR) throw new Error("expected a reachable return");
  return r;
};

describe("Rendite", () => {
  it("matches the closed form when nothing was paid in", () => {
    // Verdopplung in 10 Jahren: 2^(1/10) - 1 = 7,1773 %
    const r = run();
    expect(r.rendite).toBeCloseTo(7.1773, 2);
    expect(r.einfacheWertsteigerung).toBeCloseTo(7.1773, 2);
  });

  it("reproduces the end value when fed back into the projection", () => {
    const input = {
      startkapital: euros(10_000),
      endkapital: euros(150_000),
      monatlicheEinzahlung: euros(500),
      jahre: 15,
    };
    const r = run(input);
    const nachgerechnet = calculateSparplan({
      startCapital: input.startkapital,
      monthlyContribution: input.monatlicheEinzahlung,
      annualReturn: r.rendite,
      years: input.jahre,
      timing: "end",
      annualInflation: 0,
      contributionIncrease: 0,
    }).finalBalance;
    expect(Math.abs(nachgerechnet - input.endkapital)).toBeLessThan(euros(1));
  });

  it("does not credit contributions to the return", () => {
    // Mit Einzahlungen ist die einfache Wertsteigerung zu optimistisch.
    const r = run({ monatlicheEinzahlung: euros(500) });
    expect(r.einfacheWertsteigerung).toBeGreaterThan(r.rendite);
  });

  it("counts everything paid in", () => {
    const r = run({ monatlicheEinzahlung: euros(100) });
    // 10.000 + 100 × 12 × 10
    expect(r.eingezahlt).toBe(euros(22_000));
    expect(r.gewinn).toBe(euros(20_000) - euros(22_000));
  });

  it("reports a negative return on a loss", () => {
    const r = run({ endkapital: euros(6_000) });
    expect(r.rendite).toBeLessThan(0);
  });

  it("is zero when nothing grew", () => {
    const r = run({ endkapital: euros(10_000) });
    expect(r.rendite).toBeCloseTo(0, 4);
  });

  it("gives up when the end value is out of reach", () => {
    expect(
      berechneRendite({
        startkapital: euros(10_000),
        endkapital: euros(1),
        monatlicheEinzahlung: euros(5_000),
        jahre: 10,
      }),
    ).toBe(UNERREICHBAR);
  });
});
