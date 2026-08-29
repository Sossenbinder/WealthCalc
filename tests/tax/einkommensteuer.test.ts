import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneEinkommensteuer,
  grenzsteuersatzEuro,
  tarifEuro,
  GRUNDFREIBETRAG_EUR,
  SOLI_FREIGRENZE_EINZEL_EUR,
} from "@/lib/engine/tax/einkommensteuer";

describe("§ 32a EStG Tarif", () => {
  it("taxes nothing up to the Grundfreibetrag", () => {
    expect(tarifEuro(0)).toBe(0);
    expect(tarifEuro(GRUNDFREIBETRAG_EUR)).toBe(0);
    expect(tarifEuro(GRUNDFREIBETRAG_EUR + 1)).toBeGreaterThanOrEqual(0);
  });

  it("rises without a jump at every zone boundary", () => {
    // Ein Sprung an einer Grenze wäre ein Tippfehler in den Koeffizienten.
    for (const grenze of [17_799, 69_878, 277_825]) {
      const davor = tarifEuro(grenze);
      const danach = tarifEuro(grenze + 1);
      expect(danach).toBeGreaterThanOrEqual(davor);
      expect(danach - davor).toBeLessThan(2);
    }
  });

  it("never falls as income rises", () => {
    let vorher = 0;
    for (let x = 0; x <= 300_000; x += 137) {
      const jetzt = tarifEuro(x);
      expect(jetzt).toBeGreaterThanOrEqual(vorher);
      vorher = jetzt;
    }
  });

  it("reaches the Spitzensteuersatz in the proportional zones", () => {
    expect(grenzsteuersatzEuro(70_000)).toBeCloseTo(0.42, 10);
    expect(grenzsteuersatzEuro(300_000)).toBeCloseTo(0.45, 10);
  });

  it("has a marginal rate of 14 % where tax first applies", () => {
    // Eingangssteuersatz: knapp über dem Grundfreibetrag.
    expect(grenzsteuersatzEuro(GRUNDFREIBETRAG_EUR + 1)).toBeCloseTo(0.14, 3);
  });

  it("keeps the marginal rate above the average rate", () => {
    for (const x of [20_000, 45_000, 80_000, 200_000]) {
      const durchschnitt = tarifEuro(x) / x;
      expect(grenzsteuersatzEuro(x)).toBeGreaterThan(durchschnitt);
    }
  });
});

describe("Veranlagung", () => {
  it("halves, taxes and doubles for a joint assessment", () => {
    const zusammen = berechneEinkommensteuer({
      zvE: euros(100_000),
      veranlagung: "zusammen",
      kirchensteuer: "keine",
    });
    const einzelHalb = berechneEinkommensteuer({
      zvE: euros(50_000),
      veranlagung: "einzel",
      kirchensteuer: "keine",
    });
    expect(zusammen.einkommensteuer).toBe(einzelHalb.einkommensteuer * 2);
  });

  it("costs a couple less than a single person on the same income", () => {
    const gemeinsam = berechneEinkommensteuer({
      zvE: euros(100_000),
      veranlagung: "zusammen",
      kirchensteuer: "keine",
    });
    const allein = berechneEinkommensteuer({
      zvE: euros(100_000),
      veranlagung: "einzel",
      kirchensteuer: "keine",
    });
    expect(gemeinsam.einkommensteuer).toBeLessThan(allein.einkommensteuer);
  });
});

describe("Solidaritätszuschlag", () => {
  const soliBei = (zvE: number) =>
    berechneEinkommensteuer({
      zvE: euros(zvE),
      veranlagung: "einzel",
      kirchensteuer: "keine",
    });

  it("is not charged below the Freigrenze", () => {
    const r = soliBei(60_000);
    expect(r.einkommensteuer / 100).toBeLessThan(SOLI_FREIGRENZE_EINZEL_EUR);
    expect(r.soli).toBe(0);
  });

  it("is capped at 11,9 % of the amount above the Freigrenze", () => {
    // Direkt über der Freigrenze greift die Milderungszone, nicht die vollen 5,5 %.
    const r = soliBei(90_000);
    const estEuro = r.einkommensteuer / 100;
    if (estEuro > SOLI_FREIGRENZE_EINZEL_EUR) {
      const voll = 0.055 * estEuro;
      const gemildert = 0.119 * (estEuro - SOLI_FREIGRENZE_EINZEL_EUR);
      expect(r.soli / 100).toBeCloseTo(Math.min(voll, gemildert), 2);
    }
  });

  it("settles at 5,5 % well above the Milderungszone", () => {
    // 300.000 € liegt in der obersten Zone; Vergleich in Cent, damit die
    // Rundung auf ganze Cent nicht als Abweichung durchschlägt.
    const r = soliBei(300_000);
    const erwartet = Math.round(0.055 * r.einkommensteuer);
    expect(Math.abs(r.soli - erwartet)).toBeLessThanOrEqual(1);
  });

  it("applies the top zone above 277.825 €", () => {
    const r = soliBei(300_000);
    // 0,45 × 300.000 − 19.470,38 = 115.529,62, abgerundet 115.529 €
    expect(r.einkommensteuer).toBe(euros(115_529));
  });
});

describe("Kirchensteuer", () => {
  it("is charged on the income tax, not the income", () => {
    const r = berechneEinkommensteuer({
      zvE: euros(60_000),
      veranlagung: "einzel",
      kirchensteuer: "neun",
    });
    expect(r.kirchensteuer).toBe(Math.round(r.einkommensteuer * 0.09));
  });

  it("adds up to the total and leaves the rest as net", () => {
    const r = berechneEinkommensteuer({
      zvE: euros(60_000),
      veranlagung: "einzel",
      kirchensteuer: "neun",
    });
    expect(r.gesamt).toBe(r.einkommensteuer + r.soli + r.kirchensteuer);
    expect(r.nettoEinkommen).toBe(euros(60_000) - r.gesamt);
  });
});
