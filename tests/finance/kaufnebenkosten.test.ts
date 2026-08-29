import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneKaufnebenkosten,
  type KaufnebenkostenInput,
} from "@/lib/engine/finance/kaufnebenkosten";
import {
  BUNDESLAENDER,
  grunderwerbsteuerSatz,
} from "@/lib/engine/tax/grunderwerbsteuer";

const base: KaufnebenkostenInput = {
  kaufpreis: euros(400_000),
  grunderwerbsteuerSatz: 6.5,
  notarUndGrundbuch: 2,
  maklerprovision: 3.57,
  eigenkapital: euros(100_000),
};

describe("Kaufnebenkosten", () => {
  it("charges each cost on the purchase price", () => {
    const r = berechneKaufnebenkosten(base);
    expect(r.grunderwerbsteuer).toBe(euros(26_000));
    expect(r.notarUndGrundbuch).toBe(euros(8_000));
    expect(r.maklerprovision).toBe(euros(14_280));
    expect(r.nebenkostenGesamt).toBe(euros(48_280));
    expect(r.gesamtkosten).toBe(euros(448_280));
  });

  it("reports the incidental costs as a share of the price", () => {
    const r = berechneKaufnebenkosten(base);
    expect(r.nebenkostenAnteil).toBeCloseTo(12.07, 2);
  });

  it("takes the incidental costs out of the equity, not the loan", () => {
    const r = berechneKaufnebenkosten(base);
    // 100.000 € Eigenkapital, davon 48.280 € für Nebenkosten
    expect(r.eigenkapitalNachNebenkosten).toBe(euros(51_720));
    expect(r.finanzierungsbedarf).toBe(euros(400_000) - euros(51_720));
  });

  it("flags equity that does not even cover the costs", () => {
    const r = berechneKaufnebenkosten({ ...base, eigenkapital: euros(30_000) });
    expect(r.eigenkapitalReichtNicht).toBe(true);
    expect(r.eigenkapitalNachNebenkosten).toBeLessThan(0);
    // Dann muss der volle Kaufpreis finanziert werden.
    expect(r.finanzierungsbedarf).toBe(euros(400_000));
  });

  it("differs by Bundesland only through the Grunderwerbsteuer", () => {
    const bayern = berechneKaufnebenkosten({
      ...base,
      grunderwerbsteuerSatz: grunderwerbsteuerSatz("by")!,
    });
    const nrw = berechneKaufnebenkosten({
      ...base,
      grunderwerbsteuerSatz: grunderwerbsteuerSatz("nw")!,
    });
    // 3 Prozentpunkte auf 400.000 € sind 12.000 € Unterschied.
    expect(nrw.nebenkostenGesamt - bayern.nebenkostenGesamt).toBe(euros(12_000));
    expect(nrw.notarUndGrundbuch).toBe(bayern.notarUndGrundbuch);
  });
});

describe("Grunderwerbsteuer-Tabelle", () => {
  it("covers all sixteen Bundesländer", () => {
    expect(BUNDESLAENDER).toHaveLength(16);
    expect(new Set(BUNDESLAENDER.map((l) => l.id)).size).toBe(16);
  });

  it("stays inside the range the Länder actually legislate", () => {
    for (const land of BUNDESLAENDER) {
      expect(land.satz).toBeGreaterThanOrEqual(3.5);
      expect(land.satz).toBeLessThanOrEqual(6.5);
    }
  });

  it("has Bayern cheapest", () => {
    const min = Math.min(...BUNDESLAENDER.map((l) => l.satz));
    expect(grunderwerbsteuerSatz("by")).toBe(min);
    expect(min).toBe(3.5);
  });

  it("returns nothing for a Land that does not exist", () => {
    expect(grunderwerbsteuerSatz("xx")).toBeNull();
  });
});
