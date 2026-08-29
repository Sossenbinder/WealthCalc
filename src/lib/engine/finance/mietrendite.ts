import { applyRate, roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";
import { berechneAnnuitaetendarlehen, TILGT_NIE } from "./annuitaet";

export interface MietrenditeInput {
  kaufpreis: Money;
  /** Grunderwerbsteuer, Notar, Makler — see the Kaufnebenkosten-Rechner. */
  kaufnebenkosten: Percent;
  kaltmieteMonat: Money;
  /** Property management, which a landlord cannot pass on to the tenant. */
  verwaltungMonat: Money;
  /** Yearly maintenance reserve, as a share of the purchase price. */
  instandhaltung: Percent;
  /** Allowance for vacancy and unpaid rent, as a share of the rent. */
  mietausfallwagnis: Percent;
  eigenkapital: Money;
  sollzins: Percent;
  anfaenglicheTilgung: Percent;
}

export interface MietrenditeResult {
  nebenkosten: Money;
  gesamtinvestition: Money;
  jahreskaltmiete: Money;
  /** Rent against the purchase price alone — the figure listings quote. */
  bruttomietrendite: number;
  /** Rent less costs, against everything actually invested. */
  nettomietrendite: number;
  /** Purchase price as a multiple of the yearly rent. */
  kaufpreisfaktor: number;
  nichtUmlagefaehigMonat: Money;
  darlehen: Money;
  monatsrate: Money;
  /** What is left each month once costs and the instalment are paid. */
  cashflowMonat: Money;
  /** True when the loan's instalment can never repay it. */
  nichtFinanzierbar: boolean;
}

/**
 * Yield and cash flow on a rented property.
 *
 * Two yields, because the one in listings is not the one that matters: the
 * gross figure divides rent by the asking price, ignoring both the purchase
 * costs and every expense a landlord cannot pass on. The net figure divides
 * rent-less-costs by everything actually invested, and is typically a third
 * lower.
 */
export function berechneMietrendite(
  input: MietrenditeInput,
): MietrenditeResult {
  const nebenkosten = applyRate(input.kaufpreis, toDecimal(input.kaufnebenkosten));
  const gesamtinvestition = input.kaufpreis + nebenkosten;
  const jahreskaltmiete = input.kaltmieteMonat * 12;

  const instandhaltungMonat = roundHalfAwayFromZero(
    applyRate(input.kaufpreis, toDecimal(input.instandhaltung)) / 12,
  );
  const ausfallMonat = applyRate(
    input.kaltmieteMonat,
    toDecimal(input.mietausfallwagnis),
  );
  const nichtUmlagefaehigMonat =
    input.verwaltungMonat + instandhaltungMonat + ausfallMonat;

  const darlehen = Math.max(gesamtinvestition - input.eigenkapital, 0);
  let monatsrate = 0;
  let nichtFinanzierbar = false;
  if (darlehen > 0) {
    const kredit = berechneAnnuitaetendarlehen({
      darlehensbetrag: darlehen,
      sollzins: input.sollzins,
      anfaenglicheTilgung: input.anfaenglicheTilgung,
      zinsbindungJahre: 0,
    });
    if (kredit === TILGT_NIE) nichtFinanzierbar = true;
    else monatsrate = kredit.monatsrate;
  }

  const jahresUeberschuss = jahreskaltmiete - nichtUmlagefaehigMonat * 12;

  return {
    nebenkosten,
    gesamtinvestition,
    jahreskaltmiete,
    bruttomietrendite:
      input.kaufpreis > 0 ? (jahreskaltmiete / input.kaufpreis) * 100 : 0,
    nettomietrendite:
      gesamtinvestition > 0 ? (jahresUeberschuss / gesamtinvestition) * 100 : 0,
    kaufpreisfaktor:
      jahreskaltmiete > 0 ? input.kaufpreis / jahreskaltmiete : 0,
    nichtUmlagefaehigMonat,
    darlehen,
    monatsrate,
    cashflowMonat: input.kaltmieteMonat - nichtUmlagefaehigMonat - monatsrate,
    nichtFinanzierbar,
  };
}
