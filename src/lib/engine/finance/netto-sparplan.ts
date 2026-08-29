import { applyRate, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";
import { basiszins, LAST_BASISZINS_YEAR } from "../tax/basiszins";
import { berechneVorabpauschale } from "../tax/vorabpauschale";
import { berechneAbgeltungssteuer } from "../tax/abgeltungssteuer";
import type { Kirchensteuer } from "../tax/kapitalertragsteuer";
import type { FondsArt } from "../tax/teilfreistellung";

export interface NettoSparplanInput {
  startkapital: Money;
  monatlicheSparrate: Money;
  rendite: Percent;
  jahre: number;
  startjahr: number;
  fondsArt: FondsArt;
  /** Sparerpauschbetrag available for this fund each year. */
  sparerpauschbetragProJahr: Money;
  kirchensteuer: Kirchensteuer;
}

export interface NettoSparplanJahr {
  jahr: number;
  kalenderjahr: number;
  wertJahresanfang: Money;
  eingezahlt: Money;
  wertJahresende: Money;
  vorabpauschale: Money;
  steuerImJahr: Money;
}

export interface NettoSparplanResult {
  jahre: NettoSparplanJahr[];
  endkapitalBrutto: Money;
  eingezahlt: Money;
  /** Every Vorabpauschale taxed along the way, summed. */
  vorabpauschalenGesamt: Money;
  steuerAnsparphase: Money;
  steuerBeimVerkauf: Money;
  steuerGesamt: Money;
  endkapitalNetto: Money;
  /** Tax as a share of the gross gain. */
  steuerquote: number;
  /** True where no official Basiszins exists and the last one was carried on. */
  basiszinsFortgeschrieben: boolean;
}

/**
 * An ETF savings plan taxed the German way, from first payment to sale.
 *
 * Two taxes, and they interact: each year an unrealised Vorabpauschale is
 * taxed, and on sale those amounts are credited against the gain so the same
 * growth is not taxed twice. Doing only one of the two — as a plain compound
 * calculator does — overstates what is left.
 *
 * Deliberate assumptions, each of which would otherwise be hidden:
 * - The Basiszins is only published up to a given year; beyond it the last
 *   published value is carried forward, and the result flags that.
 * - Tax on the Vorabpauschale is paid from outside the portfolio, as a broker
 *   debits the settlement account, so it does not reduce the compounding.
 * - The Sparerpauschbetrag is treated as available in full each year and
 *   applied to this plan alone.
 */
export function berechneNettoSparplan(
  input: NettoSparplanInput,
): NettoSparplanResult {
  const monatsrendite = Math.pow(1 + toDecimal(input.rendite), 1 / 12) - 1;

  const jahre: NettoSparplanJahr[] = [];
  let kapital = input.startkapital;
  let eingezahlt = input.startkapital;
  let vorabpauschalenGesamt = 0;
  let steuerAnsparphase = 0;
  let basiszinsFortgeschrieben = false;

  for (let i = 0; i < input.jahre; i += 1) {
    const kalenderjahr = input.startjahr + i;
    const wertJahresanfang = kapital;
    let eingezahltImJahr = 0;

    for (let m = 0; m < 12; m += 1) {
      kapital += applyRate(kapital, monatsrendite);
      kapital += input.monatlicheSparrate;
      eingezahltImJahr += input.monatlicheSparrate;
    }
    eingezahlt += eingezahltImJahr;

    // No official Basiszins beyond the published range: carry the last forward
    // rather than silently dropping the tax to zero.
    const jahrFuerZins =
      basiszins(kalenderjahr) === null ? LAST_BASISZINS_YEAR : kalenderjahr;
    if (jahrFuerZins !== kalenderjahr) basiszinsFortgeschrieben = true;

    const vab = berechneVorabpauschale({
      jahr: jahrFuerZins,
      wertJahresanfang,
      wertJahresende: kapital,
      ausschuettungen: 0,
      fondsArt: input.fondsArt,
      monateGehalten: 12,
      sparerpauschbetragRest: input.sparerpauschbetragProJahr,
      kirchensteuer: input.kirchensteuer,
    });

    const vorabpauschale = vab?.vorabpauschale ?? 0;
    const steuerImJahr = vab?.steuer.total ?? 0;
    vorabpauschalenGesamt += vorabpauschale;
    steuerAnsparphase += steuerImJahr;

    jahre.push({
      jahr: i + 1,
      kalenderjahr,
      wertJahresanfang,
      eingezahlt: eingezahltImJahr,
      wertJahresende: kapital,
      vorabpauschale,
      steuerImJahr,
    });
  }

  const verkauf = berechneAbgeltungssteuer({
    verkaufserloes: kapital,
    kaufpreis: eingezahlt,
    versteuerteVorabpauschalen: vorabpauschalenGesamt,
    fondsArt: input.fondsArt,
    sparerpauschbetragRest: input.sparerpauschbetragProJahr,
    kirchensteuer: input.kirchensteuer,
  });

  const steuerGesamt = steuerAnsparphase + verkauf.steuer.total;
  const bruttogewinn = kapital - eingezahlt;

  return {
    jahre,
    endkapitalBrutto: kapital,
    eingezahlt,
    vorabpauschalenGesamt,
    steuerAnsparphase,
    steuerBeimVerkauf: verkauf.steuer.total,
    steuerGesamt,
    endkapitalNetto: kapital - steuerGesamt,
    steuerquote: bruttogewinn > 0 ? (steuerGesamt / bruttogewinn) * 100 : 0,
    basiszinsFortgeschrieben,
  };
}
