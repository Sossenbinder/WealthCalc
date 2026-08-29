import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import { berechneKirchensteuerLast } from "@/lib/engine/tax/kirchensteuer-last";
import { einkommensteuerBetrag } from "@/lib/engine/tax/einkommensteuer";

const run = (zvE: number, over = {}) =>
  berechneKirchensteuerLast({
    zvE: euros(zvE),
    veranlagung: "einzel",
    satz: 9,
    ...over,
  });

describe("Kirchensteuer", () => {
  it("is a share of the income tax, not of the income", () => {
    const r = run(60_000);
    expect(r.einkommensteuer).toBe(einkommensteuerBetrag(euros(60_000), "einzel"));
    expect(r.kirchensteuer).toBe(Math.round(r.einkommensteuer * 0.09));
  });

  it("costs less in Bayern and Baden-Württemberg", () => {
    const neun = run(60_000);
    const acht = run(60_000, { satz: 8 });
    expect(acht.kirchensteuer).toBeLessThan(neun.kirchensteuer);
    expect(acht.kirchensteuer).toBe(Math.round(acht.einkommensteuer * 0.08));
  });

  it("gives part of it back through the Sonderausgabenabzug", () => {
    const r = run(60_000);
    expect(r.entlastung).toBeGreaterThan(0);
    expect(r.nettokosten).toBeLessThan(r.kirchensteuer);
    expect(r.nettokosten).toBe(r.kirchensteuer - r.entlastung);
  });

  it("gives more back the higher the marginal rate", () => {
    const klein = run(30_000);
    const gross = run(200_000);
    const anteil = (r: ReturnType<typeof run>) => r.entlastung / r.kirchensteuer;
    expect(anteil(gross)).toBeGreaterThan(anteil(klein));
  });

  it("costs nothing below the Grundfreibetrag", () => {
    const r = run(12_000);
    expect(r.einkommensteuer).toBe(0);
    expect(r.kirchensteuer).toBe(0);
    expect(r.nettokosten).toBe(0);
    expect(r.anteilAmEinkommen).toBe(0);
  });

  it("costs a couple less than a single person on the same income", () => {
    const allein = run(80_000);
    const paar = run(80_000, { veranlagung: "zusammen" });
    expect(paar.kirchensteuer).toBeLessThan(allein.kirchensteuer);
  });

  it("projects thirty years without discounting", () => {
    const r = run(60_000);
    expect(r.hochrechnung30Jahre).toBe(r.nettokosten * 30);
  });

  it("stays a small share of income", () => {
    for (const zvE of [30_000, 60_000, 120_000]) {
      const r = run(zvE);
      expect(r.anteilAmEinkommen).toBeGreaterThan(0);
      expect(r.anteilAmEinkommen).toBeLessThan(4);
    }
  });
});
