/** Fund categories that carry a different Teilfreistellung. */
export type FondsArt =
  | "aktienfonds"
  | "mischfonds"
  | "immobilienfonds"
  | "auslandsImmobilienfonds"
  | "sonstige";

/**
 * Teilfreistellung per § 20 Abs. 1 InvStG (effective 2018+).
 * Ported from `EntnahmeplanSuite/src/TaxEngine/EtfTaxCategory.cs`.
 */
const SAETZE: Record<FondsArt, number> = {
  aktienfonds: 0.3,
  mischfonds: 0.15,
  immobilienfonds: 0.6,
  auslandsImmobilienfonds: 0.8,
  sonstige: 0,
};

export const FONDS_ARTEN: { id: FondsArt; label: string; hint: string }[] = [
  { id: "aktienfonds", label: "Aktienfonds", hint: "mind. 51 % Aktien — 30 % Teilfreistellung" },
  { id: "mischfonds", label: "Mischfonds", hint: "mind. 25 % Aktien — 15 %" },
  { id: "immobilienfonds", label: "Immobilienfonds", hint: "Inland — 60 %" },
  { id: "auslandsImmobilienfonds", label: "Auslands-Immobilienfonds", hint: "80 %" },
  { id: "sonstige", label: "Sonstige Fonds", hint: "keine Teilfreistellung" },
];

export function teilfreistellungSatz(art: FondsArt): number {
  return SAETZE[art];
}
