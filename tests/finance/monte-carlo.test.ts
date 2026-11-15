import { describe, expect, it } from "vitest";
import { euros } from "@/lib/engine/money";
import { calculateSparplan } from "@/lib/engine/finance/zinseszins";
import { berechneEntnahmeplan } from "@/lib/engine/finance/entnahmeplan";
import {
  createNormal,
  createRng,
  histogramm,
  pfadAmPerzentil,
  pfadDetail,
  simuliereMonteCarlo,
  type MonteCarloInput,
} from "@/lib/engine/finance/monte-carlo";

const base: MonteCarloInput = {
  startkapital: euros(10_000),
  sparrate: euros(500),
  dynamik: 0,
  ansparJahre: 20,
  rendite: 7,
  volatilitaet: 15,
  kosten: 0,
  inflation: 2,
  zielkapital: 0,
  entnahme: 0,
  entnahmeJahre: 0,
  simulationen: 2_000,
  seed: 42,
};

const run = (over: Partial<MonteCarloInput> = {}) =>
  simuliereMonteCarlo({ ...base, ...over });

describe("Zufallsgenerator", () => {
  it("is reproducible from its seed", () => {
    const a = createRng(7);
    const b = createRng(7);
    const c = createRng(8);
    const folgeA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(folgeA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(folgeA);
    for (const u of folgeA) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it("draws standard normal values", () => {
    const normal = createNormal(createRng(1));
    const n = 200_000;
    let summe = 0;
    let quadrate = 0;
    for (let i = 0; i < n; i++) {
      const z = normal();
      summe += z;
      quadrate += z * z;
    }
    const mittel = summe / n;
    expect(Math.abs(mittel)).toBeLessThan(0.01);
    expect(quadrate / n - mittel * mittel).toBeCloseTo(1, 1);
  });
});

describe("ohne Volatilität", () => {
  it("is the Sparplanrechner to the cent, on every path", () => {
    const r = run({ volatilitaet: 0, dynamik: 3, simulationen: 10 });
    const sparplan = calculateSparplan({
      startCapital: base.startkapital,
      monthlyContribution: base.sparrate,
      annualReturn: base.rendite,
      years: base.ansparJahre,
      timing: "end",
      annualInflation: base.inflation,
      contributionIncrease: 3,
    });
    for (const zeile of sparplan.years) {
      const jahr = r.jahre[zeile.year];
      expect(jahr.perzentile[5]).toBe(zeile.closingBalance);
      expect(jahr.perzentile[95]).toBe(zeile.closingBalance);
      expect(jahr.eingezahlt).toBe(zeile.totalPaidIn);
    }
    expect(r.ansparEnde.perzentile[50]).toBe(sparplan.finalBalance);
    expect(r.ansparEnde.mittelwert).toBe(sparplan.finalBalance);
  });

  it("subtracts the TER from the return multiplicatively", () => {
    // (1,07 × 0,99) − 1 = 5,93 % effektiv
    const r = run({ volatilitaet: 0, kosten: 1, simulationen: 1 });
    const sparplan = calculateSparplan({
      startCapital: base.startkapital,
      monthlyContribution: base.sparrate,
      annualReturn: 5.93,
      years: base.ansparJahre,
      timing: "end",
      annualInflation: 0,
      contributionIncrease: 0,
    });
    expect(r.ansparEnde.perzentile[50]).toBe(sparplan.finalBalance);
  });

  it("continues as the Entnahmeplan-Rechner, with the withdrawal indexed from today", () => {
    const r = run({
      volatilitaet: 0,
      simulationen: 1,
      entnahme: euros(1_000),
      entnahmeJahre: 25,
    });
    // 1.000 € heute sind nach 20 Jahren zu 2 % 1.485,95 €.
    expect(r.entnahme?.ersteEntnahme).toBe(euros(1_485.95));

    const plan = berechneEntnahmeplan({
      startkapital: r.ansparEnde.perzentile[50],
      monatlicheEntnahme: euros(1_485.95),
      rendite: 7,
      inflation: 2,
      jahre: 25,
    });
    for (const zeile of plan.jahre) {
      expect(r.jahre[base.ansparJahre + zeile.jahr].perzentile[50]).toBe(zeile.endkapital);
    }
    expect(r.entnahme?.erfolgsQuote).toBe(plan.erschoepftNachMonaten === null ? 1 : 0);
  });

  it("reports the month the money ran out", () => {
    // 12.000 € bei 0 %, 1.000 € im Monat: genau ein Jahr.
    const r = run({
      startkapital: euros(12_000),
      sparrate: 0,
      ansparJahre: 0,
      rendite: 0,
      volatilitaet: 0,
      inflation: 0,
      entnahme: euros(1_000),
      entnahmeJahre: 3,
      simulationen: 50,
    });
    expect(r.entnahme?.erfolgsQuote).toBe(0);
    expect(r.entnahme?.erschoepftMedianJahre).toBe(1);
    expect(r.entnahme?.erschoepftP10Jahre).toBe(1);
    expect(r.jahre[1].nochKapital).toBe(0);
    expect(r.jahre[3].perzentile[95]).toBe(0);
  });
});

describe("mit Volatilität", () => {
  it("is reproducible: same seed, same result", () => {
    expect(run()).toEqual(run());
    expect(run({ seed: 43 }).ansparEnde).not.toEqual(run().ansparEnde);
  });

  it("puts the median of a lump sum on the stated return", () => {
    // Median von 10.000 € × exp(N(20·ln 1,07, 0,15²·20)) = 10.000 × 1,07^20
    const r = run({ sparrate: 0, simulationen: 20_000 });
    const erwartet = euros(10_000 * Math.pow(1.07, 20));
    expect(r.ansparEnde.perzentile[50] / erwartet).toBeCloseTo(1, 1);
    // ... and its mean above it, by exp(σ²·T/2) ≈ 1,25.
    expect(r.ansparEnde.mittelwert / erwartet).toBeGreaterThan(1.15);
    expect(r.ansparEnde.mittelwert / erwartet).toBeLessThan(1.35);
  });

  it("orders the percentiles and widens the fan over time", () => {
    const r = run();
    for (const jahr of r.jahre.slice(1)) {
      const p = jahr.perzentile;
      expect(p[5]).toBeLessThanOrEqual(p[10]);
      expect(p[10]).toBeLessThanOrEqual(p[25]);
      expect(p[25]).toBeLessThanOrEqual(p[50]);
      expect(p[50]).toBeLessThanOrEqual(p[75]);
      expect(p[75]).toBeLessThanOrEqual(p[90]);
      expect(p[90]).toBeLessThanOrEqual(p[95]);
    }
    const spanne = (j: number) =>
      r.jahre[j].perzentile[95] / r.jahre[j].perzentile[5];
    expect(spanne(20)).toBeGreaterThan(spanne(5));
  });

  it("counts targets reached and losses against what was paid in", () => {
    const r = run({ zielkapital: euros(250_000) });
    expect(r.ansparEnde.eingezahlt).toBe(euros(10_000 + 500 * 12 * 20));
    expect(r.ansparEnde.zielQuote).toBeGreaterThan(0.3);
    expect(r.ansparEnde.zielQuote).toBeLessThan(0.8);
    expect(r.ansparEnde.verlustQuote).toBeGreaterThan(0);
    expect(r.ansparEnde.verlustQuote).toBeLessThan(0.1);
    expect(run().ansparEnde.zielQuote).toBeNull();
  });

  it("fails some withdrawal plans that work on average", () => {
    // 4 % von 1 Mio. bei 5 % Median-Rendite trägt deterministisch dauerhaft;
    // mit 18 % Volatilität scheitert ein Teil der Verläufe an der Reihenfolge.
    const r = run({
      startkapital: euros(1_000_000),
      sparrate: 0,
      ansparJahre: 0,
      rendite: 5,
      volatilitaet: 18,
      inflation: 2,
      entnahme: euros(3_333.33),
      entnahmeJahre: 40,
    });
    const quote = r.entnahme!.erfolgsQuote;
    expect(quote).toBeGreaterThan(0.4);
    expect(quote).toBeLessThan(0.98);
    expect(r.jahre[40].nochKapital).toBeCloseTo(quote, 10);
  });
});

describe("eigener Markt in der Entnahme", () => {
  const mitEntnahme = { entnahme: euros(1_500), entnahmeJahre: 30 };

  it("changes nothing when given the same values", () => {
    const ohne = run(mitEntnahme);
    const gleich = run({ ...mitEntnahme, entnahmeRendite: 7, entnahmeVolatilitaet: 15 });
    expect(gleich.jahre).toEqual(ohne.jahre);
    expect(gleich.entnahme).toEqual(ohne.entnahme);
  });

  it("continues as the Entnahmeplan-Rechner at the withdrawal phase's return", () => {
    const r = run({
      ...mitEntnahme,
      volatilitaet: 0,
      entnahmeRendite: 3,
      entnahmeVolatilitaet: 0,
      simulationen: 1,
    });
    const sparplan = calculateSparplan({
      startCapital: base.startkapital,
      monthlyContribution: base.sparrate,
      annualReturn: 7,
      years: base.ansparJahre,
      timing: "end",
      annualInflation: 0,
      contributionIncrease: 0,
    });
    expect(r.ansparEnde.perzentile[50]).toBe(sparplan.finalBalance);
    const plan = berechneEntnahmeplan({
      startkapital: sparplan.finalBalance,
      monatlicheEntnahme: r.entnahme!.ersteEntnahme,
      rendite: 3,
      inflation: 2,
      jahre: 30,
    });
    for (const zeile of plan.jahre) {
      expect(r.jahre[base.ansparJahre + zeile.jahr].perzentile[50]).toBe(zeile.endkapital);
    }
  });

  it("leaves the Ansparphase untouched and gives each path the same shocks", () => {
    const aktien = run(mitEntnahme);
    const defensiv = run({ ...mitEntnahme, entnahmeRendite: 4, entnahmeVolatilitaet: 6 });
    expect(defensiv.ansparEnde).toEqual(aktien.ansparEnde);
    expect(defensiv.jahre.slice(0, base.ansparJahre + 1)).toEqual(
      aktien.jahre.slice(0, base.ansparJahre + 1),
    );
    // Same shock, smaller swing: a path's first withdrawal year moves in the
    // same direction around its own median, but less far.
    const jahre = defensiv.pfade.jahre;
    for (let pfad = 0; pfad < 50; pfad++) {
      const a = Math.log(1 + aktien.pfade.jahresRenditen[pfad * jahre + base.ansparJahre]);
      const d = Math.log(1 + defensiv.pfade.jahresRenditen[pfad * jahre + base.ansparJahre]);
      const za = (a - Math.log(1.07)) / 0.15;
      const zd = (d - Math.log(1.04)) / 0.06;
      expect(zd).toBeCloseTo(za, 6);
    }
  });

  it("narrows the spread of outcomes in retirement", () => {
    const aktien = run(mitEntnahme);
    const defensiv = run({ ...mitEntnahme, entnahmeRendite: 7, entnahmeVolatilitaet: 5 });
    const breite = (r: typeof aktien) => {
      const j = r.jahre[base.ansparJahre + 10].perzentile;
      return j[90] - j[10];
    };
    expect(breite(defensiv)).toBeLessThan(breite(aktien));
  });
});

describe("einzelne Verläufe", () => {
  it("keeps every path's year-end capital, consistent with the percentiles", () => {
    const r = run({ simulationen: 501 });
    const { pfade } = r;
    expect(pfade.anzahl).toBe(501);
    expect(pfade.jahre).toBe(20);
    for (const jahr of [0, 7, 20]) {
      const werte = Array.from({ length: 501 }, (_, i) => pfade.salden[i * 21 + jahr]).sort(
        (a, b) => a - b,
      );
      // 501 paths: the median is exactly the 251st value.
      expect(werte[250]).toBe(r.jahre[jahr].perzentile[50]);
    }
  });

  it("ranks the paths from worst to best outcome", () => {
    const { pfade } = run({ simulationen: 300 });
    const ende = (i: number) => pfade.salden[i * 21 + 20];
    expect(new Set(pfade.rangfolge).size).toBe(300);
    for (let k = 1; k < 300; k++) {
      expect(ende(pfade.rangfolge[k])).toBeGreaterThanOrEqual(ende(pfade.rangfolge[k - 1]));
    }
    expect(pfadAmPerzentil(pfade, 0)).toBe(pfade.rangfolge[0]);
    expect(pfadAmPerzentil(pfade, 100)).toBe(pfade.rangfolge[299]);
    expect(pfadAmPerzentil(pfade, 50)).toBe(pfade.rangfolge[150]);
  });

  it("ranks paths that ran dry earlier as worse", () => {
    const { pfade } = run({
      startkapital: euros(300_000),
      sparrate: 0,
      ansparJahre: 0,
      volatilitaet: 25,
      entnahme: euros(2_000),
      entnahmeJahre: 30,
      simulationen: 400,
    });
    const leer = Array.from(pfade.rangfolge)
      .map((i) => pfade.erschoepft[i])
      .filter((m) => m !== -1);
    expect(leer.length).toBeGreaterThan(10);
    expect(leer).toEqual([...leer].sort((a, b) => a - b));
    // and the worst path is one of them
    expect(pfade.erschoepft[pfade.rangfolge[0]]).toBe(leer[0]);
  });

  it("records the fund's yearly return, not the account's", () => {
    // Ohne Sparrate ist die Kontoentwicklung die Fondsrendite, bis auf Centrundung.
    const { pfade } = run({ sparrate: 0, simulationen: 50 });
    const d = pfadDetail(pfade, 17);
    expect(d.salden).toHaveLength(21);
    expect(d.renditen).toHaveLength(20);
    d.renditen.forEach((rendite, i) => {
      expect(d.salden[i + 1] / d.salden[i] - 1).toBeCloseTo(rendite, 4);
    });
    const gesamt = d.salden[20] / d.salden[0];
    expect(Math.pow(1 + d.renditeProJahr, 20)).toBeCloseTo(gesamt, 3);
    expect(d.besteJahr!.rendite).toBe(Math.max(...d.renditen));
    expect(d.schlechtesteJahr!.rendite).toBe(Math.min(...d.renditen));
  });

  it("measures the deepest fall from a previous high", () => {
    const flach = pfadDetail(run({ volatilitaet: 0, simulationen: 1 }).pfade, 0);
    expect(flach.maxDrawdown).toBe(0);
    expect(flach.drawdownTiefJahr).toBeNull();
    expect(flach.renditeProJahr).toBeCloseTo(0.07, 10);

    const { pfade } = run({ volatilitaet: 20, simulationen: 200 });
    for (let i = 0; i < 200; i++) {
      const d = pfadDetail(pfade, i);
      expect(d.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(d.maxDrawdown).toBeLessThan(1);
      // A whole losing year is a fall at least that deep.
      expect(d.maxDrawdown).toBeGreaterThanOrEqual(-d.schlechtesteJahr!.rendite - 1e-12);
    }
  });

  it("reports when a path ran dry", () => {
    const d = pfadDetail(
      run({
        startkapital: euros(12_000),
        sparrate: 0,
        ansparJahre: 0,
        rendite: 0,
        volatilitaet: 0,
        inflation: 0,
        entnahme: euros(1_000),
        entnahmeJahre: 3,
        simulationen: 1,
      }).pfade,
      0,
    );
    expect(d.leerNachJahren).toBe(1);
    expect(d.salden).toEqual([euros(12_000), 0, 0, 0]);
  });
});

describe("Histogramm", () => {
  it("puts every path in exactly one class, in ranking order", () => {
    const { pfade } = run({ simulationen: 1_000 });
    const h = histogramm(pfade, 100);
    expect(h.leer).toBe(0);
    expect(h.klassen.reduce((s, k) => s + k.anzahl, 0)).toBe(1_000);
    let naechsterRang = 0;
    for (const k of h.klassen) {
      if (k.anzahl === 0) continue;
      expect(k.rangVon).toBe(naechsterRang);
      expect(k.rangBis - k.rangVon + 1).toBe(k.anzahl);
      naechsterRang = k.rangBis + 1;
    }
    // round class widths
    const breite = h.klassen[0].bis - h.klassen[0].von;
    expect(Number((breite / Math.pow(10, Math.floor(Math.log10(breite)))).toFixed(6))).toSatisfy(
      (x: number) => [1, 2, 2.5, 5].includes(x),
    );
    expect(h.klassen.length).toBeGreaterThan(15);
    expect(h.klassen.length).toBeLessThan(45);
  });

  it("counts paths that ran dry separately, before every class", () => {
    const { pfade } = run({
      startkapital: euros(300_000),
      sparrate: 0,
      ansparJahre: 0,
      volatilitaet: 25,
      entnahme: euros(2_000),
      entnahmeJahre: 30,
      simulationen: 400,
    });
    const h = histogramm(pfade, 100);
    const leer = Array.from(pfade.erschoepft).filter((m) => m !== -1).length;
    expect(h.leer).toBe(leer);
    expect(h.klassen.reduce((s, k) => s + k.anzahl, 0)).toBe(400 - leer);
    expect(h.klassen.find((k) => k.anzahl > 0)!.rangVon).toBe(leer);
  });

  it("copes with every path ending in the same place", () => {
    const h = histogramm(run({ volatilitaet: 0, simulationen: 20 }).pfade, 100);
    expect(h.klassen.reduce((s, k) => s + k.anzahl, 0)).toBe(20);
  });
});
