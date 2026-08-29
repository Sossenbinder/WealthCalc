import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import { berechneSelbststaendigeKv } from "@/lib/engine/tax/selbststaendige-kv";
import * as K from "@/lib/engine/tax/constants/2026";

const base = {
  einkommenMonat: euros(4_000),
  zusatzbeitrag: 2.9,
  mitKrankengeld: true,
  kinderlos: false,
};

describe("Krankenversicherung für Selbstständige", () => {
  it("charges the full rate, not half of it", () => {
    const r = berechneSelbststaendigeKv(base);
    // 4.000 × 17,5 % = 700 €, ungeteilt.
    expect(r.kranken).toBe(euros(700));
    // 4.000 × 3,6 % = 144 €.
    expect(r.pflege).toBe(euros(144));
    expect(r.gesamt).toBe(euros(844));
  });

  it("costs about twice what an employee carries", () => {
    const r = berechneSelbststaendigeKv(base);
    expect(r.gesamt).toBeGreaterThan(r.vergleichAngestellt * 1.9);
    expect(r.gesamt).toBeLessThan(r.vergleichAngestellt * 2.1);
  });

  it("uses the reduced rate without Krankengeld cover", () => {
    const mit = berechneSelbststaendigeKv(base);
    const ohne = berechneSelbststaendigeKv({ ...base, mitKrankengeld: false });
    expect(ohne.kranken).toBeLessThan(mit.kranken);
    // 0,6 Prozentpunkte auf 4.000 € = 24 €.
    expect(mit.kranken - ohne.kranken).toBe(euros(24));
  });

  it("never drops below the minimum basis", () => {
    const r = berechneSelbststaendigeKv({ ...base, einkommenMonat: euros(500) });
    expect(r.mindestbemessungGreift).toBe(true);
    expect(r.bemessung).toBe(K.MINDESTBEMESSUNG_MONAT);
    // Auf 500 € Gewinn ist das ein erdrückender Satz.
    expect(r.effektiverSatz).toBeGreaterThan(50);
  });

  it("stops at the Beitragsbemessungsgrenze", () => {
    const hoch = berechneSelbststaendigeKv({ ...base, einkommenMonat: euros(20_000) });
    const hoeher = berechneSelbststaendigeKv({ ...base, einkommenMonat: euros(40_000) });
    expect(hoch.bemessung).toBe(K.BBG_KV_PV_MONAT);
    expect(hoch.bbgErreicht).toBe(true);
    expect(hoeher.gesamt).toBe(hoch.gesamt);
  });

  it("adds the childless surcharge in full", () => {
    const ohne = berechneSelbststaendigeKv(base);
    const mit = berechneSelbststaendigeKv({ ...base, kinderlos: true });
    // 0,6 % von 4.000 € = 24 €.
    expect(mit.pflege - ohne.pflege).toBe(euros(24));
  });

  it("follows the Krankenkasse's Zusatzbeitrag", () => {
    const guenstig = berechneSelbststaendigeKv({ ...base, zusatzbeitrag: 1 });
    const teuer = berechneSelbststaendigeKv({ ...base, zusatzbeitrag: 3 });
    // 2 Prozentpunkte auf 4.000 € = 80 €.
    expect(teuer.kranken - guenstig.kranken).toBe(euros(80));
  });

  it("falls as a share of income once above the minimum", () => {
    const klein = berechneSelbststaendigeKv({ ...base, einkommenMonat: euros(2_000) });
    const gross = berechneSelbststaendigeKv({ ...base, einkommenMonat: euros(10_000) });
    expect(gross.effektiverSatz).toBeLessThan(klein.effektiverSatz);
  });
});
