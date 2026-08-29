import type { Money } from "../money";

/**
 * Erbschaft- und Schenkungsteuer.
 *
 * Sources, all from gesetze-im-internet.de:
 * - § 16 Abs. 1 ErbStG for the Freibeträge,
 * - § 19 Abs. 1 ErbStG for the rate table,
 * - § 19 Abs. 3 ErbStG for the Härteausgleich.
 *
 * Unlike income tax this is a Vollstaffel: the whole taxable acquisition is
 * charged at the band's rate rather than in slices. One euro over a boundary
 * would therefore cost thousands, which is what the Härteausgleich exists to
 * prevent — and why it is implemented here rather than waved away.
 */
export type Steuerklasse = "I" | "II" | "III";

export interface Verwandtschaft {
  id: string;
  label: string;
  klasse: Steuerklasse;
  /** § 16 Abs. 1 ErbStG, in cents. */
  freibetrag: Money;
}

export const VERWANDTSCHAFT: Verwandtschaft[] = [
  { id: "ehegatte", label: "Ehegatte oder Lebenspartner", klasse: "I", freibetrag: 500_000_00 },
  { id: "kind", label: "Kind oder Stiefkind", klasse: "I", freibetrag: 400_000_00 },
  { id: "enkel", label: "Enkelkind", klasse: "I", freibetrag: 200_000_00 },
  { id: "eltern", label: "Eltern oder Großeltern (im Erbfall)", klasse: "I", freibetrag: 100_000_00 },
  { id: "klasse2", label: "Geschwister, Nichte, Neffe, Schwiegerkind", klasse: "II", freibetrag: 20_000_00 },
  { id: "klasse3", label: "Alle übrigen", klasse: "III", freibetrag: 20_000_00 },
];

/** § 19 Abs. 1: upper bound of each band in euros, and the rate per class. */
const STUFEN: { bis: number; saetze: Record<Steuerklasse, number> }[] = [
  { bis: 75_000, saetze: { I: 7, II: 15, III: 30 } },
  { bis: 300_000, saetze: { I: 11, II: 20, III: 30 } },
  { bis: 600_000, saetze: { I: 15, II: 25, III: 30 } },
  { bis: 6_000_000, saetze: { I: 19, II: 30, III: 30 } },
  { bis: 13_000_000, saetze: { I: 23, II: 35, III: 50 } },
  { bis: 26_000_000, saetze: { I: 27, II: 40, III: 50 } },
  { bis: Infinity, saetze: { I: 30, II: 43, III: 50 } },
];

export interface ErbschaftsteuerInput {
  /** Value of what is inherited or given. */
  erwerb: Money;
  verwandtschaftId: string;
}

export interface ErbschaftsteuerResult {
  freibetrag: Money;
  steuerpflichtigerErwerb: Money;
  klasse: Steuerklasse;
  steuersatz: number;
  steuer: Money;
  /** Tax before the Härteausgleich, if it bit. */
  steuerOhneHaerteausgleich: Money;
  haerteausgleichGreift: boolean;
  nettoErwerb: Money;
  /** Tax as a share of the whole acquisition, not just the taxable part. */
  effektiverSatz: number;
}

export function berechneErbschaftsteuer(
  input: ErbschaftsteuerInput,
): ErbschaftsteuerResult | null {
  const verwandt = VERWANDTSCHAFT.find((v) => v.id === input.verwandtschaftId);
  if (!verwandt) return null;

  const steuerpflichtigCent = Math.max(input.erwerb - verwandt.freibetrag, 0);
  // The statute works in whole euros.
  const steuerpflichtigEuro = Math.floor(steuerpflichtigCent / 100);

  if (steuerpflichtigEuro === 0) {
    return {
      freibetrag: verwandt.freibetrag,
      steuerpflichtigerErwerb: 0,
      klasse: verwandt.klasse,
      steuersatz: 0,
      steuer: 0,
      steuerOhneHaerteausgleich: 0,
      haerteausgleichGreift: false,
      nettoErwerb: input.erwerb,
      effektiverSatz: 0,
    };
  }

  const stufeIndex = STUFEN.findIndex((s) => steuerpflichtigEuro <= s.bis);
  const stufe = STUFEN[stufeIndex];
  const satz = stufe.saetze[verwandt.klasse];
  const vollSteuer = (steuerpflichtigEuro * satz) / 100;

  // § 19 Abs. 3: the step up at a boundary may only be taken from half the
  // excess over it (three quarters above a 30 % rate).
  let steuerEuro = vollSteuer;
  let haerteausgleichGreift = false;
  if (stufeIndex > 0) {
    const vorgrenze = STUFEN[stufeIndex - 1].bis;
    const satzDavor = STUFEN[stufeIndex - 1].saetze[verwandt.klasse];
    const steuerAnVorgrenze = (vorgrenze * satzDavor) / 100;
    const anteil = satz <= 30 ? 0.5 : 0.75;
    const gedeckelt =
      steuerAnVorgrenze + anteil * (steuerpflichtigEuro - vorgrenze);
    if (gedeckelt < vollSteuer) {
      steuerEuro = gedeckelt;
      haerteausgleichGreift = true;
    }
  }

  const steuer = Math.round(steuerEuro * 100);

  return {
    freibetrag: verwandt.freibetrag,
    steuerpflichtigerErwerb: steuerpflichtigEuro * 100,
    klasse: verwandt.klasse,
    steuersatz: satz,
    steuer,
    steuerOhneHaerteausgleich: Math.round(vollSteuer * 100),
    haerteausgleichGreift,
    nettoErwerb: input.erwerb - steuer,
    effektiverSatz: input.erwerb > 0 ? (steuer / input.erwerb) * 100 : 0,
  };
}
