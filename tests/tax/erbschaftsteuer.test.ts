import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneErbschaftsteuer,
  VERWANDTSCHAFT,
} from "@/lib/engine/tax/erbschaftsteuer";

const run = (erwerb: number, id = "kind") =>
  berechneErbschaftsteuer({ erwerb: euros(erwerb), verwandtschaftId: id })!;

describe("Erbschaftsteuer", () => {
  it("charges nothing while the Freibetrag covers the acquisition", () => {
    const r = run(400_000);
    expect(r.freibetrag).toBe(euros(400_000));
    expect(r.steuerpflichtigerErwerb).toBe(0);
    expect(r.steuer).toBe(0);
    expect(r.nettoErwerb).toBe(euros(400_000));
  });

  it("uses the Freibetrag of the relationship, not a flat one", () => {
    expect(run(1, "ehegatte").freibetrag).toBe(euros(500_000));
    expect(run(1, "enkel").freibetrag).toBe(euros(200_000));
    expect(run(1, "klasse3").freibetrag).toBe(euros(20_000));
  });

  it("taxes the whole taxable amount at the band rate, not in slices", () => {
    // 475.000 - 400.000 Freibetrag = 75.000 steuerpflichtig, Klasse I: 7 %
    const r = run(475_000);
    expect(r.steuerpflichtigerErwerb).toBe(euros(75_000));
    expect(r.steuersatz).toBe(7);
    expect(r.steuer).toBe(euros(5_250));
  });

  it("softens the jump at a band boundary", () => {
    // Ohne Härteausgleich spränge die Steuer bei 75.001 € von 7 % auf 11 %
    // des ganzen Betrags — von 5.250 € auf über 8.250 €.
    const knappDrunter = run(475_000);
    const knappDrueber = run(475_001);
    expect(knappDrueber.haerteausgleichGreift).toBe(true);
    expect(knappDrueber.steuerOhneHaerteausgleich).toBeGreaterThan(
      euros(8_000),
    );
    // Tatsächlich darf nur die Hälfte des Überschreitungsbetrags hinzukommen.
    expect(knappDrueber.steuer - knappDrunter.steuer).toBeLessThanOrEqual(
      euros(1),
    );
  });

  it("never lets the Härteausgleich raise the tax", () => {
    for (const erwerb of [500_000, 700_000, 1_000_000, 7_000_000, 30_000_000]) {
      const r = run(erwerb);
      expect(r.steuer).toBeLessThanOrEqual(r.steuerOhneHaerteausgleich);
    }
  });

  it("never falls as the acquisition rises", () => {
    let vorher = 0;
    for (let e = 400_000; e <= 2_000_000; e += 9_973) {
      const jetzt = run(e).steuer;
      expect(jetzt).toBeGreaterThanOrEqual(vorher);
      vorher = jetzt;
    }
  });

  it("charges a stranger far more than a child on the same amount", () => {
    const kind = run(1_000_000, "kind");
    const fremd = run(1_000_000, "klasse3");
    expect(fremd.steuer).toBeGreaterThan(kind.steuer * 2);
    expect(fremd.klasse).toBe("III");
  });

  it("holds Steuerklasse III at 30 % across the lower bands", () => {
    // § 19: 30 % bis 13 Mio, unabhängig von der Stufe.
    for (const erwerb of [100_000, 400_000, 1_000_000]) {
      expect(run(erwerb, "klasse3").steuersatz).toBe(30);
    }
  });

  it("leaves the heir the acquisition less the tax", () => {
    const r = run(1_000_000);
    expect(r.nettoErwerb).toBe(euros(1_000_000) - r.steuer);
    expect(r.effektiverSatz).toBeLessThan(r.steuersatz);
  });

  it("rejects a relationship it does not know", () => {
    expect(
      berechneErbschaftsteuer({ erwerb: euros(1), verwandtschaftId: "xx" }),
    ).toBeNull();
  });

  it("covers every relationship offered in the UI", () => {
    for (const v of VERWANDTSCHAFT) {
      expect(run(1_000_000, v.id).klasse).toBe(v.klasse);
    }
  });
});
