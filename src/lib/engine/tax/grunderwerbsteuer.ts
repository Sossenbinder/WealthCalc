/**
 * Grunderwerbsteuer per Bundesland.
 *
 * The rate is set by each Land, so it is the one legally fixed part of the
 * purchase costs. Cross-checked against two independent published tables that
 * agreed on all sixteen values (finanz-tools.de and rechenbar.de, both as of
 * 2026); a search summary claiming Thüringen at 6,5 % disagreed with both and
 * was discarded.
 *
 * Rates change when a Land legislates — Bremen last moved in July 2025. Check
 * before relying on this for a year other than 2026.
 */
export interface Bundesland {
  id: string;
  name: string;
  /** Rate as a percentage. */
  satz: number;
}

export const BUNDESLAENDER: Bundesland[] = [
  { id: "bw", name: "Baden-Württemberg", satz: 5.0 },
  { id: "by", name: "Bayern", satz: 3.5 },
  { id: "be", name: "Berlin", satz: 6.0 },
  { id: "bb", name: "Brandenburg", satz: 6.5 },
  { id: "hb", name: "Bremen", satz: 5.5 },
  { id: "hh", name: "Hamburg", satz: 5.5 },
  { id: "he", name: "Hessen", satz: 6.0 },
  { id: "mv", name: "Mecklenburg-Vorpommern", satz: 6.0 },
  { id: "ni", name: "Niedersachsen", satz: 5.0 },
  { id: "nw", name: "Nordrhein-Westfalen", satz: 6.5 },
  { id: "rp", name: "Rheinland-Pfalz", satz: 5.0 },
  { id: "sl", name: "Saarland", satz: 6.5 },
  { id: "sn", name: "Sachsen", satz: 5.5 },
  { id: "st", name: "Sachsen-Anhalt", satz: 5.0 },
  { id: "sh", name: "Schleswig-Holstein", satz: 6.5 },
  { id: "th", name: "Thüringen", satz: 5.0 },
];

export const GRUNDERWERBSTEUER_STAND = 2026;

export function grunderwerbsteuerSatz(id: string): number | null {
  return BUNDESLAENDER.find((l) => l.id === id)?.satz ?? null;
}
