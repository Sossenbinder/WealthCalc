import { applyRateToEven, type Money } from "../money";

/** Church tax rate: 8 % in Bayern and Baden-Württemberg, 9 % elsewhere. */
export type Kirchensteuer = "keine" | "acht" | "neun";

export interface KapitalertragsteuerResult {
  kest: Money;
  soli: Money;
  kist: Money;
  total: Money;
}

const ABGELTUNGSTEUER = 0.25;
const SOLI_SATZ = 0.055;

/**
 * § 32d EStG: 25 % Kapitalertragsteuer plus 5,5 % Solidaritätszuschlag on it,
 * plus optional Kirchensteuer.
 *
 * When Kirchensteuer applies, the KESt itself is reduced by the statutory
 * formula e / (4 + k) — the church tax is deductible against the very base it
 * is charged on, so the rate is not simply 25 %.
 *
 * Ported from `EntnahmeplanSuite/src/TaxEngine/KapitalertragsteuerCalculator.cs`.
 */
export function berechneKapitalertragsteuer(
  taxableIncome: Money,
  kirchensteuer: Kirchensteuer,
): KapitalertragsteuerResult {
  const kistSatz =
    kirchensteuer === "acht" ? 0.08 : kirchensteuer === "neun" ? 0.09 : 0;
  const kestSatz =
    kirchensteuer === "keine" ? ABGELTUNGSTEUER : 1 / (4 + kistSatz);

  const kest = applyRateToEven(taxableIncome, kestSatz);
  const kist = applyRateToEven(kest, kistSatz);
  const soli = applyRateToEven(kest, SOLI_SATZ);

  return { kest, soli, kist, total: kest + soli + kist };
}
