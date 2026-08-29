import type { Money } from "../money";
import {
  einkommensteuerBetrag,
  type Veranlagung,
} from "./einkommensteuer";
import type { Kirchensteuer } from "./kapitalertragsteuer";

const SOLI_SATZ = 0.055;
const SOLI_MILDERUNG_SATZ = 0.119;
const SOLI_FREIGRENZE_EINZEL_EUR = 20_350;
const SOLI_FREIGRENZE_ZUSAMMEN_EUR = 40_700;

export interface AbfindungInput {
  /** Taxable income for the year without the severance. */
  verbleibendesZvE: Money;
  abfindung: Money;
  veranlagung: Veranlagung;
  kirchensteuer: Kirchensteuer;
}

export interface AbfindungResult {
  /** Income tax on the ordinary income alone. */
  steuerLaufend: Money;
  /** § 34 tax attributable to the severance. */
  steuerAbfindung: Money;
  /** What the severance would cost taxed as ordinary income. */
  steuerOhneFuenftelregelung: Money;
  ersparnis: Money;
  soli: Money;
  kirchensteuer: Money;
  steuerGesamt: Money;
  nettoAbfindung: Money;
  /** Tax on the severance as a share of it. */
  effektiverSatz: number;
  /** True where sentence 3 applies because the ordinary income is nil. */
  sonderfallOhneLaufendesEinkommen: boolean;
}

function soli(estEuro: number, veranlagung: Veranlagung): number {
  const freigrenze =
    veranlagung === "zusammen"
      ? SOLI_FREIGRENZE_ZUSAMMEN_EUR
      : SOLI_FREIGRENZE_EINZEL_EUR;
  if (estEuro <= freigrenze) return 0;
  return Math.min(
    SOLI_SATZ * estEuro,
    SOLI_MILDERUNG_SATZ * (estEuro - freigrenze),
  );
}

/**
 * Severance taxed under the Fünftelregelung, § 34 Abs. 1 EStG.
 *
 * The tax on the severance is five times the difference between the tax on the
 * ordinary income and the tax on that income plus one fifth of the severance.
 * Spreading it over five notional years keeps most of it out of the top of the
 * progression — which is the entire point, and why the relief shrinks as the
 * ordinary income already approaches the top rate.
 *
 * Where the ordinary income is nil, sentence 3 applies instead: five times the
 * tax on one fifth of the whole taxable income.
 *
 * This is the assessed tax under § 34, not the monthly Lohnsteuer.
 */
export function berechneAbfindung(input: AbfindungInput): AbfindungResult {
  const { verbleibendesZvE, abfindung, veranlagung } = input;

  const steuerLaufend = einkommensteuerBetrag(verbleibendesZvE, veranlagung);
  const sonderfall = verbleibendesZvE <= 0 && abfindung > 0;

  const steuerAbfindung = sonderfall
    ? 5 * einkommensteuerBetrag(Math.floor(abfindung / 5), veranlagung)
    : 5 *
      (einkommensteuerBetrag(
        verbleibendesZvE + Math.floor(abfindung / 5),
        veranlagung,
      ) -
        steuerLaufend);

  const steuerOhneFuenftelregelung =
    einkommensteuerBetrag(verbleibendesZvE + abfindung, veranlagung) -
    steuerLaufend;

  const estGesamt = steuerLaufend + steuerAbfindung;
  const soliBetrag = Math.round(soli(estGesamt / 100, veranlagung) * 100);
  const kistSatz =
    input.kirchensteuer === "acht" ? 0.08 : input.kirchensteuer === "neun" ? 0.09 : 0;
  const kist = Math.round(estGesamt * kistSatz);

  return {
    steuerLaufend,
    steuerAbfindung,
    steuerOhneFuenftelregelung,
    ersparnis: steuerOhneFuenftelregelung - steuerAbfindung,
    soli: soliBetrag,
    kirchensteuer: kist,
    steuerGesamt: estGesamt + soliBetrag + kist,
    nettoAbfindung: abfindung - steuerAbfindung,
    effektiverSatz: abfindung > 0 ? (steuerAbfindung / abfindung) * 100 : 0,
    sonderfallOhneLaufendesEinkommen: sonderfall,
  };
}
