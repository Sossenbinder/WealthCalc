import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneArbeitszeit,
  type ArbeitszeitInput,
} from "@/lib/engine/finance/arbeitszeit";

const base: ArbeitszeitInput = {
  monatsgehalt: euros(4_000),
  wochenstunden: 40,
  urlaubstage: 30,
  feiertage: 10,
  sonderzahlungen: 0,
};

describe("Stundenlohn", () => {
  it("builds the yearly salary from the monthly one", () => {
    expect(berechneArbeitszeit(base).jahresgehalt).toBe(euros(48_000));
  });

  it("counts extra salaries into the year", () => {
    const r = berechneArbeitszeit({ ...base, sonderzahlungen: 1 });
    expect(r.jahresgehalt).toBe(euros(52_000));
  });

  it("divides by contracted hours for the nominal rate", () => {
    // 48.000 / (52 × 40) = 23,08 €
    const r = berechneArbeitszeit(base);
    expect(r.vertraglicheStunden).toBe(2_080);
    expect(r.stundenlohnNominal).toBe(euros(23.08));
  });

  it("divides by hours actually worked for the effective rate", () => {
    // 260 - 40 freie Tage = 220 Tage × 8 h = 1.760 h; 48.000 / 1.760 = 27,27 €
    const r = berechneArbeitszeit(base);
    expect(r.arbeitstage).toBe(220);
    expect(r.gearbeiteteStunden).toBe(1_760);
    expect(r.stundenlohnEffektiv).toBe(euros(27.27));
  });

  it("makes the effective rate the higher of the two", () => {
    const r = berechneArbeitszeit(base);
    expect(r.stundenlohnEffektiv).toBeGreaterThan(r.stundenlohnNominal);
    expect(r.aufschlagProzent).toBeCloseTo(18.2, 1);
  });

  it("collapses the gap when there is no paid leave", () => {
    const r = berechneArbeitszeit({ ...base, urlaubstage: 0, feiertage: 0 });
    expect(r.stundenlohnEffektiv).toBe(r.stundenlohnNominal);
    expect(r.aufschlagProzent).toBeCloseTo(0, 6);
  });

  it("scales with part-time hours", () => {
    const voll = berechneArbeitszeit(base);
    const halb = berechneArbeitszeit({
      ...base,
      wochenstunden: 20,
      monatsgehalt: euros(2_000),
    });
    // Halbes Gehalt für halbe Stunden ist derselbe Stundenlohn.
    expect(halb.stundenlohnNominal).toBe(voll.stundenlohnNominal);
    expect(halb.gearbeiteteStunden).toBe(voll.gearbeiteteStunden / 2);
  });

  it("values the paid days off", () => {
    const r = berechneArbeitszeit(base);
    expect(r.bezahlteFreieTage).toBe(40);
    // 40 Tage × 8 h × 27,27 € — rund 8.700 €
    expect(r.wertDerFreienTage).toBeGreaterThan(euros(8_500));
    expect(r.wertDerFreienTage).toBeLessThan(euros(8_900));
  });

  it("does not divide by zero when nothing is worked", () => {
    const r = berechneArbeitszeit({ ...base, wochenstunden: 0 });
    expect(r.stundenlohnNominal).toBe(0);
    expect(r.stundenlohnEffektiv).toBe(0);
    expect(r.aufschlagProzent).toBe(0);
  });
});
