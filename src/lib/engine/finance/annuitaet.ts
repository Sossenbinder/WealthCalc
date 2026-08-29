import { roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";

export interface DarlehenInput {
  darlehensbetrag: Money;
  /** Nominal interest per year (Sollzins). */
  sollzins: Percent;
  /** Initial repayment rate per year (anfängliche Tilgung). */
  anfaenglicheTilgung: Percent;
  /** Years the rate is fixed for; 0 means no Zinsbindung is shown. */
  zinsbindungJahre: number;
}

export interface TilgungsplanJahr {
  jahr: number;
  zinsen: Money;
  tilgung: Money;
  /** Debt outstanding at the end of the year. */
  restschuld: Money;
}

export interface DarlehenResult {
  monatsrate: Money;
  jahre: TilgungsplanJahr[];
  /** Whole months until the loan is repaid. */
  laufzeitMonate: number;
  gesamtzinsen: Money;
  gesamtzahlung: Money;
  /** Debt still outstanding when the Zinsbindung ends, if one was given. */
  restschuldBeiZinsbindung: Money | null;
  /** Effective annual rate from monthly compounding of the nominal rate. */
  effektivzins: number;
}

/** A loan whose instalment never exceeds the first month's interest. */
export const TILGT_NIE = "tilgt-nie";

const MAX_MONATE = 70 * 12;

/**
 * Annuitätendarlehen: a constant monthly instalment, of which the interest
 * share falls and the repayment share rises as the debt shrinks.
 *
 * The instalment follows the German convention — annual annuity is the loan
 * times (Sollzins + anfängliche Tilgung), paid in twelve equal parts. Interest
 * accrues monthly on the outstanding debt and is rounded to the cent each
 * month, as a bank statement does; the final instalment is trimmed to the debt
 * that is actually left rather than overpaying it.
 *
 * Returns `TILGT_NIE` when the instalment cannot cover even the first month's
 * interest, since the debt would then grow forever.
 */
export function berechneAnnuitaetendarlehen(
  input: DarlehenInput,
): DarlehenResult | typeof TILGT_NIE {
  const { darlehensbetrag, sollzins, anfaenglicheTilgung, zinsbindungJahre } =
    input;

  const jahresrate = roundHalfAwayFromZero(
    darlehensbetrag * (toDecimal(sollzins) + toDecimal(anfaenglicheTilgung)),
  );
  const monatsrate = roundHalfAwayFromZero(jahresrate / 12);
  const monatszins = toDecimal(sollzins) / 12;

  const ersteZinsen = roundHalfAwayFromZero(darlehensbetrag * monatszins);
  if (monatsrate <= ersteZinsen) return TILGT_NIE;

  const jahre: TilgungsplanJahr[] = [];
  let restschuld = darlehensbetrag;
  let gesamtzinsen = 0;
  let laufzeitMonate = 0;
  let restschuldBeiZinsbindung: Money | null = null;

  for (let jahr = 1; restschuld > 0 && laufzeitMonate < MAX_MONATE; jahr += 1) {
    let zinsenImJahr = 0;
    let tilgungImJahr = 0;

    for (let monat = 0; monat < 12 && restschuld > 0; monat += 1) {
      const zinsen = roundHalfAwayFromZero(restschuld * monatszins);
      // The last instalment only has to clear what is left.
      const tilgung = Math.min(monatsrate - zinsen, restschuld);
      restschuld -= tilgung;
      zinsenImJahr += zinsen;
      tilgungImJahr += tilgung;
      gesamtzinsen += zinsen;
      laufzeitMonate += 1;

      if (laufzeitMonate === zinsbindungJahre * 12) {
        restschuldBeiZinsbindung = restschuld;
      }
    }

    jahre.push({ jahr, zinsen: zinsenImJahr, tilgung: tilgungImJahr, restschuld });
  }

  return {
    monatsrate,
    jahre,
    laufzeitMonate,
    gesamtzinsen,
    gesamtzahlung: darlehensbetrag + gesamtzinsen,
    restschuldBeiZinsbindung,
    effektivzins: (Math.pow(1 + monatszins, 12) - 1) * 100,
  };
}

/**
 * Monthly instalment for a loan repaid over a fixed number of months.
 *
 * The other entry point in this file starts from an initial repayment rate,
 * which is how German mortgages are quoted. Consumer and car loans instead fix
 * the term, so the instalment follows from it: P·i / (1 − (1+i)^−n), with the
 * zero-interest case falling back to simple division.
 */
export function annuitaetFuerLaufzeit(
  darlehen: Money,
  sollzins: Percent,
  monate: number,
): Money {
  if (monate <= 0) return 0;
  const i = toDecimal(sollzins) / 12;
  if (i === 0) return roundHalfAwayFromZero(darlehen / monate);
  return roundHalfAwayFromZero(
    (darlehen * i) / (1 - Math.pow(1 + i, -monate)),
  );
}
