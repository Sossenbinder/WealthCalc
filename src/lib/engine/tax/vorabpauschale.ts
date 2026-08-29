import { applyRateToEven, type Money } from "../money";
import { basiszins } from "./basiszins";
import {
  berechneKapitalertragsteuer,
  type KapitalertragsteuerResult,
  type Kirchensteuer,
} from "./kapitalertragsteuer";
import { teilfreistellungSatz, type FondsArt } from "./teilfreistellung";

export interface VorabpauschaleInput {
  jahr: number;
  /** Fund value on 1 January — the basis the Basisertrag is computed from. */
  wertJahresanfang: Money;
  wertJahresende: Money;
  ausschuettungen: Money;
  fondsArt: FondsArt;
  /** Whole months held during the year, for the Zwölftelung. */
  monateGehalten: number;
  /** Sparerpauschbetrag not yet used up by other capital income. */
  sparerpauschbetragRest: Money;
  kirchensteuer: Kirchensteuer;
}

export interface VorabpauschaleResult {
  basisertrag: Money;
  /** After distributions and the growth cap — the Vorabpauschale itself. */
  vorabpauschale: Money;
  nachTeilfreistellung: Money;
  sparerpauschbetragGenutzt: Money;
  steuerpflichtig: Money;
  steuer: KapitalertragsteuerResult;
  /** Value growth in the year, which caps the Vorabpauschale. */
  wertzuwachs: Money;
}

const min = (a: Money, b: Money): Money => (a <= b ? a : b);
const subtractClampAtZero = (a: Money, b: Money): Money => Math.max(a - b, 0);

/**
 * Vorabpauschale per § 18 InvStG.
 *
 *   1. Basisertrag = Wert am Jahresanfang × 0,7 × Basiszins   (§ 18 Abs. 1),
 *      reduced pro rata by months held (Zwölftelung, § 18 Abs. 2).
 *   2. Subtract distributions made during the year; negative → 0.
 *   3. Cap at the realised value growth, floored at 0.
 *   4. Apply the Teilfreistellung for the fund category.
 *   5. Consume the remaining Sparerpauschbetrag.
 *   6. KESt + Soli + KiSt on what is left.
 *
 * Ported from `EntnahmeplanSuite/src/TaxEngine/VorabpauschaleCalculator.cs`,
 * step for step and with its rounding mode, so its test vectors still hold.
 *
 * Returns null when no Basiszins is on file for the year.
 */
export function berechneVorabpauschale(
  input: VorabpauschaleInput,
): VorabpauschaleResult | null {
  const zins = basiszins(input.jahr);
  if (zins === null) return null;
  if (input.monateGehalten < 0 || input.monateGehalten > 12) return null;

  const basisertragVollesJahr = applyRateToEven(
    applyRateToEven(input.wertJahresanfang, 0.7),
    zins,
  );

  const basisertrag =
    input.monateGehalten === 12
      ? basisertragVollesJahr
      : input.monateGehalten === 0
        ? 0
        : applyRateToEven(basisertragVollesJahr, input.monateGehalten / 12);

  const nachAusschuettungen = subtractClampAtZero(
    basisertrag,
    input.ausschuettungen,
  );
  const wertzuwachs = subtractClampAtZero(
    input.wertJahresende,
    input.wertJahresanfang,
  );
  const vorabpauschale = min(nachAusschuettungen, wertzuwachs);

  const nachTeilfreistellung = applyRateToEven(
    vorabpauschale,
    1 - teilfreistellungSatz(input.fondsArt),
  );

  const sparerpauschbetragGenutzt = min(
    nachTeilfreistellung,
    input.sparerpauschbetragRest,
  );
  const steuerpflichtig = subtractClampAtZero(
    nachTeilfreistellung,
    sparerpauschbetragGenutzt,
  );

  return {
    basisertrag,
    vorabpauschale,
    nachTeilfreistellung,
    sparerpauschbetragGenutzt,
    steuerpflichtig,
    steuer: berechneKapitalertragsteuer(steuerpflichtig, input.kirchensteuer),
    wertzuwachs,
  };
}
