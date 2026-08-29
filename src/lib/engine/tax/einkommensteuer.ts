import type { Money } from "../money";
import type { Kirchensteuer } from "./kapitalertragsteuer";

/**
 * Einkommensteuer per § 32a EStG, in the version applying from
 * Veranlagungszeitraum 2026.
 *
 * Source: § 32a Abs. 1 EStG, gesetze-im-internet.de. The five zones and every
 * coefficient below are the statutory ones; the law also prescribes the
 * rounding — the taxable income is rounded down to a full euro before the
 * formula, and the resulting tax is rounded down to a full euro after it.
 */
export const GRUNDFREIBETRAG_EUR = 12_348;
const ZONE2_BIS = 17_799;
const ZONE3_BIS = 69_878;
const ZONE4_BIS = 277_825;

/** Solidaritätszuschlag: § 4 SolZG — 5,5 %, capped in the Milderungszone. */
const SOLI_SATZ = 0.055;
const SOLI_MILDERUNG_SATZ = 0.119;
/**
 * Freigrenze for 2026 on the assessed Einkommensteuer. Adjusted annually by
 * legislation, so this needs revisiting each year.
 */
export const SOLI_FREIGRENZE_EINZEL_EUR = 20_350;
export const SOLI_FREIGRENZE_ZUSAMMEN_EUR = 40_700;

export type Veranlagung = "einzel" | "zusammen";

export interface EinkommensteuerInput {
  /** Zu versteuerndes Einkommen for the year. */
  zvE: Money;
  veranlagung: Veranlagung;
  kirchensteuer: Kirchensteuer;
}

export interface EinkommensteuerResult {
  einkommensteuer: Money;
  soli: Money;
  kirchensteuer: Money;
  gesamt: Money;
  /** Total burden as a share of the taxable income. */
  durchschnittssteuersatz: number;
  /** Rate on the next euro earned, income tax only. */
  grenzsteuersatz: number;
  /** What is left of the taxable income. */
  nettoEinkommen: Money;
}

/** § 32a Abs. 1 EStG on a whole-euro taxable income, returning whole euros. */
export function tarifEuro(zvEEuro: number): number {
  const x = Math.floor(Math.max(zvEEuro, 0));
  if (x <= GRUNDFREIBETRAG_EUR) return 0;

  if (x <= ZONE2_BIS) {
    const y = (x - GRUNDFREIBETRAG_EUR) / 10_000;
    return Math.floor((914.51 * y + 1_400) * y);
  }
  if (x <= ZONE3_BIS) {
    const z = (x - ZONE2_BIS) / 10_000;
    return Math.floor((173.1 * z + 2_397) * z + 1_034.87);
  }
  if (x <= ZONE4_BIS) return Math.floor(0.42 * x - 11_135.63);
  return Math.floor(0.45 * x - 19_470.38);
}

/**
 * Einkommensteuer in cents on a taxable income, respecting the Veranlagung.
 * Split out because § 34 EStG needs the tariff applied to several different
 * incomes within one calculation.
 */
export function einkommensteuerBetrag(
  zvE: Money,
  veranlagung: Veranlagung,
): Money {
  const euro = Math.floor(Math.max(zvE, 0) / 100);
  const est =
    veranlagung === "zusammen"
      ? 2 * tarifEuro(Math.floor(euro / 2))
      : tarifEuro(euro);
  return est * 100;
}

/** Rate on the next euro, from the derivative of the zone formula. */
export function grenzsteuersatzEuro(zvEEuro: number): number {
  const x = Math.floor(Math.max(zvEEuro, 0));
  if (x <= GRUNDFREIBETRAG_EUR) return 0;
  if (x <= ZONE2_BIS) {
    const y = (x - GRUNDFREIBETRAG_EUR) / 10_000;
    return (2 * 914.51 * y + 1_400) / 10_000;
  }
  if (x <= ZONE3_BIS) {
    const z = (x - ZONE2_BIS) / 10_000;
    return (2 * 173.1 * z + 2_397) / 10_000;
  }
  if (x <= ZONE4_BIS) return 0.42;
  return 0.45;
}

function soliEuro(estEuro: number, veranlagung: Veranlagung): number {
  const freigrenze =
    veranlagung === "zusammen"
      ? SOLI_FREIGRENZE_ZUSAMMEN_EUR
      : SOLI_FREIGRENZE_EINZEL_EUR;
  if (estEuro <= freigrenze) return 0;
  // § 4 Satz 2 SolZG: never more than 11,9 % of the amount above the Freigrenze.
  return Math.min(
    SOLI_SATZ * estEuro,
    SOLI_MILDERUNG_SATZ * (estEuro - freigrenze),
  );
}

/**
 * Income tax on a taxable income, with Solidaritätszuschlag and optional
 * Kirchensteuer.
 *
 * Joint assessment applies the Splittingverfahren: the tariff is applied to
 * half the income and the result doubled, which is why a couple on one income
 * pays markedly less than a single person on the same amount.
 *
 * This is the assessed Einkommensteuer, not the Lohnsteuer deducted monthly —
 * that follows the Programmablaufplan and its Steuerklassen, which this does
 * not implement.
 */
export function berechneEinkommensteuer(
  input: EinkommensteuerInput,
): EinkommensteuerResult {
  const zvEEuro = Math.floor(input.zvE / 100);

  const estEuro =
    input.veranlagung === "zusammen"
      ? 2 * tarifEuro(Math.floor(zvEEuro / 2))
      : tarifEuro(zvEEuro);

  const soli = Math.round(soliEuro(estEuro, input.veranlagung) * 100);
  const kistSatz =
    input.kirchensteuer === "acht" ? 0.08 : input.kirchensteuer === "neun" ? 0.09 : 0;
  const kirchensteuer = Math.round(estEuro * kistSatz * 100);

  const einkommensteuer = estEuro * 100;
  const gesamt = einkommensteuer + soli + kirchensteuer;

  return {
    einkommensteuer,
    soli,
    kirchensteuer,
    gesamt,
    durchschnittssteuersatz: input.zvE > 0 ? (gesamt / input.zvE) * 100 : 0,
    grenzsteuersatz:
      (input.veranlagung === "zusammen"
        ? grenzsteuersatzEuro(Math.floor(zvEEuro / 2))
        : grenzsteuersatzEuro(zvEEuro)) * 100,
    nettoEinkommen: input.zvE - gesamt,
  };
}
