import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import { annuitaetFuerLaufzeit } from "@/lib/engine/finance/annuitaet";
import {
  vergleicheLeasingKauf,
  type LeasingKaufInput,
} from "@/lib/engine/finance/leasing-kauf";

const base: LeasingKaufInput = {
  listenpreis: euros(40_000),
  laufzeitMonate: 48,
  leasingSonderzahlung: euros(4_000),
  leasingRate: euros(350),
  kaufAnzahlung: euros(4_000),
  kaufSollzins: 5,
  wertverlustProJahr: 15,
  kapitalrendite: 4,
};

describe("annuitaetFuerLaufzeit", () => {
  it("repays the loan exactly over the term", () => {
    const rate = annuitaetFuerLaufzeit(euros(36_000), 5, 48);
    // Die Summe der Raten deckt Darlehen plus Zinsen.
    expect(rate * 48).toBeGreaterThan(euros(36_000));
    expect(rate * 48).toBeLessThan(euros(41_000));
  });

  it("is simple division without interest", () => {
    expect(annuitaetFuerLaufzeit(euros(12_000), 0, 12)).toBe(euros(1_000));
  });

  it("is nothing over a zero term", () => {
    expect(annuitaetFuerLaufzeit(euros(1_000), 5, 0)).toBe(0);
  });
});

describe("Leasing gegen Kauf", () => {
  it("adds up the leasing payments", () => {
    const r = vergleicheLeasingKauf(base);
    expect(r.leasingGesamt).toBe(euros(4_000) + euros(350) * 48);
  });

  it("finances only what the down payment does not cover", () => {
    const r = vergleicheLeasingKauf(base);
    expect(r.kaufDarlehen).toBe(euros(36_000));
    expect(r.kaufZinsen).toBeGreaterThan(0);
  });

  it("credits the buyer with what the car is still worth", () => {
    const r = vergleicheLeasingKauf(base);
    // 40.000 × 0,85^4 ≈ 20.880
    expect(r.restwert).toBeGreaterThan(euros(20_000));
    expect(r.restwert).toBeLessThan(euros(21_500));
    expect(r.kaufGesamt).toBeLessThan(
      base.kaufAnzahlung + r.kaufRate * 48,
    );
  });

  it("makes buying look worse if the residual value is ignored", () => {
    const r = vergleicheLeasingKauf(base);
    const ohneRestwert = base.kaufAnzahlung + r.kaufRate * 48;
    expect(r.kaufGesamt).toBe(ohneRestwert - r.restwert);
  });

  it("favours leasing as the car loses value faster", () => {
    const langsam = vergleicheLeasingKauf({ ...base, wertverlustProJahr: 5 });
    const schnell = vergleicheLeasingKauf({ ...base, wertverlustProJahr: 30 });
    expect(schnell.differenz).toBeLessThan(langsam.differenz);
  });

  it("favours buying as the leasing rate rises", () => {
    const guenstig = vergleicheLeasingKauf({ ...base, leasingRate: euros(200) });
    const teuer = vergleicheLeasingKauf({ ...base, leasingRate: euros(600) });
    expect(teuer.differenz).toBeGreaterThan(guenstig.differenz);
    expect(guenstig.leasingGuenstiger).toBe(true);
  });

  it("needs no loan when the car is paid outright", () => {
    const r = vergleicheLeasingKauf({ ...base, kaufAnzahlung: euros(40_000) });
    expect(r.kaufDarlehen).toBe(0);
    expect(r.kaufRate).toBe(0);
    expect(r.kaufZinsen).toBe(0);
  });

  it("says which side is cheaper consistently with the difference", () => {
    for (const rate of [150, 350, 800]) {
      const r = vergleicheLeasingKauf({ ...base, leasingRate: euros(rate) });
      expect(r.leasingGuenstiger).toBe(r.differenz < 0);
    }
  });
});
