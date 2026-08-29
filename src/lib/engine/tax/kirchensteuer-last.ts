import type { Money } from "../money";
import {
  einkommensteuerBetrag,
  grenzsteuersatzEuro,
  type Veranlagung,
} from "./einkommensteuer";

export interface KirchensteuerLastInput {
  zvE: Money;
  veranlagung: Veranlagung;
  /** 8 in Bayern and Baden-Württemberg, 9 elsewhere. */
  satz: number;
}

export interface KirchensteuerLastResult {
  einkommensteuer: Money;
  kirchensteuer: Money;
  /** Roughly what the Sonderausgabenabzug gives back. */
  entlastung: Money;
  /** Church tax less that relief. */
  nettokosten: Money;
  /** Net cost as a share of the taxable income. */
  anteilAmEinkommen: number;
  grenzsteuersatz: number;
  /** Net cost over a working life, undiscounted. */
  hochrechnung30Jahre: Money;
}

/**
 * What church tax actually costs.
 *
 * The headline is simple — a share of the income tax — but it overstates the
 * burden, because church tax is deductible as a Sonderausgabe. Every euro paid
 * lowers the taxable income, so part of it comes back at the marginal rate.
 *
 * The relief is an approximation: the deduction lands in the assessment for
 * the year the tax was actually paid, and applying the marginal rate to the
 * whole amount ignores that a large deduction walks down the progression. It
 * is close for ordinary incomes and is labelled as an estimate on the page.
 */
export function berechneKirchensteuerLast(
  input: KirchensteuerLastInput,
): KirchensteuerLastResult {
  const einkommensteuer = einkommensteuerBetrag(input.zvE, input.veranlagung);
  const kirchensteuer = Math.round(einkommensteuer * (input.satz / 100));

  const zvEEuro = Math.floor(input.zvE / 100);
  const grenzsteuersatz =
    grenzsteuersatzEuro(
      input.veranlagung === "zusammen" ? Math.floor(zvEEuro / 2) : zvEEuro,
    ) * 100;

  const entlastung = Math.round(kirchensteuer * (grenzsteuersatz / 100));
  const nettokosten = kirchensteuer - entlastung;

  return {
    einkommensteuer,
    kirchensteuer,
    entlastung,
    nettokosten,
    anteilAmEinkommen: input.zvE > 0 ? (nettokosten / input.zvE) * 100 : 0,
    grenzsteuersatz,
    hochrechnung30Jahre: nettokosten * 30,
  };
}
