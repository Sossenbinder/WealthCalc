import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneNettoSparplan,
  type NettoSparplanInput,
} from "@/lib/engine/finance/netto-sparplan";

const base: NettoSparplanInput = {
  startkapital: euros(10_000),
  monatlicheSparrate: euros(300),
  rendite: 7,
  jahre: 20,
  startjahr: 2026,
  fondsArt: "aktienfonds",
  sparerpauschbetragProJahr: euros(1_000),
  kirchensteuer: "keine",
};

describe("ETF-Sparplan nach Steuern", () => {
  it("counts every euro paid in", () => {
    const r = berechneNettoSparplan(base);
    expect(r.eingezahlt).toBe(euros(10_000) + euros(300) * 12 * 20);
  });

  it("leaves less after tax than before", () => {
    const r = berechneNettoSparplan(base);
    expect(r.endkapitalNetto).toBeLessThan(r.endkapitalBrutto);
    expect(r.endkapitalNetto).toBe(r.endkapitalBrutto - r.steuerGesamt);
  });

  it("splits the tax between the saving years and the sale", () => {
    const r = berechneNettoSparplan(base);
    expect(r.steuerGesamt).toBe(r.steuerAnsparphase + r.steuerBeimVerkauf);
  });

  it("credits the Vorabpauschalen against the gain, so nothing is taxed twice", () => {
    // Ohne Anrechnung wäre die Verkaufssteuer höher; die Gesamtsteuer muss
    // unter der Steuer auf den vollen Gewinn ohne Anrechnung liegen.
    const r = berechneNettoSparplan(base);
    expect(r.vorabpauschalenGesamt).toBeGreaterThan(0);
    const gewinn = r.endkapitalBrutto - r.eingezahlt;
    // Aktienfonds: 30 % Teilfreistellung, dann 26,375 % — also rund 18,5 %.
    const ohneAnrechnung = gewinn * 0.7 * 0.26375;
    expect(r.steuerGesamt).toBeLessThan(ohneAnrechnung);
  });

  it("taxes a fund without Teilfreistellung more heavily", () => {
    const aktien = berechneNettoSparplan(base);
    const sonstige = berechneNettoSparplan({ ...base, fondsArt: "sonstige" });
    expect(sonstige.steuerGesamt).toBeGreaterThan(aktien.steuerGesamt);
  });

  it("charges less when the Sparerpauschbetrag absorbs more", () => {
    const mit = berechneNettoSparplan(base);
    const ohne = berechneNettoSparplan({
      ...base,
      sparerpauschbetragProJahr: 0,
    });
    expect(ohne.steuerGesamt).toBeGreaterThan(mit.steuerGesamt);
  });

  it("keeps the yearly rows consistent with the balance", () => {
    const r = berechneNettoSparplan(base);
    for (let i = 1; i < r.jahre.length; i += 1) {
      expect(r.jahre[i].wertJahresanfang).toBe(r.jahre[i - 1].wertJahresende);
    }
    expect(r.jahre[r.jahre.length - 1].wertJahresende).toBe(r.endkapitalBrutto);
  });

  it("says when it had to carry the Basiszins forward", () => {
    // 2026 ist der letzte veröffentlichte Wert, also wird fortgeschrieben.
    expect(berechneNettoSparplan(base).basiszinsFortgeschrieben).toBe(true);
    // Ein einzelnes Jahr innerhalb des veröffentlichten Bereichs nicht.
    expect(
      berechneNettoSparplan({ ...base, startjahr: 2024, jahre: 1 })
        .basiszinsFortgeschrieben,
    ).toBe(false);
  });

  it("charges nothing when nothing grew", () => {
    const r = berechneNettoSparplan({ ...base, rendite: 0 });
    expect(r.endkapitalBrutto).toBe(r.eingezahlt);
    expect(r.steuerGesamt).toBe(0);
    expect(r.steuerquote).toBe(0);
  });
});
