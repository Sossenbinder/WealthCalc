import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneImmobilienBudget,
  type BudgetInput,
} from "@/lib/engine/finance/budget-immobilie";
import { TILGT_NIE } from "@/lib/engine/finance/annuitaet";

const base: BudgetInput = {
  monatsrate: euros(1_500),
  eigenkapital: euros(100_000),
  sollzins: 3.5,
  anfaenglicheTilgung: 2,
  grunderwerbsteuer: 6.5,
  notarUndGrundbuch: 2,
  maklerprovision: 3.57,
};

const run = (over: Partial<BudgetInput> = {}) => {
  const r = berechneImmobilienBudget({ ...base, ...over });
  if (r === TILGT_NIE) throw new Error("sollte finanzierbar sein");
  return r;
};

describe("Immobilienbudget", () => {
  it("derives the loan from the instalment", () => {
    // 1.500 × 12 / 5,5 % = 327.272,73 €
    const r = run();
    expect(r.darlehen).toBe(euros(327_272.73));
  });

  it("keeps price plus fees equal to loan plus equity", () => {
    const r = run();
    expect(Math.abs(r.maxKaufpreis + r.nebenkosten - (r.darlehen + base.eigenkapital)))
      .toBeLessThanOrEqual(euros(1));
  });

  it("does not simply add equity to the loan", () => {
    // Die Nebenkosten fressen einen Teil, also liegt der Preis darunter.
    const r = run();
    expect(r.maxKaufpreis).toBeLessThan(r.darlehen + base.eigenkapital);
  });

  it("buys less in an expensive Bundesland", () => {
    const bayern = run({ grunderwerbsteuer: 3.5 });
    const nrw = run({ grunderwerbsteuer: 6.5 });
    expect(nrw.maxKaufpreis).toBeLessThan(bayern.maxKaufpreis);
  });

  it("buys more without an agent", () => {
    expect(run({ maklerprovision: 0 }).maxKaufpreis).toBeGreaterThan(
      run().maxKaufpreis,
    );
  });

  it("scales with the instalment", () => {
    expect(run({ monatsrate: euros(3_000) }).darlehen).toBeGreaterThan(
      run().darlehen * 1.9,
    );
  });

  it("flags equity that the fees swallow whole", () => {
    const r = run({ eigenkapital: euros(5_000) });
    expect(r.eigenkapitalReichtNicht).toBe(true);
    expect(r.eigenkapitalFuerKaufpreis).toBeLessThan(0);
  });

  it("repays faster with a higher Tilgung", () => {
    expect(run({ anfaenglicheTilgung: 4 }).laufzeitMonate).toBeLessThan(
      run().laufzeitMonate,
    );
  });

  it("refuses when neither interest nor repayment is set", () => {
    expect(
      berechneImmobilienBudget({ ...base, sollzins: 0, anfaenglicheTilgung: 0 }),
    ).toBe(TILGT_NIE);
  });
});
