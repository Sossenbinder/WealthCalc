import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import { calculateSparplan } from "@/lib/engine/finance/zinseszins";
import { berechneEntnahmeplan } from "@/lib/engine/finance/entnahmeplan";
import {
  createNormal,
  createRng,
  simuliereMonteCarlo,
  type MonteCarloInput,
} from "@/lib/engine/finance/monte-carlo";

const base: MonteCarloInput = {
  startkapital: euros(10_000),
  sparrate: euros(500),
  dynamik: 0,
  ansparJahre: 20,
  rendite: 7,
  volatilitaet: 15,
  kosten: 0,
  inflation: 2,
  zielkapital: 0,
  entnahme: 0,
  entnahmeJahre: 0,
  simulationen: 2_000,
  seed: 42,
};

const run = (over: Partial<MonteCarloInput> = {}) =>
  simuliereMonteCarlo({ ...base, ...over });

describe("Zufallsgenerator", () => {
  it("is reproducible from its seed", () => {
    const a = createRng(7);
    const b = createRng(7);
    const c = createRng(8);
    const folgeA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(folgeA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(folgeA);
    for (const u of folgeA) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it("draws standard normal values", () => {
    const normal = createNormal(createRng(1));
    const n = 200_000;
    let summe = 0;
    let quadrate = 0;
    for (let i = 0; i < n; i++) {
      const z = normal();
      summe += z;
      quadrate += z * z;
    }
    const mittel = summe / n;
    expect(Math.abs(mittel)).toBeLessThan(0.01);
    expect(quadrate / n - mittel * mittel).toBeCloseTo(1, 1);
  });
});

describe("ohne Volatilität", () => {
  it("is the Sparplanrechner to the cent, on every path", () => {
    const r = run({ volatilitaet: 0, dynamik: 3, simulationen: 10 });
    const sparplan = calculateSparplan({
      startCapital: base.startkapital,
      monthlyContribution: base.sparrate,
      annualReturn: base.rendite,
      years: base.ansparJahre,
      timing: "end",
      annualInflation: base.inflation,
      contributionIncrease: 3,
    });
    for (const zeile of sparplan.years) {
      const jahr = r.jahre[zeile.year];
      expect(jahr.perzentile[5]).toBe(zeile.closingBalance);
      expect(jahr.perzentile[95]).toBe(zeile.closingBalance);
      expect(jahr.eingezahlt).toBe(zeile.totalPaidIn);
    }
    expect(r.ansparEnde.perzentile[50]).toBe(sparplan.finalBalance);
    expect(r.ansparEnde.mittelwert).toBe(sparplan.finalBalance);
  });

  it("subtracts the TER from the return multiplicatively", () => {
    // (1,07 × 0,99) − 1 = 5,93 % effektiv
    const r = run({ volatilitaet: 0, kosten: 1, simulationen: 1 });
    const sparplan = calculateSparplan({
      startCapital: base.startkapital,
      monthlyContribution: base.sparrate,
      annualReturn: 5.93,
      years: base.ansparJahre,
      timing: "end",
      annualInflation: 0,
      contributionIncrease: 0,
    });
    expect(r.ansparEnde.perzentile[50]).toBe(sparplan.finalBalance);
  });

  it("continues as the Entnahmeplan-Rechner, with the withdrawal indexed from today", () => {
    const r = run({
      volatilitaet: 0,
      simulationen: 1,
      entnahme: euros(1_000),
      entnahmeJahre: 25,
    });
    // 1.000 € heute sind nach 20 Jahren zu 2 % 1.485,95 €.
    expect(r.entnahme?.ersteEntnahme).toBe(euros(1_485.95));

    const plan = berechneEntnahmeplan({
      startkapital: r.ansparEnde.perzentile[50],
      monatlicheEntnahme: euros(1_485.95),
      rendite: 7,
      inflation: 2,
      jahre: 25,
    });
    for (const zeile of plan.jahre) {
      expect(r.jahre[base.ansparJahre + zeile.jahr].perzentile[50]).toBe(zeile.endkapital);
    }
    expect(r.entnahme?.erfolgsQuote).toBe(plan.erschoepftNachMonaten === null ? 1 : 0);
  });

  it("reports the month the money ran out", () => {
    // 12.000 € bei 0 %, 1.000 € im Monat: genau ein Jahr.
    const r = run({
      startkapital: euros(12_000),
      sparrate: 0,
      ansparJahre: 0,
      rendite: 0,
      volatilitaet: 0,
      inflation: 0,
      entnahme: euros(1_000),
      entnahmeJahre: 3,
      simulationen: 50,
    });
    expect(r.entnahme?.erfolgsQuote).toBe(0);
    expect(r.entnahme?.erschoepftMedianJahre).toBe(1);
    expect(r.entnahme?.erschoepftP10Jahre).toBe(1);
    expect(r.jahre[1].nochKapital).toBe(0);
    expect(r.jahre[3].perzentile[95]).toBe(0);
  });
});

describe("mit Volatilität", () => {
  it("is reproducible: same seed, same result", () => {
    expect(run()).toEqual(run());
    expect(run({ seed: 43 }).ansparEnde).not.toEqual(run().ansparEnde);
  });

  it("puts the median of a lump sum on the stated return", () => {
    // Median von 10.000 € × exp(N(20·ln 1,07, 0,15²·20)) = 10.000 × 1,07^20
    const r = run({ sparrate: 0, simulationen: 20_000 });
    const erwartet = euros(10_000 * Math.pow(1.07, 20));
    expect(r.ansparEnde.perzentile[50] / erwartet).toBeCloseTo(1, 1);
    // ... and its mean above it, by exp(σ²·T/2) ≈ 1,25.
    expect(r.ansparEnde.mittelwert / erwartet).toBeGreaterThan(1.15);
    expect(r.ansparEnde.mittelwert / erwartet).toBeLessThan(1.35);
  });

  it("orders the percentiles and widens the fan over time", () => {
    const r = run();
    for (const jahr of r.jahre.slice(1)) {
      const p = jahr.perzentile;
      expect(p[5]).toBeLessThanOrEqual(p[10]);
      expect(p[10]).toBeLessThanOrEqual(p[25]);
      expect(p[25]).toBeLessThanOrEqual(p[50]);
      expect(p[50]).toBeLessThanOrEqual(p[75]);
      expect(p[75]).toBeLessThanOrEqual(p[90]);
      expect(p[90]).toBeLessThanOrEqual(p[95]);
    }
    const spanne = (j: number) =>
      r.jahre[j].perzentile[95] / r.jahre[j].perzentile[5];
    expect(spanne(20)).toBeGreaterThan(spanne(5));
  });

  it("counts targets reached and losses against what was paid in", () => {
    const r = run({ zielkapital: euros(250_000) });
    expect(r.ansparEnde.eingezahlt).toBe(euros(10_000 + 500 * 12 * 20));
    expect(r.ansparEnde.zielQuote).toBeGreaterThan(0.3);
    expect(r.ansparEnde.zielQuote).toBeLessThan(0.8);
    expect(r.ansparEnde.verlustQuote).toBeGreaterThan(0);
    expect(r.ansparEnde.verlustQuote).toBeLessThan(0.1);
    expect(run().ansparEnde.zielQuote).toBeNull();
  });

  it("fails some withdrawal plans that work on average", () => {
    // 4 % von 1 Mio. bei 5 % Median-Rendite trägt deterministisch dauerhaft;
    // mit 18 % Volatilität scheitert ein Teil der Verläufe an der Reihenfolge.
    const r = run({
      startkapital: euros(1_000_000),
      sparrate: 0,
      ansparJahre: 0,
      rendite: 5,
      volatilitaet: 18,
      inflation: 2,
      entnahme: euros(3_333.33),
      entnahmeJahre: 40,
    });
    const quote = r.entnahme!.erfolgsQuote;
    expect(quote).toBeGreaterThan(0.4);
    expect(quote).toBeLessThan(0.98);
    expect(r.jahre[40].nochKapital).toBeCloseTo(quote, 10);
  });
});
