import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  vergleicheKaufenMieten,
  KAUF_UNFINANZIERBAR,
  type KaufenMietenInput,
} from "@/lib/engine/finance/kaufen-mieten";

const base: KaufenMietenInput = {
  kaufpreis: euros(400_000),
  kaufnebenkosten: 10,
  eigenkapital: euros(100_000),
  sollzins: 3.5,
  anfaenglicheTilgung: 2,
  instandhaltung: 1,
  wertsteigerung: 2,
  kaltmiete: euros(1_200),
  mietsteigerung: 2,
  kapitalrendite: 6,
  jahre: 30,
};

const run = (over: Partial<KaufenMietenInput> = {}) => {
  const r = vergleicheKaufenMieten({ ...base, ...over });
  if (r === KAUF_UNFINANZIERBAR) throw new Error("expected a financeable case");
  return r;
};

describe("Kaufen oder Mieten", () => {
  it("borrows the price plus costs, less the equity put in", () => {
    const r = run();
    expect(r.nebenkosten).toBe(euros(40_000));
    expect(r.darlehen).toBe(euros(340_000));
  });

  it("gives the renter the equity the buyer sank into the house", () => {
    // Year 1 for the renter is roughly 100.000 € compounded plus any monthly
    // difference — it cannot be below the equity they started with.
    const r = run();
    expect(r.jahre[0].vermoegenMiete).toBeGreaterThan(euros(100_000));
  });

  it("counts the buyer's wealth as the house less the debt", () => {
    const r = run();
    const y1 = r.jahre[0];
    expect(y1.immobilienwert).toBe(euros(408_000));
    expect(y1.vermoegenKauf).toBeLessThan(y1.immobilienwert);
    expect(y1.restschuld).toBeGreaterThan(0);
  });

  it("never lets the purchase costs come back", () => {
    // Buying 400k with 40k of costs and 100k equity starts the buyer behind by
    // the costs, so year one cannot already be ahead of simply investing.
    const r = run();
    expect(r.jahre[0].vermoegenKauf).toBeLessThan(r.jahre[0].vermoegenMiete);
  });

  it("favours buying when rents climb fast", () => {
    const ruhig = run({ mietsteigerung: 0 });
    const teuer = run({ mietsteigerung: 6 });
    expect(teuer.vermoegenKaufEnde - teuer.vermoegenMieteEnde).toBeGreaterThan(
      ruhig.vermoegenKaufEnde - ruhig.vermoegenMieteEnde,
    );
  });

  it("favours renting when the stock market beats the housing market", () => {
    const schwach = run({ kapitalrendite: 2 });
    const stark = run({ kapitalrendite: 10 });
    expect(stark.vermoegenMieteEnde).toBeGreaterThan(schwach.vermoegenMieteEnde);
  });

  it("reports the first year buying pulls ahead, if it ever does", () => {
    const r = run();
    if (r.breakEvenJahr !== null) {
      const y = r.jahre[r.breakEvenJahr - 1];
      expect(y.vermoegenKauf).toBeGreaterThanOrEqual(y.vermoegenMiete);
      if (r.breakEvenJahr > 1) {
        const before = r.jahre[r.breakEvenJahr - 2];
        expect(before.vermoegenKauf).toBeLessThan(before.vermoegenMiete);
      }
    }
  });

  it("needs no mortgage when the equity covers price and costs", () => {
    const r = run({ eigenkapital: euros(500_000) });
    expect(r.darlehen).toBeLessThanOrEqual(0);
    expect(r.monatsrate).toBe(0);
    expect(r.jahre[0].restschuld).toBe(0);
  });

  it("refuses a mortgage that would never amortise", () => {
    expect(
      vergleicheKaufenMieten({
        ...base,
        anfaenglicheTilgung: 0,
        sollzins: 5,
      }),
    ).toBe(KAUF_UNFINANZIERBAR);
  });

  it("covers the whole horizon asked for", () => {
    expect(run({ jahre: 15 }).jahre).toHaveLength(15);
  });
});
