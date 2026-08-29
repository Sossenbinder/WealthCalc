import { applyRate, roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";

export interface EntnahmeInput {
  startkapital: Money;
  /** Withdrawal in the first month; rises each year with inflation. */
  monatlicheEntnahme: Money;
  /** Effective return per year on what is still invested. */
  rendite: Percent;
  /** Raises the withdrawal each year, so purchasing power stays level. */
  inflation: Percent;
  /** Horizon to report on. */
  jahre: number;
}

export interface EntnahmeJahr {
  jahr: number;
  startkapital: Money;
  entnahmen: Money;
  rendite: Money;
  endkapital: Money;
  /** The monthly withdrawal paid in this year, after inflation. */
  monatlicheEntnahme: Money;
}

export interface EntnahmeResult {
  jahre: EntnahmeJahr[];
  /** Month the capital ran out, or null if it lasted the whole horizon. */
  erschoepftNachMonaten: number | null;
  endkapital: Money;
  gesamtEntnommen: Money;
}

const MAX_JAHRE = 80;

/**
 * Draw a monthly income from invested capital.
 *
 * Return is credited monthly on what is left, the withdrawal is taken after
 * it, and the withdrawal itself is raised once a year by inflation so the
 * income keeps its purchasing power. The capital is never allowed to go
 * negative: the month it cannot cover a full withdrawal is the month it runs
 * out, and what remains is paid out then.
 */
export function berechneEntnahmeplan(input: EntnahmeInput): EntnahmeResult {
  const monatsrendite = Math.pow(1 + toDecimal(input.rendite), 1 / 12) - 1;
  const inflationsrate = toDecimal(input.inflation);

  const jahre: EntnahmeJahr[] = [];
  let kapital = input.startkapital;
  let entnahme = input.monatlicheEntnahme;
  let gesamtEntnommen = 0;
  let erschoepftNachMonaten: number | null = null;
  let monat = 0;

  for (let jahr = 1; jahr <= Math.min(input.jahre, MAX_JAHRE); jahr += 1) {
    const startkapital = kapital;
    let entnahmenImJahr = 0;
    let renditeImJahr = 0;

    for (let m = 0; m < 12; m += 1) {
      if (kapital <= 0) break;
      const ertrag = applyRate(kapital, monatsrendite);
      kapital += ertrag;
      renditeImJahr += ertrag;

      const auszahlung = Math.min(entnahme, kapital);
      kapital -= auszahlung;
      entnahmenImJahr += auszahlung;
      gesamtEntnommen += auszahlung;
      monat += 1;

      if (kapital <= 0 && erschoepftNachMonaten === null) {
        erschoepftNachMonaten = monat;
      }
    }

    jahre.push({
      jahr,
      startkapital,
      entnahmen: entnahmenImJahr,
      rendite: renditeImJahr,
      endkapital: kapital,
      monatlicheEntnahme: entnahme,
    });

    entnahme = roundHalfAwayFromZero(entnahme * (1 + inflationsrate));
  }

  return {
    jahre,
    erschoepftNachMonaten,
    endkapital: kapital,
    gesamtEntnommen,
  };
}

/**
 * Largest first-month withdrawal the capital can sustain for the full horizon.
 *
 * Binary-searched against the real projection rather than a formula, so the
 * answer is consistent with the table shown beside it — the inflation uplift
 * and the per-cent rounding have no closed form.
 */
export function solveEntnahme(
  input: Omit<EntnahmeInput, "monatlicheEntnahme">,
): Money {
  const haelt = (monatlicheEntnahme: Money) =>
    berechneEntnahmeplan({ ...input, monatlicheEntnahme })
      .erschoepftNachMonaten === null;

  let low = 0;
  let high = Math.max(input.startkapital, 1);
  // Highest value that still lasts; the search narrows onto the boundary.
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (haelt(mid)) low = mid;
    else high = mid - 1;
  }
  return low;
}
