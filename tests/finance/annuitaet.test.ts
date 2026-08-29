import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneAnnuitaetendarlehen,
  TILGT_NIE,
  type DarlehenInput,
} from "@/lib/engine/finance/annuitaet";

const base: DarlehenInput = {
  darlehensbetrag: euros(300_000),
  sollzins: 3.5,
  anfaenglicheTilgung: 2,
  zinsbindungJahre: 10,
};

describe("Annuitätendarlehen", () => {
  it("sets the instalment from Sollzins plus anfängliche Tilgung", () => {
    const r = berechneAnnuitaetendarlehen(base);
    if (r === TILGT_NIE) throw new Error("should amortise");
    // 300.000 × 5,5 % = 16.500 im Jahr, also 1.375 € im Monat.
    expect(r.monatsrate).toBe(euros(1375));
  });

  it("repays exactly the loan, no more and no less", () => {
    const r = berechneAnnuitaetendarlehen(base);
    if (r === TILGT_NIE) throw new Error("should amortise");
    const getilgt = r.jahre.reduce((sum, j) => sum + j.tilgung, 0);
    expect(getilgt).toBe(base.darlehensbetrag);
    expect(r.jahre[r.jahre.length - 1].restschuld).toBe(0);
  });

  it("keeps interest plus repayment equal to what was paid in", () => {
    const r = berechneAnnuitaetendarlehen(base);
    if (r === TILGT_NIE) throw new Error("should amortise");
    expect(r.gesamtzahlung).toBe(base.darlehensbetrag + r.gesamtzinsen);
  });

  it("reports the debt left when the Zinsbindung runs out", () => {
    const r = berechneAnnuitaetendarlehen(base);
    if (r === TILGT_NIE) throw new Error("should amortise");
    const nachZehnJahren = r.jahre[9].restschuld;
    expect(r.restschuldBeiZinsbindung).toBe(nachZehnJahren);
    expect(r.restschuldBeiZinsbindung!).toBeGreaterThan(0);
    expect(r.restschuldBeiZinsbindung!).toBeLessThan(base.darlehensbetrag);
  });

  it("omits the Restschuld when no Zinsbindung was given", () => {
    const r = berechneAnnuitaetendarlehen({ ...base, zinsbindungJahre: 0 });
    if (r === TILGT_NIE) throw new Error("should amortise");
    expect(r.restschuldBeiZinsbindung).toBeNull();
  });

  it("pays off sooner with a higher Tilgung", () => {
    const langsam = berechneAnnuitaetendarlehen(base);
    const schnell = berechneAnnuitaetendarlehen({
      ...base,
      anfaenglicheTilgung: 4,
    });
    if (langsam === TILGT_NIE || schnell === TILGT_NIE) throw new Error("nope");
    expect(schnell.laufzeitMonate).toBeLessThan(langsam.laufzeitMonate);
    expect(schnell.gesamtzinsen).toBeLessThan(langsam.gesamtzinsen);
  });

  it("refuses a loan whose instalment cannot cover the first interest", () => {
    expect(
      berechneAnnuitaetendarlehen({
        ...base,
        sollzins: 6,
        anfaenglicheTilgung: 0,
      }),
    ).toBe(TILGT_NIE);
  });

  it("is interest-free when the Sollzins is zero", () => {
    const r = berechneAnnuitaetendarlehen({
      ...base,
      sollzins: 0,
      anfaenglicheTilgung: 10,
    });
    if (r === TILGT_NIE) throw new Error("should amortise");
    expect(r.gesamtzinsen).toBe(0);
    expect(r.laufzeitMonate).toBe(120);
  });

  it("states an Effektivzins above the nominal rate", () => {
    const r = berechneAnnuitaetendarlehen(base);
    if (r === TILGT_NIE) throw new Error("should amortise");
    expect(r.effektivzins).toBeGreaterThan(3.5);
    expect(r.effektivzins).toBeLessThan(3.6);
  });
});
