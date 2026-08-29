import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneEntnahmeplan,
  solveEntnahme,
  type EntnahmeInput,
} from "@/lib/engine/finance/entnahmeplan";

const base: EntnahmeInput = {
  startkapital: euros(500_000),
  monatlicheEntnahme: euros(2_000),
  rendite: 5,
  inflation: 2,
  jahre: 30,
};

describe("Entnahmeplan", () => {
  it("runs the capital down with no return and no inflation", () => {
    // 240.000 € bei 1.000 €/Monat sind exakt 20 Jahre.
    const r = berechneEntnahmeplan({
      startkapital: euros(240_000),
      monatlicheEntnahme: euros(1_000),
      rendite: 0,
      inflation: 0,
      jahre: 30,
    });
    expect(r.erschoepftNachMonaten).toBe(240);
    expect(r.gesamtEntnommen).toBe(euros(240_000));
  });

  it("never lets the capital go negative", () => {
    const r = berechneEntnahmeplan({ ...base, monatlicheEntnahme: euros(9_000) });
    expect(r.endkapital).toBeGreaterThanOrEqual(0);
    for (const jahr of r.jahre) expect(jahr.endkapital).toBeGreaterThanOrEqual(0);
  });

  it("raises the withdrawal each year by inflation", () => {
    const r = berechneEntnahmeplan(base);
    expect(r.jahre[0].monatlicheEntnahme).toBe(euros(2_000));
    expect(r.jahre[1].monatlicheEntnahme).toBe(euros(2_040));
  });

  it("lasts longer with a higher return", () => {
    const mager = berechneEntnahmeplan({ ...base, rendite: 1 });
    const gut = berechneEntnahmeplan({ ...base, rendite: 7 });
    const dauer = (r: ReturnType<typeof berechneEntnahmeplan>) =>
      r.erschoepftNachMonaten ?? Number.POSITIVE_INFINITY;
    expect(dauer(gut)).toBeGreaterThan(dauer(mager));
  });

  it("runs out sooner when withdrawals climb with inflation", () => {
    const stabil = berechneEntnahmeplan({ ...base, inflation: 0 });
    const teuer = berechneEntnahmeplan({ ...base, inflation: 5 });
    const dauer = (r: ReturnType<typeof berechneEntnahmeplan>) =>
      r.erschoepftNachMonaten ?? Number.POSITIVE_INFINITY;
    expect(dauer(teuer)).toBeLessThan(dauer(stabil));
  });

  it("reports survival rather than a depletion month when it lasts", () => {
    const r = berechneEntnahmeplan({ ...base, monatlicheEntnahme: euros(500) });
    expect(r.erschoepftNachMonaten).toBeNull();
    expect(r.endkapital).toBeGreaterThan(0);
  });

  it("keeps the yearly rows consistent with the running balance", () => {
    const r = berechneEntnahmeplan(base);
    for (const jahr of r.jahre) {
      expect(jahr.startkapital + jahr.rendite - jahr.entnahmen).toBe(
        jahr.endkapital,
      );
    }
  });
});

describe("solveEntnahme", () => {
  const ziel = { ...base, monatlicheEntnahme: 0 };

  it("finds a withdrawal that lasts the whole horizon", () => {
    const rate = solveEntnahme(ziel);
    expect(
      berechneEntnahmeplan({ ...ziel, monatlicheEntnahme: rate })
        .erschoepftNachMonaten,
    ).toBeNull();
  });

  it("finds the largest such withdrawal, not merely a safe one", () => {
    const rate = solveEntnahme(ziel);
    expect(
      berechneEntnahmeplan({ ...ziel, monatlicheEntnahme: rate + 1 })
        .erschoepftNachMonaten,
    ).not.toBeNull();
  });

  it("allows more when the horizon is shorter", () => {
    expect(solveEntnahme({ ...ziel, jahre: 15 })).toBeGreaterThan(
      solveEntnahme({ ...ziel, jahre: 40 }),
    );
  });

  it("allows more when returns are better", () => {
    expect(solveEntnahme({ ...ziel, rendite: 7 })).toBeGreaterThan(
      solveEntnahme({ ...ziel, rendite: 2 }),
    );
  });
});
