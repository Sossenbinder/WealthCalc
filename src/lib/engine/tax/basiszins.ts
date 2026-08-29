/**
 * Basiszins published annually by the BMF, used for the Vorabpauschale.
 *
 * Source: BMF-Schreiben "Basiszins zur Berechnung der Vorabpauschale".
 * Ported from `EntnahmeplanSuite/src/TaxEngine/Basiszins.cs`.
 * MUST be updated each January when the new year's rate is published.
 */
const RATES: Record<number, number> = {
  2018: 0.0087,
  2019: 0.0052,
  2020: 0.0007,
  2021: -0.0045,
  2022: -0.0005,
  2023: 0.0255,
  2024: 0.0229,
  2025: 0.0227,
  // Carried forward from 2025; replace once the official 2026 value is published.
  2026: 0.0227,
};

export const BASISZINS_YEARS = Object.keys(RATES)
  .map(Number)
  .sort((a, b) => a - b);

export const FIRST_BASISZINS_YEAR = BASISZINS_YEARS[0];
export const LAST_BASISZINS_YEAR = BASISZINS_YEARS[BASISZINS_YEARS.length - 1];

/** The Basiszins for a year, or null when no official figure is on file. */
export function basiszins(year: number): number | null {
  return RATES[year] ?? null;
}
