import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneFire,
  STUFEN,
  type FireInput,
  type FireStufe,
} from "@/lib/engine/finance/fire";

const base: FireInput = {
  vermoegen: euros(150_000),
  sparrate: euros(1_000),
  rendite: 5,
  entnahmerate: 3.5,
  alter: 35,
  ruhestandsalter: 65,
  nebeneinkommen: euros(12_000),
  ausgabenMinimum: euros(24_000),
  ausgabenWunsch: euros(36_000),
  ausgabenKomfort: euros(60_000),
};

const run = (over: Partial<FireInput> = {}) => {
  const r = berechneFire({ ...base, ...over });
  if (r === null) throw new Error("sollte berechenbar sein");
  return r;
};

const rung = (r: ReturnType<typeof run>, stufe: FireStufe) =>
  r.stufen.find((s) => s.stufe === stufe)!;

describe("FIRE-Bedarf je Stufe", () => {
  it("divides the expenses by the withdrawal rate", () => {
    // 36.000 / 3,5 % = 1.028.571,43 €
    const r = run();
    expect(r.fireBedarf).toBe(euros(1_028_571.43));
    expect(rung(r, "fire").bedarf).toBe(r.fireBedarf);
    // 24.000 / 3,5 % und 60.000 / 3,5 %
    expect(rung(r, "lean").bedarf).toBe(euros(685_714.29));
    expect(rung(r, "fat").bedarf).toBe(euros(1_714_285.71));
  });

  it("lets the side income carry part of the expenses for Barista", () => {
    // (36.000 − 12.000) / 3,5 %
    expect(rung(run(), "barista").bedarf).toBe(euros(685_714.29));
  });

  it("needs nothing for Barista once the side income covers everything", () => {
    const b = rung(run({ nebeneinkommen: euros(40_000) }), "barista");
    expect(b.bedarf).toBe(0);
    expect(b.erreicht).toBe(true);
    expect(b.fortschritt).toBe(Infinity);
  });

  it("discounts the FIRE number over the years left for Coast", () => {
    // Bei 0 % Rendite hilft Warten nichts: Coast ist der volle FIRE-Bedarf.
    expect(rung(run({ rendite: 0 }), "coast").bedarf).toBe(euros(1_028_571.43));
    // Bei 100 % und einem Jahr verdoppelt sich das Kapital genau einmal.
    expect(
      rung(run({ rendite: 100, ruhestandsalter: 36 }), "coast").bedarf,
    ).toBe(euros(514_285.72));
  });

  it("makes Coast the full FIRE number when Ruhestand is now", () => {
    expect(rung(run({ ruhestandsalter: 35 }), "coast").bedarf).toBe(
      euros(1_028_571.43),
    );
  });

  it("refuses a withdrawal rate of zero", () => {
    expect(berechneFire({ ...base, entnahmerate: 0 })).toBeNull();
  });
});

describe("Erreichte Stufe", () => {
  it("is null while nothing is reached", () => {
    const r = run({ vermoegen: euros(10_000), rendite: 0 });
    expect(r.stufe).toBeNull();
    expect(r.stufen.every((s) => !s.erreicht)).toBe(true);
  });

  it("names the highest rung reached", () => {
    expect(run({ vermoegen: euros(2_000_000) }).stufe).toBe("fat");
    expect(run({ vermoegen: euros(1_100_000) }).stufe).toBe("fire");
    expect(run({ vermoegen: euros(700_000) }).stufe).toBe("lean");
  });

  it("can stand on Coast without Lean", () => {
    // 600.000 € reichen bei 100 % Rendite über ein Jahr — aber nicht heute
    // für 24.000 € im Jahr.
    const r = run({
      vermoegen: euros(600_000),
      rendite: 100,
      ruhestandsalter: 36,
      nebeneinkommen: 0,
    });
    expect(rung(r, "coast").erreicht).toBe(true);
    expect(rung(r, "lean").erreicht).toBe(false);
    expect(r.stufe).toBe("coast");
  });

  it("orders the ladder from Coast to Fat", () => {
    expect(run().stufen.map((s) => s.stufe)).toEqual([...STUFEN]);
  });

  it("reports progress as a share of the need", () => {
    const r = run({ vermoegen: euros(514_285.72), rendite: 0 });
    expect(rung(r, "fire").fortschritt).toBeCloseTo(0.5, 6);
  });
});

describe("Wann eine Stufe erreicht wird", () => {
  it("counts the months of saving until the need is met", () => {
    // 420 € im Jahr / 3,5 % = 12.000 € — bei 1.000 € im Monat zwölf Monate.
    const r = run({
      vermoegen: 0,
      rendite: 0,
      ausgabenMinimum: euros(420),
      ausgabenWunsch: euros(420),
      ausgabenKomfort: euros(420),
      nebeneinkommen: 0,
    });
    const fire = rung(r, "fire");
    expect(fire.monateBis).toBe(12);
    expect(fire.erreichtMitAlter).toBe(36);
    expect(fire.erreicht).toBe(false);
  });

  it("reports zero months for a rung already reached", () => {
    const fire = rung(run({ vermoegen: euros(1_100_000) }), "fire");
    expect(fire.monateBis).toBe(0);
    expect(fire.erreichtMitAlter).toBe(35);
  });

  it("gives up at 100 when the plan never gets there", () => {
    const r = run({ vermoegen: 0, sparrate: 0, rendite: 0 });
    expect(r.stufen.every((s) => s.monateBis === null)).toBe(true);
    expect(r.stufen.every((s) => s.erreichtMitAlter === null)).toBe(true);
  });

  it("reaches the rungs in order of their need", () => {
    const r = run();
    const monate = (s: FireStufe) => rung(r, s).monateBis!;
    expect(monate("lean")).toBeLessThan(monate("fire"));
    expect(monate("fire")).toBeLessThan(monate("fat"));
    expect(monate("coast")).toBeLessThanOrEqual(monate("fire"));
  });

  it("compounds like the Sparplanrechner", () => {
    // 100.000 € bei 5 % über zwei Jahre ohne Sparrate: 110.250 €.
    expect(run({ vermoegen: euros(100_000), ruhestandsalter: 37 }).vermoegenMitRuhestand)
      .toBe(euros(110_250));
    // Monatlich effektiv, nicht r/12.
    expect(run().monatsrate).toBeCloseTo(Math.pow(1.05, 1 / 12) - 1, 12);
  });
});
