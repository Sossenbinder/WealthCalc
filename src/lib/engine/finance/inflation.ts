import { roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";

export interface InflationInput {
  betrag: Money;
  inflation: Percent;
  jahre: number;
}

export interface InflationJahr {
  jahr: number;
  /** What today's amount will still buy, expressed in today's money. */
  kaufkraft: Money;
  /** Nominal amount needed then to buy what the amount buys today. */
  benoetigt: Money;
}

export interface InflationResult {
  jahre: InflationJahr[];
  kaufkraftAmEnde: Money;
  benoetigtAmEnde: Money;
  kaufkraftverlust: Money;
  /** Share of purchasing power lost over the period. */
  verlustProzent: number;
  /** Years until the amount is worth half of what it is today. */
  halbwertszeit: number | null;
}

/**
 * What inflation does to a fixed sum, in both directions.
 *
 * The two are not the same number and are routinely confused: money losing a
 * fifth of its purchasing power is not the same as needing a fifth more to
 * keep up. At 2 % over 20 years, 10.000 € is worth 6.730 € but you would need
 * 14.859 € to buy what it buys today.
 */
export function berechneInflation(input: InflationInput): InflationResult {
  const rate = toDecimal(input.inflation);
  const jahre: InflationJahr[] = [];

  for (let jahr = 1; jahr <= input.jahre; jahr += 1) {
    const faktor = Math.pow(1 + rate, jahr);
    jahre.push({
      jahr,
      kaufkraft: roundHalfAwayFromZero(input.betrag / faktor),
      benoetigt: roundHalfAwayFromZero(input.betrag * faktor),
    });
  }

  const letzte = jahre[jahre.length - 1];
  const kaufkraftAmEnde = letzte?.kaufkraft ?? input.betrag;
  const kaufkraftverlust = input.betrag - kaufkraftAmEnde;

  // Only meaningful while prices actually rise.
  const halbwertszeit =
    rate > 0 ? Math.log(2) / Math.log(1 + rate) : null;

  return {
    jahre,
    kaufkraftAmEnde,
    benoetigtAmEnde: letzte?.benoetigt ?? input.betrag,
    kaufkraftverlust,
    verlustProzent:
      input.betrag > 0 ? (kaufkraftverlust / input.betrag) * 100 : 0,
    halbwertszeit,
  };
}
