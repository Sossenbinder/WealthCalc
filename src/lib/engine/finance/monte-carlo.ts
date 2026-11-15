import { applyRate, roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";

/**
 * Percentiles reported for every year. Symmetric around the median so a fan
 * chart can draw 5–95 and 25–75 bands, plus 10/90 for the "bad/good decade"
 * figures the result card names.
 */
export const PERZENTILE = [5, 10, 25, 50, 75, 90, 95] as const;
export type Perzentil = (typeof PERZENTILE)[number];
export type Perzentile = Record<Perzentil, Money>;

export const MAX_JAHRE_GESAMT = 100;

export interface MonteCarloInput {
  /** Einmalanlage today. */
  startkapital: Money;
  /** Saved at the end of every month of the Ansparphase. */
  sparrate: Money;
  /** Yearly increase of the Sparrate, e.g. 2 for 2 %. */
  dynamik: Percent;
  /** Whole years of saving. 0 starts withdrawing right away. */
  ansparJahre: number;
  /**
   * Median effective return per year before costs, e.g. 7 for 7 %.
   * At zero volatility this is exactly the Zinseszinsrechner's return.
   */
  rendite: Percent;
  /** Standard deviation of the yearly log return, e.g. 15 for 15 %. */
  volatilitaet: Percent;
  /** Running costs per year (TER), e.g. 0.2 for 0,2 %. */
  kosten: Percent;
  /** Yearly inflation, for the real figures and for indexing the withdrawal. */
  inflation: Percent;
  /** Compared with the nominal capital at the end of the Ansparphase. 0 = none. */
  zielkapital: Money;
  /** Monthly withdrawal in today's purchasing power. 0 = no Entnahmephase. */
  entnahme: Money;
  /** Whole years of withdrawing. Ignored without a withdrawal. */
  entnahmeJahre: number;
  /**
   * Median return before costs once withdrawals start — typically lower, for
   * a more defensive mix in retirement. Defaults to `rendite`.
   */
  entnahmeRendite?: Percent;
  /** Volatility once withdrawals start. Defaults to `volatilitaet`. */
  entnahmeVolatilitaet?: Percent;
  /** Number of simulated paths. */
  simulationen: number;
  /** Seed of the random generator: the same seed gives the same paths. */
  seed: number;
}

export interface MonteCarloJahr {
  /** 0 is today, before anything has happened. */
  jahr: number;
  phase: "anspar" | "entnahme";
  /** Nominal capital across all paths. */
  perzentile: Perzentile;
  /** Divide a nominal amount of this year by it to get today's purchasing power. */
  deflator: number;
  /** Startkapital plus every contribution so far — the same on every path. */
  eingezahlt: Money;
  /** Share of paths that still hold capital, 0..1. */
  nochKapital: number;
}

/**
 * Every simulated path, kept so a single one can be looked at — not only the
 * bands across all of them. Flat typed arrays rather than objects: at 10.000
 * paths over 100 years that is a million values, and typed arrays cross from
 * the worker without being copied.
 */
export interface MonteCarloPfade {
  anzahl: number;
  /** Years per path after year 0; the stride of the arrays below. */
  jahre: number;
  /** Nominal year-end capital, path-major: `salden[pfad * (jahre + 1) + jahr]`, year 0 = start. */
  salden: Float64Array;
  /** The fund's return in each year after costs: `jahresRenditen[pfad * jahre + jahr - 1]`. */
  jahresRenditen: Float64Array;
  /** Deepest fall of the fund's price from a previous high, 0..1. */
  maxDrawdown: Float64Array;
  /** Month (from the start) of the low point of that fall; -1 without one. */
  drawdownTief: Int32Array;
  /** Month into the Entnahmephase a path ran dry; -1 = never. */
  erschoepft: Int32Array;
  /**
   * Path indices from worst to best outcome: capital at the end of the
   * horizon, and among paths that ran dry, the earlier the worse.
   */
  rangfolge: Int32Array;
}

export interface MonteCarloResult {
  jahre: MonteCarloJahr[];
  pfade: MonteCarloPfade;
  /** Capital at the end of the Ansparphase (nominal). */
  ansparEnde: {
    perzentile: Perzentile;
    mittelwert: Money;
    eingezahlt: Money;
    deflator: number;
    /** Share of paths at or above the Zielkapital; null without a target. */
    zielQuote: number | null;
    /** Share of paths below what was paid in. */
    verlustQuote: number;
  };
  /** Null when there is no withdrawal phase. */
  entnahme: null | {
    /** The first monthly withdrawal in nominal euros, indexed from today. */
    ersteEntnahme: Money;
    /** Share of paths whose capital lasted the whole phase, 0..1. */
    erfolgsQuote: number;
    /**
     * Years into the Entnahmephase after which the unluckiest tenth of the
     * paths has run dry; null when fewer than a tenth ever do.
     */
    erschoepftP10Jahre: number | null;
    /** Median years until empty among the paths that did run out; null if none. */
    erschoepftMedianJahre: number | null;
  };
}

/**
 * xoshiro128** seeded through splitmix32: small, fast, and good enough that
 * the generator is not what limits a few million draws. Seeded rather than
 * Math.random so a shared link reproduces the exact same paths.
 */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  const splitmix = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = splitmix();
  let b = splitmix();
  let c = splitmix();
  let d = splitmix();
  return () => {
    const result = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0;
    const t = b << 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    // 2^-32: uniform on [0, 1).
    return result / 4294967296;
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Standard normal draws by Box–Muller, using both values of each pair. */
export function createNormal(uniform: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const [a, b] = boxMuller(uniform(), uniform());
    spare = b;
    return a;
  };
}

function boxMuller(u1: number, u2: number): [number, number] {
  // 1 - u keeps the logarithm away from zero.
  const r = Math.sqrt(-2 * Math.log(1 - u1));
  const theta = 2 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

/**
 * Fill a buffer with standard normal draws. The batch form of
 * {@link createNormal} — same pairs, same order — without a closure call and
 * a branch per value, which is most of the cost in the simulation loop.
 */
function fillNormal(buffer: Float64Array, uniform: () => number): void {
  const n = buffer.length;
  let i = 0;
  for (; i + 1 < n; i += 2) {
    const r = Math.sqrt(-2 * Math.log(1 - uniform()));
    const theta = 2 * Math.PI * uniform();
    buffer[i] = r * Math.cos(theta);
    buffer[i + 1] = r * Math.sin(theta);
  }
  if (i < n) buffer[i] = boxMuller(uniform(), uniform())[0];
}

/** Linear interpolation between the closest ranks of a sorted array. */
function quantile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function perzentileVon(werte: Float64Array): Perzentile {
  const sorted = Float64Array.from(werte).sort();
  const out = {} as Perzentile;
  for (const p of PERZENTILE) {
    out[p] = roundHalfAwayFromZero(quantile(sorted, p / 100));
  }
  return out;
}

/**
 * Simulate an ETF savings plan, and optionally the withdrawals after it, along
 * many random return paths.
 *
 * Returns follow a geometric Brownian motion in monthly steps: each month's
 * log return is normal with a twelfth of the yearly drift and a twelfth of the
 * yearly variance. The drift is chosen so the *median* path earns exactly the
 * stated effective return after costs — at zero volatility every path is the
 * Zinseszinsrechner's path to the cent, and with volatility the average path
 * earns more than the stated return while the typical one earns it. That is
 * the honest reading of "7 % im langjährigen Mittel": a geometric average.
 *
 * Mechanics follow the deterministic calculators so they can be checked
 * against each other: interest is rounded to cents every month, the Sparrate
 * is paid at the end of the month and rises once a year by the Dynamik
 * (Sparplanrechner), and in the Entnahmephase the return is credited before
 * the withdrawal, which rises once a year with inflation and cannot take the
 * capital below zero (Entnahmeplan-Rechner). The withdrawal is entered in
 * today's money, so its first nominal amount is already indexed over the
 * Ansparphase.
 *
 * The Entnahmephase may have a return and volatility of its own — the switch
 * to a more defensive mix at retirement. Costs and inflation stay the same.
 */
export function simuliereMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const n = Math.max(1, Math.floor(input.simulationen));
  const ansparJahre = Math.max(0, Math.floor(input.ansparJahre));
  const mitEntnahme = input.entnahme > 0 && input.entnahmeJahre > 0;
  const entnahmeJahre = mitEntnahme ? Math.max(0, Math.floor(input.entnahmeJahre)) : 0;
  const gesamtJahre = Math.min(ansparJahre + entnahmeJahre, MAX_JAHRE_GESAMT);

  const inflation = toDecimal(input.inflation);
  const dynamik = toDecimal(input.dynamik);

  // Median monthly factor exp(mu): ((1 + r)(1 - TER))^(1/12).
  const markt = (rendite: Percent, volatilitaet: Percent) => {
    const mu = (Math.log(1 + toDecimal(rendite)) + Math.log(1 - toDecimal(input.kosten))) / 12;
    const sigmaMonat = toDecimal(volatilitaet) / Math.sqrt(12);
    return { mu, sigmaMonat, festerZins: Math.exp(mu) - 1 };
  };
  const marktAnspar = markt(input.rendite, input.volatilitaet);
  const marktEntnahme = markt(
    input.entnahmeRendite ?? input.rendite,
    input.entnahmeVolatilitaet ?? input.volatilitaet,
  );
  const zufaellig = marktAnspar.sigmaMonat > 0 || marktEntnahme.sigmaMonat > 0;

  const uniform = createRng(input.seed);
  // Per-path monthly growth factor minus one, drawn for all paths at once.
  const zinsen = new Float64Array(n);

  const saldo = new Float64Array(n).fill(input.startkapital);
  // Month (counted from the start of the Entnahmephase) a path ran dry; -1 = never.
  const erschoepft = new Int32Array(n).fill(-1);

  // Per-path records for looking at a single path afterwards.
  const stride = gesamtJahre + 1;
  const salden = new Float64Array(n * stride);
  const jahresRenditen = new Float64Array(n * gesamtJahre);
  const maxDrawdown = new Float64Array(n);
  const drawdownTief = new Int32Array(n).fill(-1);
  // The fund's price, starting at 1, its running high, and this year's growth.
  const kurs = new Float64Array(n).fill(1);
  const hoch = new Float64Array(n).fill(1);
  const jahresFaktor = new Float64Array(n);

  const jahre: MonteCarloJahr[] = [];
  let eingezahlt = input.startkapital;
  let sparrate = input.sparrate;
  let entnahme = roundHalfAwayFromZero(
    input.entnahme * Math.pow(1 + inflation, ansparJahre),
  );
  const ersteEntnahme = entnahme;

  const snapshot = (jahr: number, phase: MonteCarloJahr["phase"]) => {
    let lebend = 0;
    for (let i = 0; i < n; i++) if (saldo[i] > 0) lebend++;
    for (let i = 0; i < n; i++) salden[i * stride + jahr] = saldo[i];
    jahre.push({
      jahr,
      phase,
      perzentile: perzentileVon(saldo),
      deflator: Math.pow(1 + inflation, jahr),
      eingezahlt,
      nochKapital: lebend / n,
    });
  };

  snapshot(0, ansparJahre > 0 ? "anspar" : "entnahme");

  let ansparEnde: MonteCarloResult["ansparEnde"] | null = null;
  const schliesseAnsparphase = (): MonteCarloResult["ansparEnde"] => {
    let summe = 0;
    let ziel = 0;
    let verlust = 0;
    for (let i = 0; i < n; i++) {
      summe += saldo[i];
      if (input.zielkapital > 0 && saldo[i] >= input.zielkapital) ziel++;
      if (saldo[i] < eingezahlt) verlust++;
    }
    return {
      perzentile: perzentileVon(saldo),
      mittelwert: roundHalfAwayFromZero(summe / n),
      eingezahlt,
      deflator: Math.pow(1 + inflation, ansparJahre),
      zielQuote: input.zielkapital > 0 ? ziel / n : null,
      verlustQuote: verlust / n,
    };
  };
  if (ansparJahre === 0) ansparEnde = schliesseAnsparphase();

  for (let jahr = 1; jahr <= gesamtJahre; jahr++) {
    const anspar = jahr <= ansparJahre;
    const entnahmeJahr = jahr - ansparJahre - 1; // 0-based within the phase
    const { mu, sigmaMonat, festerZins } = anspar ? marktAnspar : marktEntnahme;
    jahresFaktor.fill(1);

    for (let m = 0; m < 12; m++) {
      const monat = (jahr - 1) * 12 + m + 1;
      // Drawn for every path every month, even an empty one, so a path's
      // randomness does not depend on what happened to the others — and drawn
      // the same way in both phases, so changing the retirement mix changes
      // only what the same shocks do, not which shocks a path gets.
      if (!zufaellig) {
        zinsen.fill(festerZins);
      } else {
        fillNormal(zinsen, uniform);
        for (let i = 0; i < n; i++) zinsen[i] = Math.exp(mu + sigmaMonat * zinsen[i]) - 1;
      }
      for (let i = 0; i < n; i++) {
        // The fund keeps moving whether or not this path still holds any of it.
        const faktor = 1 + zinsen[i];
        jahresFaktor[i] *= faktor;
        const k = kurs[i] * faktor;
        kurs[i] = k;
        if (k > hoch[i]) {
          hoch[i] = k;
        } else {
          const fall = 1 - k / hoch[i];
          if (fall > maxDrawdown[i]) {
            maxDrawdown[i] = fall;
            drawdownTief[i] = monat;
          }
        }

        let s = saldo[i];
        if (s <= 0 && !anspar) continue;
        s += applyRate(s, zinsen[i]);
        if (anspar) {
          s += sparrate;
        } else {
          const auszahlung = Math.min(entnahme, s);
          s -= auszahlung;
          if (s <= 0) {
            s = 0;
            if (erschoepft[i] === -1) erschoepft[i] = entnahmeJahr * 12 + m + 1;
          }
        }
        saldo[i] = s;
      }
      if (anspar) eingezahlt += sparrate;
    }

    for (let i = 0; i < n; i++) {
      jahresRenditen[i * gesamtJahre + jahr - 1] = jahresFaktor[i] - 1;
    }
    snapshot(jahr, anspar ? "anspar" : "entnahme");

    if (anspar) {
      sparrate = roundHalfAwayFromZero(sparrate * (1 + dynamik));
      if (jahr === ansparJahre) ansparEnde = schliesseAnsparphase();
    } else {
      entnahme = roundHalfAwayFromZero(entnahme * (1 + inflation));
    }
  }

  let entnahmeErgebnis: MonteCarloResult["entnahme"] = null;
  if (mitEntnahme) {
    const monate: number[] = [];
    for (let i = 0; i < n; i++) if (erschoepft[i] !== -1) monate.push(erschoepft[i]);
    monate.sort((a, b) => a - b);
    // The path at the 10 % rank, counting never-empty paths as lasting forever.
    const rang = Math.ceil(n * 0.1) - 1;
    entnahmeErgebnis = {
      ersteEntnahme,
      erfolgsQuote: 1 - monate.length / n,
      erschoepftP10Jahre: rang < monate.length ? monate[rang] / 12 : null,
      erschoepftMedianJahre:
        monate.length === 0 ? null : monate[Math.floor((monate.length - 1) / 2)] / 12,
    };
  }

  const leerAb = (i: number) => (erschoepft[i] === -1 ? Infinity : erschoepft[i]);
  const rangfolge = new Int32Array(n);
  for (let i = 0; i < n; i++) rangfolge[i] = i;
  rangfolge.sort(
    (a, b) => saldo[a] - saldo[b] || leerAb(a) - leerAb(b) || a - b,
  );

  // Set at the end of the last Anspar year, or before the loop without one.
  if (ansparEnde === null) throw new Error("Ansparphase nicht abgeschlossen");
  return {
    jahre,
    pfade: {
      anzahl: n,
      jahre: gesamtJahre,
      salden,
      jahresRenditen,
      maxDrawdown,
      drawdownTief,
      erschoepft,
      rangfolge,
    },
    ansparEnde,
    entnahme: entnahmeErgebnis,
  };
}

/** The path at percentile `p` (0..100) of the outcome ranking. */
export function pfadAmPerzentil(pfade: MonteCarloPfade, p: number): number {
  const rang = Math.round((Math.min(Math.max(p, 0), 100) / 100) * (pfade.anzahl - 1));
  return pfade.rangfolge[rang];
}

export interface PfadDetail {
  pfad: number;
  /** Nominal year-end capital, index 0 = today. */
  salden: Money[];
  /** The fund's return per year, index 0 = year 1. */
  renditen: number[];
  /** Geometric average of those returns. */
  renditeProJahr: number;
  besteJahr: { jahr: number; rendite: number } | null;
  schlechtesteJahr: { jahr: number; rendite: number } | null;
  maxDrawdown: number;
  /** Year in which the deepest fall bottomed out; null without one. */
  drawdownTiefJahr: number | null;
  /** Years into the Entnahmephase until empty; null if it never ran dry. */
  leerNachJahren: number | null;
}

/** Everything about one path, unpacked from the flat arrays. */
export function pfadDetail(pfade: MonteCarloPfade, pfad: number): PfadDetail {
  const stride = pfade.jahre + 1;
  const salden = Array.from(pfade.salden.subarray(pfad * stride, (pfad + 1) * stride));
  const renditen = Array.from(
    pfade.jahresRenditen.subarray(pfad * pfade.jahre, (pfad + 1) * pfade.jahre),
  );

  let beste: PfadDetail["besteJahr"] = null;
  let schlechteste: PfadDetail["schlechtesteJahr"] = null;
  let produkt = 1;
  renditen.forEach((rendite, index) => {
    produkt *= 1 + rendite;
    if (beste === null || rendite > beste.rendite) beste = { jahr: index + 1, rendite };
    if (schlechteste === null || rendite < schlechteste.rendite) {
      schlechteste = { jahr: index + 1, rendite };
    }
  });

  const tief = pfade.drawdownTief[pfad];
  const leer = pfade.erschoepft[pfad];
  return {
    pfad,
    salden,
    renditen,
    renditeProJahr: renditen.length === 0 ? 0 : Math.pow(produkt, 1 / renditen.length) - 1,
    besteJahr: beste,
    schlechtesteJahr: schlechteste,
    maxDrawdown: pfade.maxDrawdown[pfad],
    drawdownTiefJahr: tief === -1 ? null : Math.ceil(tief / 12),
    leerNachJahren: leer === -1 ? null : leer / 12,
  };
}

export interface HistogrammKlasse {
  /** Lower and upper edge in display units (euros after `teiler`). */
  von: number;
  bis: number;
  anzahl: number;
  /** Positions in `rangfolge` covered by this class, inclusive. */
  rangVon: number;
  rangBis: number;
  /** The first and last class also hold everything beyond them. */
  offenUnten: boolean;
  offenOben: boolean;
}

export interface Histogramm {
  klassen: HistogrammKlasse[];
  /** Paths that ran dry; they precede every class in the ranking. */
  leer: number;
}

/** 1, 2, 2.5 or 5 times a power of ten — widths a reader can add up. */
function glatt(wert: number): number {
  if (wert <= 0) return 1;
  const potenz = Math.pow(10, Math.floor(Math.log10(wert)));
  const rest = wert / potenz;
  const stufe = rest <= 1 ? 1 : rest <= 2 ? 2 : rest <= 2.5 ? 2.5 : rest <= 5 ? 5 : 10;
  return stufe * potenz;
}

/**
 * Distribution of the capital at the end of the horizon, in classes of a round
 * width. The outer half percent on either side is folded into the first and
 * last class: the right tail of a lognormal runs on for a long way, and drawn
 * to scale it would squash everything else into a few bars.
 *
 * `teiler` converts nominal cents into what is displayed — 100 for nominal
 * euros, 100 × deflator for today's purchasing power — so the class edges are
 * round in the unit the reader sees.
 */
export function histogramm(
  pfade: MonteCarloPfade,
  teiler: number,
  zielKlassen = 30,
): Histogramm {
  const stride = pfade.jahre + 1;
  const n = pfade.anzahl;
  const wert = (rang: number) =>
    pfade.salden[pfade.rangfolge[rang] * stride + pfade.jahre] / teiler;

  let leer = 0;
  while (leer < n && pfade.erschoepft[pfade.rangfolge[leer]] !== -1) leer++;
  const rest = n - leer;
  if (rest === 0) return { klassen: [], leer };

  const quantilRang = (q: number) => leer + Math.round(q * (rest - 1));
  const lo = wert(quantilRang(0.005));
  const hi = wert(quantilRang(0.995));
  const breite = glatt((hi - lo) / zielKlassen || Math.max(hi, 1) / zielKlassen);
  const start = Math.floor(lo / breite) * breite;
  const anzahlKlassen = Math.max(1, Math.ceil((hi - start) / breite + 1e-9));

  const klassen: HistogrammKlasse[] = Array.from({ length: anzahlKlassen }, (_, k) => ({
    von: start + k * breite,
    bis: start + (k + 1) * breite,
    anzahl: 0,
    rangVon: -1,
    rangBis: -1,
    offenUnten: k === 0 && wert(leer) < start,
    offenOben: k === anzahlKlassen - 1 && wert(n - 1) >= start + anzahlKlassen * breite,
  }));

  for (let rang = leer; rang < n; rang++) {
    const k = Math.min(
      Math.max(Math.floor((wert(rang) - start) / breite), 0),
      anzahlKlassen - 1,
    );
    const klasse = klassen[k];
    klasse.anzahl++;
    if (klasse.rangVon === -1) klasse.rangVon = rang;
    klasse.rangBis = rang;
  }
  return { klassen, leer };
}
