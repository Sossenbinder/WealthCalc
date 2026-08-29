import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import { berechneAbfindung } from "@/lib/engine/tax/abfindung";
import { einkommensteuerBetrag } from "@/lib/engine/tax/einkommensteuer";

const run = (zvE: number, abfindung: number, over = {}) =>
  berechneAbfindung({
    verbleibendesZvE: euros(zvE),
    abfindung: euros(abfindung),
    veranlagung: "einzel",
    kirchensteuer: "keine",
    ...over,
  });

describe("Fünftelregelung § 34 EStG", () => {
  it("is five times the step from adding one fifth", () => {
    const r = run(50_000, 100_000);
    const basis = einkommensteuerBetrag(euros(50_000), "einzel");
    const mitEinemFuenftel = einkommensteuerBetrag(euros(70_000), "einzel");
    expect(r.steuerAbfindung).toBe(5 * (mitEinemFuenftel - basis));
  });

  it("costs less than taxing the severance as ordinary income", () => {
    const r = run(50_000, 100_000);
    expect(r.steuerAbfindung).toBeLessThan(r.steuerOhneFuenftelregelung);
    expect(r.ersparnis).toBeGreaterThan(0);
  });

  it("gives up its advantage once the top rate is already reached", () => {
    // Wer ohnehin im Spitzensteuersatz liegt, verteilt nichts mehr nach unten.
    const klein = run(30_000, 60_000);
    const gross = run(300_000, 60_000);
    expect(gross.ersparnis).toBeLessThan(klein.ersparnis);
  });

  it("uses sentence 3 when there is no ordinary income", () => {
    const r = run(0, 100_000);
    expect(r.sonderfallOhneLaufendesEinkommen).toBe(true);
    expect(r.steuerAbfindung).toBe(
      5 * einkommensteuerBetrag(euros(20_000), "einzel"),
    );
  });

  it("taxes nothing when there is no severance", () => {
    const r = run(50_000, 0);
    expect(r.steuerAbfindung).toBe(0);
    expect(r.ersparnis).toBe(0);
    expect(r.effektiverSatz).toBe(0);
    expect(r.sonderfallOhneLaufendesEinkommen).toBe(false);
  });

  it("leaves the severance less its own tax", () => {
    const r = run(50_000, 100_000);
    expect(r.nettoAbfindung).toBe(euros(100_000) - r.steuerAbfindung);
    expect(r.effektiverSatz).toBeGreaterThan(0);
    expect(r.effektiverSatz).toBeLessThan(45);
  });

  it("costs a couple less than a single person", () => {
    const allein = run(50_000, 100_000);
    const paar = run(50_000, 100_000, { veranlagung: "zusammen" });
    expect(paar.steuerAbfindung).toBeLessThan(allein.steuerAbfindung);
  });

  it("adds Soli and Kirchensteuer on the combined income tax", () => {
    const r = run(50_000, 100_000, { kirchensteuer: "neun" });
    expect(r.kirchensteuer).toBe(
      Math.round((r.steuerLaufend + r.steuerAbfindung) * 0.09),
    );
    expect(r.steuerGesamt).toBe(
      r.steuerLaufend + r.steuerAbfindung + r.soli + r.kirchensteuer,
    );
  });
});
