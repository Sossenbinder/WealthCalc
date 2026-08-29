import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneSondertilgung,
  type SondertilgungInput,
} from "@/lib/engine/finance/sondertilgung";

const base: SondertilgungInput = {
  darlehensbetrag: euros(300_000),
  sollzins: 3.5,
  anfaenglicheTilgung: 2,
  sondertilgungProJahr: euros(5_000),
};

describe("Sondertilgung", () => {
  it("leaves the instalment where the contract set it", () => {
    // 300.000 × 5,5 % / 12 = 1.375 €, mit wie ohne Sondertilgung.
    expect(berechneSondertilgung(base).monatsrate).toBe(euros(1_375));
  });

  it("repays sooner and cheaper", () => {
    const r = berechneSondertilgung(base);
    expect(r.mit.laufzeitMonate).toBeLessThan(r.ohne.laufzeitMonate);
    expect(r.mit.gesamtzinsen).toBeLessThan(r.ohne.gesamtzinsen);
    expect(r.zeitersparnisMonate).toBe(
      r.ohne.laufzeitMonate - r.mit.laufzeitMonate,
    );
  });

  it("changes nothing when no extra payment is made", () => {
    const r = berechneSondertilgung({ ...base, sondertilgungProJahr: 0 });
    expect(r.mit.laufzeitMonate).toBe(r.ohne.laufzeitMonate);
    expect(r.zinsersparnis).toBe(0);
    expect(r.ersparnisJeEuro).toBe(0);
  });

  it("saves more the larger the extra payment", () => {
    const klein = berechneSondertilgung({ ...base, sondertilgungProJahr: euros(2_000) });
    const gross = berechneSondertilgung({ ...base, sondertilgungProJahr: euros(10_000) });
    expect(gross.zinsersparnis).toBeGreaterThan(klein.zinsersparnis);
    expect(gross.zeitersparnisMonate).toBeGreaterThan(klein.zeitersparnisMonate);
  });

  it("saves more at a higher interest rate", () => {
    const billig = berechneSondertilgung({ ...base, sollzins: 1.5, anfaenglicheTilgung: 2 });
    const teuer = berechneSondertilgung({ ...base, sollzins: 6, anfaenglicheTilgung: 2 });
    expect(teuer.ersparnisJeEuro).toBeGreaterThan(billig.ersparnisJeEuro);
  });

  it("keeps the debt falling to exactly zero", () => {
    const r = berechneSondertilgung(base);
    expect(r.mit.restschuldProJahr[r.mit.restschuldProJahr.length - 1]).toBe(0);
    expect(r.ohne.restschuldProJahr[r.ohne.restschuldProJahr.length - 1]).toBe(0);
  });

  it("counts only the extra payments actually made", () => {
    const r = berechneSondertilgung(base);
    // Nicht mehr Jahre als die verkürzte Laufzeit hergibt.
    expect(r.eingesetzteSondertilgung).toBeLessThanOrEqual(
      euros(5_000) * Math.ceil(r.mit.laufzeitMonate / 12),
    );
    expect(r.eingesetzteSondertilgung).toBeGreaterThan(0);
  });

  it("refuses a loan whose instalment cannot cover the interest", () => {
    const r = berechneSondertilgung({
      ...base,
      sollzins: 6,
      anfaenglicheTilgung: 0,
    });
    expect(r.tilgtNie).toBe(true);
  });
});
