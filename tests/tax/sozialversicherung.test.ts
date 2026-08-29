import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import { berechneSozialversicherung } from "@/lib/engine/tax/sozialversicherung";
import * as K from "@/lib/engine/tax/constants/2026";

const base = {
  bruttoMonat: euros(4_000),
  zusatzbeitrag: 2.9,
  kinderlos: false,
  kinderUnter25: 0,
};

describe("Sozialversicherung 2026", () => {
  it("charges the published rates on the full salary below the ceilings", () => {
    const r = berechneSozialversicherung(base);
    // 4.000 € × 17,5 % (14,6 + 2,9) = 700 €, hälftig geteilt.
    expect(r.kranken.gesamt).toBe(euros(700));
    expect(r.kranken.arbeitnehmer).toBe(euros(350));
    // 3,6 % = 144 €, hälftig.
    expect(r.pflege.gesamt).toBe(euros(144));
    // 18,6 % = 744 €, hälftig.
    expect(r.rente.gesamt).toBe(euros(744));
    // 2,6 % = 104 €, hälftig.
    expect(r.arbeitslos.gesamt).toBe(euros(104));
  });

  it("splits everything equally when there is no surcharge", () => {
    const r = berechneSozialversicherung(base);
    expect(r.gesamt.arbeitnehmer).toBe(r.gesamt.arbeitgeber);
  });

  it("puts the childless surcharge on the employee alone", () => {
    const mit = berechneSozialversicherung({ ...base, kinderlos: true });
    const ohne = berechneSozialversicherung(base);
    expect(mit.pflege.arbeitgeber).toBe(ohne.pflege.arbeitgeber);
    // 0,6 % von 4.000 € = 24 €, allein beim Arbeitnehmer.
    expect(mit.pflege.arbeitnehmer - ohne.pflege.arbeitnehmer).toBe(euros(24));
  });

  it("discounts the employee from the second through the fifth child", () => {
    const eins = berechneSozialversicherung({ ...base, kinderUnter25: 1 });
    const zwei = berechneSozialversicherung({ ...base, kinderUnter25: 2 });
    const fuenf = berechneSozialversicherung({ ...base, kinderUnter25: 5 });
    const sechs = berechneSozialversicherung({ ...base, kinderUnter25: 6 });
    // Das erste Kind bringt keinen Abschlag.
    expect(eins.pflege.arbeitnehmer).toBe(
      berechneSozialversicherung(base).pflege.arbeitnehmer,
    );
    // 0,25 % von 4.000 € = 10 € je Kind ab dem zweiten.
    expect(eins.pflege.arbeitnehmer - zwei.pflege.arbeitnehmer).toBe(euros(10));
    // Ab dem sechsten Kind ändert sich nichts mehr.
    expect(sechs.pflege.arbeitnehmer).toBe(fuenf.pflege.arbeitnehmer);
  });

  it("stops charging above the Beitragsbemessungsgrenzen", () => {
    const hoch = berechneSozialversicherung({
      ...base,
      bruttoMonat: euros(20_000),
    });
    expect(hoch.bemessungKvPv).toBe(K.BBG_KV_PV_MONAT);
    expect(hoch.bemessungRvAv).toBe(K.BBG_RV_AV_MONAT);
    expect(hoch.bbgErreichtKvPv).toBe(true);
    expect(hoch.bbgErreichtRvAv).toBe(true);
    // Verdoppelt man das Brutto darüber, bleibt der Beitrag gleich.
    const nochHoeher = berechneSozialversicherung({
      ...base,
      bruttoMonat: euros(40_000),
    });
    expect(nochHoeher.gesamt.gesamt).toBe(hoch.gesamt.gesamt);
  });

  it("follows the Krankenkasse's own Zusatzbeitrag", () => {
    const guenstig = berechneSozialversicherung({ ...base, zusatzbeitrag: 1.5 });
    const teuer = berechneSozialversicherung({ ...base, zusatzbeitrag: 4 });
    expect(teuer.kranken.gesamt).toBeGreaterThan(guenstig.kranken.gesamt);
    // 2,5 Prozentpunkte auf 4.000 € = 100 €.
    expect(teuer.kranken.gesamt - guenstig.kranken.gesamt).toBe(euros(100));
  });

  it("leaves the employee gross less their own share", () => {
    const r = berechneSozialversicherung(base);
    expect(r.nettoVorSteuer).toBe(base.bruttoMonat - r.gesamt.arbeitnehmer);
  });

  it("keeps each branch's halves summing to its total", () => {
    const r = berechneSozialversicherung({ ...base, kinderlos: true });
    for (const zweig of [r.kranken, r.pflege, r.rente, r.arbeitslos]) {
      expect(zweig.arbeitnehmer + zweig.arbeitgeber).toBe(zweig.gesamt);
    }
  });
});
