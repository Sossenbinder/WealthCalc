import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneMietrendite,
  type MietrenditeInput,
} from "@/lib/engine/finance/mietrendite";

const base: MietrenditeInput = {
  kaufpreis: euros(300_000),
  kaufnebenkosten: 12,
  kaltmieteMonat: euros(1_000),
  verwaltungMonat: euros(30),
  instandhaltung: 1,
  mietausfallwagnis: 2,
  eigenkapital: euros(80_000),
  sollzins: 3.5,
  anfaenglicheTilgung: 2,
};

describe("Mietrendite", () => {
  it("computes the gross yield off the purchase price alone", () => {
    const r = berechneMietrendite(base);
    // 12.000 € Jahresmiete auf 300.000 € = 4 %
    expect(r.jahreskaltmiete).toBe(euros(12_000));
    expect(r.bruttomietrendite).toBeCloseTo(4, 5);
  });

  it("counts the purchase costs into the net yield", () => {
    const r = berechneMietrendite(base);
    expect(r.nebenkosten).toBe(euros(36_000));
    expect(r.gesamtinvestition).toBe(euros(336_000));
    expect(r.nettomietrendite).toBeLessThan(r.bruttomietrendite);
  });

  it("subtracts what the landlord cannot pass on", () => {
    const r = berechneMietrendite(base);
    // 30 € Verwaltung + 250 € Instandhaltung (1 % von 300.000 / 12) + 20 € Wagnis
    expect(r.nichtUmlagefaehigMonat).toBe(euros(300));
  });

  it("quotes the price as a multiple of the yearly rent", () => {
    const r = berechneMietrendite(base);
    expect(r.kaufpreisfaktor).toBeCloseTo(25, 5);
  });

  it("borrows everything the equity does not cover, costs included", () => {
    const r = berechneMietrendite(base);
    expect(r.darlehen).toBe(euros(336_000) - euros(80_000));
  });

  it("reports the monthly cash flow after costs and instalment", () => {
    const r = berechneMietrendite(base);
    expect(r.cashflowMonat).toBe(
      base.kaltmieteMonat - r.nichtUmlagefaehigMonat - r.monatsrate,
    );
  });

  it("turns cash-flow positive with enough equity", () => {
    const knapp = berechneMietrendite(base);
    const viel = berechneMietrendite({ ...base, eigenkapital: euros(300_000) });
    expect(viel.cashflowMonat).toBeGreaterThan(knapp.cashflowMonat);
  });

  it("needs no loan when the equity covers everything", () => {
    const r = berechneMietrendite({ ...base, eigenkapital: euros(400_000) });
    expect(r.darlehen).toBe(0);
    expect(r.monatsrate).toBe(0);
    expect(r.cashflowMonat).toBe(euros(1_000) - euros(300));
  });

  it("flags a loan whose instalment cannot cover the interest", () => {
    const r = berechneMietrendite({
      ...base,
      sollzins: 6,
      anfaenglicheTilgung: 0,
    });
    expect(r.nichtFinanzierbar).toBe(true);
  });

  it("leaves the gross yield untouched by financing", () => {
    const a = berechneMietrendite(base);
    const b = berechneMietrendite({ ...base, eigenkapital: euros(200_000) });
    expect(a.bruttomietrendite).toBe(b.bruttomietrendite);
    expect(a.nettomietrendite).toBe(b.nettomietrendite);
  });
});
