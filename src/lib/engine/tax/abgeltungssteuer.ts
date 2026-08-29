import { applyRateToEven, type Money } from "../money";
import {
  berechneKapitalertragsteuer,
  type KapitalertragsteuerResult,
  type Kirchensteuer,
} from "./kapitalertragsteuer";
import { teilfreistellungSatz, type FondsArt } from "./teilfreistellung";

export interface AbgeltungssteuerInput {
  verkaufserloes: Money;
  kaufpreis: Money;
  /**
   * Vorabpauschalen taxed in earlier years. They were already paid for, so
   * they come off the gain on sale — otherwise the same money is taxed twice.
   */
  versteuerteVorabpauschalen: Money;
  fondsArt: FondsArt;
  sparerpauschbetragRest: Money;
  kirchensteuer: Kirchensteuer;
}

export interface AbgeltungssteuerResult {
  /** Sale proceeds less what was paid — before any relief. */
  rohgewinn: Money;
  /** After crediting Vorabpauschalen already taxed. */
  gewinn: Money;
  nachTeilfreistellung: Money;
  sparerpauschbetragGenutzt: Money;
  bemessungsgrundlage: Money;
  steuer: KapitalertragsteuerResult;
  /** What actually lands in the account. */
  nettoerloes: Money;
  /** Tax as a share of the raw gain, which is what people compare against 26,375 %. */
  effektiverSteuersatz: number;
}

const clampAtZero = (v: Money): Money => Math.max(v, 0);
const min = (a: Money, b: Money): Money => (a <= b ? a : b);

/**
 * Abgeltungsteuer on a fund or share sale.
 *
 *   1. Gain = proceeds − cost.
 *   2. Credit Vorabpauschalen already taxed in earlier years, so the same
 *      growth is not taxed a second time (§ 19 InvStG).
 *   3. Teilfreistellung for the fund category.
 *   4. Consume what is left of the Sparerpauschbetrag.
 *   5. KESt + Soli + KiSt on the remainder.
 *
 * A loss is not taxed and produces no relief here — Verlustverrechnung runs
 * across a whole year and several pots, which this single-sale view cannot see.
 */
export function berechneAbgeltungssteuer(
  input: AbgeltungssteuerInput,
): AbgeltungssteuerResult {
  const rohgewinn = input.verkaufserloes - input.kaufpreis;
  const gewinn = clampAtZero(rohgewinn - input.versteuerteVorabpauschalen);

  const nachTeilfreistellung = applyRateToEven(
    gewinn,
    1 - teilfreistellungSatz(input.fondsArt),
  );
  const sparerpauschbetragGenutzt = min(
    nachTeilfreistellung,
    input.sparerpauschbetragRest,
  );
  const bemessungsgrundlage = clampAtZero(
    nachTeilfreistellung - sparerpauschbetragGenutzt,
  );

  const steuer = berechneKapitalertragsteuer(
    bemessungsgrundlage,
    input.kirchensteuer,
  );

  return {
    rohgewinn,
    gewinn,
    nachTeilfreistellung,
    sparerpauschbetragGenutzt,
    bemessungsgrundlage,
    steuer,
    nettoerloes: input.verkaufserloes - steuer.total,
    effektiverSteuersatz: rohgewinn > 0 ? (steuer.total / rohgewinn) * 100 : 0,
  };
}
