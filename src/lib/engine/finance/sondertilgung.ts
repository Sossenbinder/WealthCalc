import { roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";

export interface SondertilgungInput {
  darlehensbetrag: Money;
  sollzins: Percent;
  anfaenglicheTilgung: Percent;
  /** Extra repayment made once a year, at the end of the year. */
  sondertilgungProJahr: Money;
}

export interface TilgungsVerlauf {
  laufzeitMonate: number;
  gesamtzinsen: Money;
  /** Debt outstanding at the end of each year. */
  restschuldProJahr: Money[];
}

export interface SondertilgungResult {
  monatsrate: Money;
  ohne: TilgungsVerlauf;
  mit: TilgungsVerlauf;
  zinsersparnis: Money;
  /** Months the loan is repaid earlier. */
  zeitersparnisMonate: number;
  /** Everything paid in extra over the years. */
  eingesetzteSondertilgung: Money;
  /** Interest saved per euro of extra repayment. */
  ersparnisJeEuro: number;
  tilgtNie: boolean;
}

const MAX_MONATE = 70 * 12;

function simuliere(
  darlehen: Money,
  monatsrate: Money,
  monatszins: number,
  sondertilgung: Money,
): TilgungsVerlauf {
  let restschuld = darlehen;
  let gesamtzinsen = 0;
  let monate = 0;
  const restschuldProJahr: Money[] = [];

  while (restschuld > 0 && monate < MAX_MONATE) {
    for (let m = 0; m < 12 && restschuld > 0; m += 1) {
      const zinsen = roundHalfAwayFromZero(restschuld * monatszins);
      const tilgung = Math.min(monatsrate - zinsen, restschuld);
      restschuld -= tilgung;
      gesamtzinsen += zinsen;
      monate += 1;
    }
    // The extra payment lands at year end, once the twelve instalments are made.
    if (restschuld > 0 && sondertilgung > 0) {
      restschuld = Math.max(restschuld - sondertilgung, 0);
    }
    restschuldProJahr.push(restschuld);
  }

  return { laufzeitMonate: monate, gesamtzinsen, restschuldProJahr };
}

/**
 * What an annual extra repayment is worth.
 *
 * The instalment stays where the contract set it; the extra payment goes
 * straight against the principal, so every euro of it stops paying interest
 * for the whole remaining term. That is why the saving is far larger than the
 * amount paid in — and why the comparison has to run both scenarios rather
 * than reason about the difference.
 */
export function berechneSondertilgung(
  input: SondertilgungInput,
): SondertilgungResult {
  const jahresrate = roundHalfAwayFromZero(
    input.darlehensbetrag *
      (toDecimal(input.sollzins) + toDecimal(input.anfaenglicheTilgung)),
  );
  const monatsrate = roundHalfAwayFromZero(jahresrate / 12);
  const monatszins = toDecimal(input.sollzins) / 12;

  const ersteZinsen = roundHalfAwayFromZero(input.darlehensbetrag * monatszins);
  if (monatsrate <= ersteZinsen) {
    const leer = { laufzeitMonate: 0, gesamtzinsen: 0, restschuldProJahr: [] };
    return {
      monatsrate,
      ohne: leer,
      mit: leer,
      zinsersparnis: 0,
      zeitersparnisMonate: 0,
      eingesetzteSondertilgung: 0,
      ersparnisJeEuro: 0,
      tilgtNie: true,
    };
  }

  const ohne = simuliere(input.darlehensbetrag, monatsrate, monatszins, 0);
  const mit = simuliere(
    input.darlehensbetrag,
    monatsrate,
    monatszins,
    input.sondertilgungProJahr,
  );

  // Only the years that actually saw a payment count.
  const jahreMitZahlung = Math.max(mit.restschuldProJahr.length - 1, 0);
  const eingesetzteSondertilgung =
    input.sondertilgungProJahr * jahreMitZahlung;
  const zinsersparnis = ohne.gesamtzinsen - mit.gesamtzinsen;

  return {
    monatsrate,
    ohne,
    mit,
    zinsersparnis,
    zeitersparnisMonate: ohne.laufzeitMonate - mit.laufzeitMonate,
    eingesetzteSondertilgung,
    ersparnisJeEuro:
      eingesetzteSondertilgung > 0
        ? zinsersparnis / eingesetzteSondertilgung
        : 0,
    tilgtNie: false,
  };
}
