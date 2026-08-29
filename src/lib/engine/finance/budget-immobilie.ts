import { applyRate, roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";
import { berechneAnnuitaetendarlehen, TILGT_NIE } from "./annuitaet";

export interface BudgetInput {
  /** What the household can pay every month. */
  monatsrate: Money;
  eigenkapital: Money;
  sollzins: Percent;
  anfaenglicheTilgung: Percent;
  /** Grunderwerbsteuer of the Bundesland. */
  grunderwerbsteuer: Percent;
  notarUndGrundbuch: Percent;
  maklerprovision: Percent;
}

export interface BudgetResult {
  /** The most the property may cost. */
  maxKaufpreis: Money;
  darlehen: Money;
  nebenkosten: Money;
  nebenkostenAnteil: number;
  /** Equity left over as a deposit once the fees are paid. */
  eigenkapitalFuerKaufpreis: Money;
  laufzeitMonate: number;
  gesamtzinsen: Money;
  /** True when the fees swallow the whole deposit. */
  eigenkapitalReichtNicht: boolean;
}

/**
 * How much property a monthly budget can carry.
 *
 * Runs the financing backwards: the instalment fixes the loan, since the
 * German convention sets it as the loan times Sollzins plus Tilgung. The catch
 * is that the purchase costs cannot be borrowed — they come off the deposit
 * first — so the affordable price is not deposit plus loan but rather what is
 * left after the fees have taken their share of both.
 */
export function berechneImmobilienBudget(
  input: BudgetInput,
): BudgetResult | typeof TILGT_NIE {
  const jahresrate = input.monatsrate * 12;
  const satz =
    toDecimal(input.sollzins) + toDecimal(input.anfaenglicheTilgung);
  if (satz <= 0) return TILGT_NIE;

  const darlehen = roundHalfAwayFromZero(jahresrate / satz);
  const nebenkostenSatz =
    toDecimal(input.grunderwerbsteuer) +
    toDecimal(input.notarUndGrundbuch) +
    toDecimal(input.maklerprovision);

  // Kaufpreis · (1 + nk) = Darlehen + Eigenkapital
  const maxKaufpreis = roundHalfAwayFromZero(
    (darlehen + input.eigenkapital) / (1 + nebenkostenSatz),
  );
  const nebenkosten = applyRate(maxKaufpreis, nebenkostenSatz);
  const eigenkapitalFuerKaufpreis = input.eigenkapital - nebenkosten;

  const kredit = berechneAnnuitaetendarlehen({
    darlehensbetrag: darlehen,
    sollzins: input.sollzins,
    anfaenglicheTilgung: input.anfaenglicheTilgung,
    zinsbindungJahre: 0,
  });
  if (kredit === TILGT_NIE) return TILGT_NIE;

  return {
    maxKaufpreis: Math.max(maxKaufpreis, 0),
    darlehen,
    nebenkosten,
    nebenkostenAnteil: nebenkostenSatz * 100,
    eigenkapitalFuerKaufpreis,
    laufzeitMonate: kredit.laufzeitMonate,
    gesamtzinsen: kredit.gesamtzinsen,
    eigenkapitalReichtNicht: eigenkapitalFuerKaufpreis < 0,
  };
}
