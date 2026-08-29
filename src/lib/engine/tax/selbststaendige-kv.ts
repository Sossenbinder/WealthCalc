import { applyRateToEven, type Money } from "../money";
import * as K from "./constants/2026";

export interface SelbststaendigeKvInput {
  /** Monthly profit the contribution is assessed on. */
  einkommenMonat: Money;
  /** The Krankenkasse's Zusatzbeitrag as a percentage. */
  zusatzbeitrag: number;
  /** With Krankengeld cover the general rate applies, without it the reduced one. */
  mitKrankengeld: boolean;
  kinderlos: boolean;
}

export interface SelbststaendigeKvResult {
  bemessung: Money;
  kranken: Money;
  pflege: Money;
  gesamt: Money;
  /** Contribution as a share of the actual profit. */
  effektiverSatz: number;
  /** True when the minimum basis applies rather than the real profit. */
  mindestbemessungGreift: boolean;
  bbgErreicht: boolean;
  /** What an employee on the same income would pay as their own share. */
  vergleichAngestellt: Money;
}

/**
 * Health and long-term care contributions for the voluntarily insured
 * self-employed.
 *
 * Two things make this different from an employee's payslip. There is no
 * employer paying half, so the whole rate falls on one person; and the
 * contribution never drops below a statutory minimum basis, so a lean month
 * still costs the same as one earning that minimum.
 *
 * Figures for 2026, see `constants/2026.ts` for the source.
 */
export function berechneSelbststaendigeKv(
  input: SelbststaendigeKvInput,
): SelbststaendigeKvResult {
  const bemessung = Math.min(
    Math.max(input.einkommenMonat, K.MINDESTBEMESSUNG_MONAT),
    K.BBG_KV_PV_MONAT,
  );

  const kvSatz =
    (input.mitKrankengeld ? K.KV_ALLGEMEIN : K.KV_ERMAESSIGT) +
    input.zusatzbeitrag / 100;
  const pvSatz = K.PV_SATZ + (input.kinderlos ? K.PV_KINDERLOSENZUSCHLAG : 0);

  const kranken = applyRateToEven(bemessung, kvSatz);
  const pflege = applyRateToEven(bemessung, pvSatz);
  const gesamt = kranken + pflege;

  // Half of the same rates, which is what an employee carries.
  const vergleichAngestellt =
    applyRateToEven(bemessung, (K.KV_ALLGEMEIN + input.zusatzbeitrag / 100) / 2) +
    applyRateToEven(bemessung, K.PV_SATZ / 2) +
    (input.kinderlos ? applyRateToEven(bemessung, K.PV_KINDERLOSENZUSCHLAG) : 0);

  return {
    bemessung,
    kranken,
    pflege,
    gesamt,
    effektiverSatz:
      input.einkommenMonat > 0 ? (gesamt / input.einkommenMonat) * 100 : 0,
    mindestbemessungGreift: input.einkommenMonat < K.MINDESTBEMESSUNG_MONAT,
    bbgErreicht: input.einkommenMonat > K.BBG_KV_PV_MONAT,
    vergleichAngestellt,
  };
}
