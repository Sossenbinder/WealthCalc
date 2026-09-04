import { applyRate, roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";

/**
 * The FIRE ladder, lowest rung first.
 *
 * Each rung is a separate condition on today's portfolio, not a threshold on
 * one scale — Barista can need more capital than Lean when the side income is
 * small — so a reader can stand on several at once. The order here is how much
 * freedom each represents, which is what "which stage am I on" asks about:
 *
 *   coast    — stop saving; growth alone reaches the FIRE number by Ruhestand.
 *   barista  — a part-time income plus withdrawals cover the expenses now.
 *   lean     — withdrawals alone cover a minimal budget.
 *   fire     — withdrawals alone cover the budget you actually want.
 *   fat      — withdrawals alone cover a comfortable budget.
 */
export const STUFEN = ["coast", "barista", "lean", "fire", "fat"] as const;
export type FireStufe = (typeof STUFEN)[number];

export interface FireInput {
  /** Invested, withdrawable capital today. */
  vermoegen: Money;
  /** Saved every month from now on. */
  sparrate: Money;
  /** Real return per year, i.e. after inflation, e.g. 5 for 5 %. */
  rendite: Percent;
  /** Safe withdrawal rate, e.g. 3.5 for 3,5 %. */
  entnahmerate: Percent;
  alter: number;
  /** The age Coast FIRE aims at: growth alone must reach the FIRE number by then. */
  ruhestandsalter: number;
  /** Part-time income per year that Barista FIRE counts on. */
  nebeneinkommen: Money;
  /** Yearly expenses for Lean, FIRE and Fat respectively. */
  ausgabenMinimum: Money;
  ausgabenWunsch: Money;
  ausgabenKomfort: Money;
}

export interface StufenErgebnis {
  stufe: FireStufe;
  /** Capital the rung needs today. */
  bedarf: Money;
  /** vermoegen / bedarf — above 1 once reached. Infinity when nothing is needed. */
  fortschritt: number;
  erreicht: boolean;
  /** Months of saving until the rung is reached; 0 when it already is. */
  monateBis: number | null;
  /** Age at which it is reached, whole years. */
  erreichtMitAlter: number | null;
}

export interface FireResult {
  /** The highest rung reached today, or null on none. */
  stufe: FireStufe | null;
  stufen: StufenErgebnis[];
  fireBedarf: Money;
  /** What today's capital alone grows to by Ruhestandsalter. */
  vermoegenMitRuhestand: Money;
  monatsrate: number;
}

/** Nobody plans past this; the search for "when" stops here. */
export const MAX_ALTER = 100;

/**
 * Which FIRE rungs today's capital reaches, and when the rest follow.
 *
 * Everything is in real terms: the return is after inflation, so a FIRE number
 * of 1.028.571 € means that purchasing power, and the expenses need no
 * indexing. The compounding follows the Sparplanrechner exactly — effective
 * annual return, monthly rate `(1 + r)^(1/12) - 1`, interest rounded to cents
 * each month, contribution at the end of the month — so a reader who checks
 * one against the other gets the same balance.
 *
 * Coast is the odd rung out: its number moves. Every month closer to
 * Ruhestand leaves one month less of growth, so the capital that has to be in
 * place rises towards the full FIRE number and meets it on the day. The
 * projection therefore compares each month's balance against that month's
 * coast number rather than against a fixed line.
 *
 * Returns null when the withdrawal rate is zero: no capital covers any expense
 * at all, and every number would be infinite.
 */
export function berechneFire(input: FireInput): FireResult | null {
  const swr = toDecimal(input.entnahmerate);
  if (swr <= 0) return null;

  const jahresrate = toDecimal(input.rendite);
  const monatsrate = Math.pow(1 + jahresrate, 1 / 12) - 1;

  const bedarfFuer = (ausgaben: Money, einkommen: Money = 0): Money =>
    roundHalfAwayFromZero(Math.max(ausgaben - einkommen, 0) / swr);

  const fireBedarf = bedarfFuer(input.ausgabenWunsch);
  const feste: Record<Exclude<FireStufe, "coast">, Money> = {
    barista: bedarfFuer(input.ausgabenWunsch, input.nebeneinkommen),
    lean: bedarfFuer(input.ausgabenMinimum),
    fire: fireBedarf,
    fat: bedarfFuer(input.ausgabenKomfort),
  };

  const jahreBisRuhestand = Math.max(input.ruhestandsalter - input.alter, 0);
  const coastBedarf = (jahreVerbleibend: number): Money =>
    roundHalfAwayFromZero(
      fireBedarf / Math.pow(1 + jahresrate, Math.max(jahreVerbleibend, 0)),
    );

  const vermoegenMitRuhestand = roundHalfAwayFromZero(
    input.vermoegen * Math.pow(1 + jahresrate, jahreBisRuhestand),
  );

  // First month at which each rung holds. Month 0 is today, before any
  // saving, so a rung that already holds reports 0.
  const monateBis = new Map<FireStufe, number>();
  const bedarfHeute = (stufe: FireStufe, monat: number): Money =>
    stufe === "coast"
      ? coastBedarf(jahreBisRuhestand - monat / 12)
      : feste[stufe];

  const maxMonate = Math.max(MAX_ALTER - input.alter, 0) * 12;
  let saldo = input.vermoegen;
  for (let monat = 0; monat <= maxMonate; monat++) {
    for (const stufe of STUFEN) {
      if (!monateBis.has(stufe) && saldo >= bedarfHeute(stufe, monat)) {
        monateBis.set(stufe, monat);
      }
    }
    if (monateBis.size === STUFEN.length) break;
    saldo += applyRate(saldo, monatsrate) + input.sparrate;
  }

  const stufen: StufenErgebnis[] = STUFEN.map((stufe) => {
    const bedarf = bedarfHeute(stufe, 0);
    const monate = monateBis.get(stufe) ?? null;
    return {
      stufe,
      bedarf,
      fortschritt: bedarf === 0 ? Infinity : input.vermoegen / bedarf,
      erreicht: monate === 0,
      monateBis: monate,
      erreichtMitAlter:
        monate === null ? null : Math.floor(input.alter + monate / 12),
    };
  });

  const erreichte = stufen.filter((s) => s.erreicht).map((s) => s.stufe);
  const stufe = erreichte.length === 0 ? null : erreichte[erreichte.length - 1];

  return { stufe, stufen, fireBedarf, vermoegenMitRuhestand, monatsrate };
}
