import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import { berechneInflation } from "@/lib/engine/finance/inflation";

const base = { betrag: euros(10_000), inflation: 2, jahre: 20 };

describe("Inflation", () => {
  it("erodes purchasing power by the compounded rate", () => {
    const r = berechneInflation(base);
    // 10.000 / 1,02^20 = 6.729,71
    expect(r.kaufkraftAmEnde).toBe(euros(6_729.71));
  });

  it("keeps the two directions distinct", () => {
    // Was übrig bleibt und was man bräuchte sind nicht dasselbe.
    const r = berechneInflation(base);
    expect(r.benoetigtAmEnde).toBe(euros(14_859.47));
    expect(r.benoetigtAmEnde).toBeGreaterThan(base.betrag);
    expect(r.kaufkraftAmEnde).toBeLessThan(base.betrag);
    expect(base.betrag - r.kaufkraftAmEnde).not.toBe(
      r.benoetigtAmEnde - base.betrag,
    );
  });

  it("reports the loss as a share of the starting amount", () => {
    const r = berechneInflation(base);
    expect(r.kaufkraftverlust).toBe(base.betrag - r.kaufkraftAmEnde);
    expect(r.verlustProzent).toBeCloseTo(32.7, 1);
  });

  it("changes nothing at zero inflation", () => {
    const r = berechneInflation({ ...base, inflation: 0 });
    expect(r.kaufkraftAmEnde).toBe(base.betrag);
    expect(r.benoetigtAmEnde).toBe(base.betrag);
    expect(r.verlustProzent).toBe(0);
    expect(r.halbwertszeit).toBeNull();
  });

  it("gains purchasing power under deflation", () => {
    const r = berechneInflation({ ...base, inflation: -1 });
    expect(r.kaufkraftAmEnde).toBeGreaterThan(base.betrag);
    expect(r.halbwertszeit).toBeNull();
  });

  it("halves purchasing power after the Halbwertszeit", () => {
    const r = berechneInflation({ ...base, inflation: 2, jahre: 35 });
    expect(r.halbwertszeit).toBeCloseTo(35.0, 0);
    const beiHalbwert = r.jahre[Math.round(r.halbwertszeit!) - 1];
    expect(beiHalbwert.kaufkraft).toBeCloseTo(base.betrag / 2, -3);
  });

  it("covers the whole horizon and moves in one direction", () => {
    const r = berechneInflation(base);
    expect(r.jahre).toHaveLength(20);
    for (let i = 1; i < r.jahre.length; i += 1) {
      expect(r.jahre[i].kaufkraft).toBeLessThan(r.jahre[i - 1].kaufkraft);
      expect(r.jahre[i].benoetigt).toBeGreaterThan(r.jahre[i - 1].benoetigt);
    }
  });
});
