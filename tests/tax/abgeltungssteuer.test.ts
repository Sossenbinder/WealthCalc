import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import {
  berechneAbgeltungssteuer,
  type AbgeltungssteuerInput,
} from "@/lib/engine/tax/abgeltungssteuer";

const base: AbgeltungssteuerInput = {
  verkaufserloes: euros(50_000),
  kaufpreis: euros(30_000),
  versteuerteVorabpauschalen: euros(0),
  fondsArt: "aktienfonds",
  sparerpauschbetragRest: euros(0),
  kirchensteuer: "keine",
};

describe("Abgeltungsteuer auf einen Verkauf", () => {
  it("taxes the gain after the Teilfreistellung", () => {
    const r = berechneAbgeltungssteuer(base);
    expect(r.rohgewinn).toBe(euros(20_000));
    // 30 % Teilfreistellung -> 14.000 € steuerpflichtig
    expect(r.nachTeilfreistellung).toBe(euros(14_000));
    // 26,375 % davon
    expect(r.steuer.total).toBe(euros(3_692.5));
  });

  it("credits Vorabpauschalen already taxed, so nothing is taxed twice", () => {
    const ohne = berechneAbgeltungssteuer(base);
    const mit = berechneAbgeltungssteuer({
      ...base,
      versteuerteVorabpauschalen: euros(2_000),
    });
    expect(mit.gewinn).toBe(euros(18_000));
    expect(mit.steuer.total).toBeLessThan(ohne.steuer.total);
  });

  it("consumes the Sparerpauschbetrag before taxing", () => {
    const r = berechneAbgeltungssteuer({
      ...base,
      sparerpauschbetragRest: euros(1_000),
    });
    expect(r.sparerpauschbetragGenutzt).toBe(euros(1_000));
    expect(r.bemessungsgrundlage).toBe(euros(13_000));
  });

  it("charges nothing on a loss", () => {
    const r = berechneAbgeltungssteuer({
      ...base,
      verkaufserloes: euros(20_000),
    });
    expect(r.rohgewinn).toBe(euros(-10_000));
    expect(r.gewinn).toBe(0);
    expect(r.steuer.total).toBe(0);
    expect(r.nettoerloes).toBe(euros(20_000));
  });

  it("keeps the effective rate below the nominal 26,375 % for a fund", () => {
    const r = berechneAbgeltungssteuer(base);
    // Die Teilfreistellung drückt den effektiven Satz auf rund 18,5 %.
    expect(r.effektiverSteuersatz).toBeGreaterThan(18);
    expect(r.effektiverSteuersatz).toBeLessThan(19);
  });

  it("taxes a fund without Teilfreistellung at the full rate", () => {
    const r = berechneAbgeltungssteuer({ ...base, fondsArt: "sonstige" });
    expect(r.nachTeilfreistellung).toBe(euros(20_000));
    expect(r.effektiverSteuersatz).toBeCloseTo(26.375, 2);
  });

  it("leaves the seller the proceeds less the tax", () => {
    const r = berechneAbgeltungssteuer(base);
    expect(r.nettoerloes).toBe(base.verkaufserloes - r.steuer.total);
  });

  it("costs more with church tax", () => {
    const ohne = berechneAbgeltungssteuer(base);
    const mit = berechneAbgeltungssteuer({ ...base, kirchensteuer: "neun" });
    expect(mit.steuer.total).toBeGreaterThan(ohne.steuer.total);
    expect(mit.steuer.kist).toBeGreaterThan(0);
    // Die Kirchensteuer senkt die KESt selbst über e/(4+k).
    expect(mit.steuer.kest).toBeLessThan(ohne.steuer.kest);
  });
});
