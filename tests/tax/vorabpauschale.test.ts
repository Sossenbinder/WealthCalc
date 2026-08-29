import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import { berechneVorabpauschale } from "@/lib/engine/tax/vorabpauschale";
import { berechneKapitalertragsteuer } from "@/lib/engine/tax/kapitalertragsteuer";

/**
 * Vectors ported case for case from
 * `EntnahmeplanSuite/tests/TaxEngine.Tests/VorabpauschaleCalculatorTests.cs`.
 * The figures in the comments are the ones that suite asserts; they only hold
 * if the port kept the C# step order and its banker's rounding.
 */
const base = {
  jahr: 2024,
  wertJahresanfang: euros(10_000),
  wertJahresende: euros(11_000),
  ausschuettungen: euros(0),
  fondsArt: "aktienfonds" as const,
  monateGehalten: 12,
  sparerpauschbetragRest: euros(1000),
  kirchensteuer: "keine" as const,
};

describe("Vorabpauschale § 18 InvStG", () => {
  it("runs every step for a simple positive year", () => {
    // Basisertrag = 10.000 × 0,7 × 2,29 % = 160,30
    // nach Teilfreistellung 30 %          = 112,21
    // Sparerpauschbetrag 1.000 deckt es   -> 0 steuerpflichtig, 0 Steuer
    const r = berechneVorabpauschale(base)!;
    expect(r.vorabpauschale).toBe(euros(160.3));
    expect(r.nachTeilfreistellung).toBe(euros(112.21));
    expect(r.steuerpflichtig).toBe(0);
    expect(r.steuer.total).toBe(0);
  });

  it("caps at the realised growth when the Basisertrag exceeds it", () => {
    const r = berechneVorabpauschale({
      ...base,
      wertJahresende: euros(10_050),
      sparerpauschbetragRest: 0,
    })!;
    expect(r.vorabpauschale).toBe(euros(50));
  });

  it("is zero in a losing year", () => {
    const r = berechneVorabpauschale({
      ...base,
      wertJahresende: euros(9_000),
      sparerpauschbetragRest: 0,
    })!;
    expect(r.vorabpauschale).toBe(0);
    expect(r.steuer.total).toBe(0);
  });

  it("applies the Zwölftelung for a partial year", () => {
    // 6 Monate: 160,30 × 6/12 = 80,15
    const r = berechneVorabpauschale({
      ...base,
      monateGehalten: 6,
      sparerpauschbetragRest: 0,
    })!;
    expect(r.vorabpauschale).toBe(euros(80.15));
  });

  it("reduces the Basisertrag one-to-one by distributions", () => {
    // 160,30 - 100 = 60,30
    const r = berechneVorabpauschale({
      ...base,
      ausschuettungen: euros(100),
      sparerpauschbetragRest: 0,
    })!;
    expect(r.vorabpauschale).toBe(euros(60.3));
  });

  it("taxes the remainder above the Sparerpauschbetrag at 26,375 %", () => {
    // Basisertrag = 100.000 × 0,7 × 2,29 % = 1.603,00
    // nach Teilfreistellung 30 %           = 1.122,10
    // ohne Sparerpauschbetrag -> rund 295,95 € Steuer
    const r = berechneVorabpauschale({
      ...base,
      wertJahresanfang: euros(100_000),
      wertJahresende: euros(120_000),
      sparerpauschbetragRest: 0,
    })!;
    expect(r.nachTeilfreistellung).toBe(euros(1122.1));
    expect(Math.abs(r.steuer.total - euros(295.95))).toBeLessThanOrEqual(10);
  });

  it("has no figure for a year the BMF has not published", () => {
    expect(berechneVorabpauschale({ ...base, jahr: 2099 })).toBeNull();
  });
});

/**
 * Vectors from
 * `EntnahmeplanSuite/tests/TaxEngine.Tests/KapitalertragsteuerCalculatorTests.cs`.
 */
describe("Kapitalertragsteuer § 32d EStG", () => {
  it("is 26,375 % all-in without church tax", () => {
    const r = berechneKapitalertragsteuer(euros(1000), "keine");
    expect(r.kest).toBe(euros(250));
    expect(r.soli).toBe(euros(13.75));
    expect(r.kist).toBe(0);
    expect(r.total).toBe(euros(263.75));
  });

  it("reduces the KESt by e/(4+k) at 9 % church tax", () => {
    const r = berechneKapitalertragsteuer(euros(1000), "neun");
    expect(Math.abs(r.kest - euros(244.5))).toBeLessThanOrEqual(5);
    expect(Math.abs(r.kist - euros(22))).toBeLessThanOrEqual(5);
    expect(Math.abs(r.soli - euros(13.45))).toBeLessThanOrEqual(5);
  });

  it("reduces the KESt by e/(4+k) at 8 % church tax", () => {
    const r = berechneKapitalertragsteuer(euros(1000), "acht");
    expect(Math.abs(r.kest - euros(245.1))).toBeLessThanOrEqual(5);
  });
});
