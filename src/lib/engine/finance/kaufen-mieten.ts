import { applyRate, roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";
import { berechneAnnuitaetendarlehen, TILGT_NIE } from "./annuitaet";

export interface KaufenMietenInput {
  kaufpreis: Money;
  /** Grunderwerbsteuer, Notar, Grundbuch, Makler — a share of the price. */
  kaufnebenkosten: Percent;
  eigenkapital: Money;
  sollzins: Percent;
  anfaenglicheTilgung: Percent;
  /** Yearly upkeep the owner carries, as a share of the purchase price. */
  instandhaltung: Percent;
  wertsteigerung: Percent;
  kaltmiete: Money;
  mietsteigerung: Percent;
  /** Return the renter earns on capital they did not tie up in a house. */
  kapitalrendite: Percent;
  jahre: number;
}

export interface KaufenMietenJahr {
  jahr: number;
  immobilienwert: Money;
  restschuld: Money;
  /** House value less debt, plus anything the buyer could invest alongside. */
  vermoegenKauf: Money;
  /** Equity kept invested, plus every monthly difference invested. */
  vermoegenMiete: Money;
  wohnkostenKauf: Money;
  wohnkostenMiete: Money;
}

export interface KaufenMietenResult {
  darlehen: Money;
  nebenkosten: Money;
  monatsrate: Money;
  jahre: KaufenMietenJahr[];
  /** First year in which buying is worth at least as much as renting. */
  breakEvenJahr: number | null;
  vermoegenKaufEnde: Money;
  vermoegenMieteEnde: Money;
}

/** The mortgage the buyer would need never amortises. */
export const KAUF_UNFINANZIERBAR = "kauf-unfinanzierbar";

/**
 * Compare buying against renting over a horizon, honestly: whichever party
 * pays less for housing in a given month invests the difference at the same
 * return. Comparing a mortgage against a rent alone would flatter buying,
 * because the renter's spare cash would be treated as if it vanished.
 *
 * The buyer's wealth is the house less the outstanding debt; the purchase
 * costs are sunk on day one and never recovered. The renter's wealth is the
 * equity they never tied up, compounded, plus every monthly difference.
 *
 * Deliberately excluded, because each would need its own inputs and would
 * otherwise be a hidden assumption: tax on the renter's investment gains,
 * Hausgeld beyond upkeep, rent-free imputed income, and any Sondertilgung.
 */
export function vergleicheKaufenMieten(
  input: KaufenMietenInput,
): KaufenMietenResult | typeof KAUF_UNFINANZIERBAR {
  const nebenkosten = applyRate(input.kaufpreis, toDecimal(input.kaufnebenkosten));
  const darlehen = input.kaufpreis + nebenkosten - input.eigenkapital;

  if (darlehen <= 0) {
    // Paid outright: no mortgage to model, so the annuity engine is bypassed.
    return simulate(input, 0, 0, nebenkosten, []);
  }

  const kredit = berechneAnnuitaetendarlehen({
    darlehensbetrag: darlehen,
    sollzins: input.sollzins,
    anfaenglicheTilgung: input.anfaenglicheTilgung,
    zinsbindungJahre: 0,
  });
  if (kredit === TILGT_NIE) return KAUF_UNFINANZIERBAR;

  return simulate(
    input,
    darlehen,
    kredit.monatsrate,
    nebenkosten,
    kredit.jahre.map((j) => j.restschuld),
  );
}

function simulate(
  input: KaufenMietenInput,
  darlehen: Money,
  monatsrate: Money,
  nebenkosten: Money,
  restschuldProJahr: Money[],
): KaufenMietenResult {
  const monatlicheRendite = Math.pow(1 + toDecimal(input.kapitalrendite), 1 / 12) - 1;

  // The renter keeps the equity the buyer sinks into the house and its costs.
  let depotMiete = input.eigenkapital;
  let depotKauf = 0;
  const jahre: KaufenMietenJahr[] = [];

  for (let jahr = 1; jahr <= input.jahre; jahr += 1) {
    const miete = roundHalfAwayFromZero(
      input.kaltmiete * Math.pow(1 + toDecimal(input.mietsteigerung), jahr - 1),
    );
    const instandhaltungMonat = roundHalfAwayFromZero(
      applyRate(input.kaufpreis, toDecimal(input.instandhaltung)) / 12,
    );
    const restschuld = restschuldProJahr[jahr - 1] ?? 0;
    const rateDiesesJahr = restschuld > 0 || jahr <= restschuldProJahr.length
      ? monatsrate
      : 0;
    const wohnkostenKauf = rateDiesesJahr + instandhaltungMonat;

    for (let monat = 0; monat < 12; monat += 1) {
      depotMiete += applyRate(depotMiete, monatlicheRendite);
      depotKauf += applyRate(depotKauf, monatlicheRendite);
      const differenz = wohnkostenKauf - miete;
      if (differenz > 0) depotMiete += differenz;
      else depotKauf += -differenz;
    }

    const immobilienwert = roundHalfAwayFromZero(
      input.kaufpreis * Math.pow(1 + toDecimal(input.wertsteigerung), jahr),
    );

    jahre.push({
      jahr,
      immobilienwert,
      restschuld,
      vermoegenKauf: immobilienwert - restschuld + depotKauf,
      vermoegenMiete: depotMiete,
      wohnkostenKauf,
      wohnkostenMiete: miete,
    });
  }

  const breakEven = jahre.find((j) => j.vermoegenKauf >= j.vermoegenMiete);
  const last = jahre[jahre.length - 1];

  return {
    darlehen,
    nebenkosten,
    monatsrate,
    jahre,
    breakEvenJahr: breakEven?.jahr ?? null,
    vermoegenKaufEnde: last?.vermoegenKauf ?? 0,
    vermoegenMieteEnde: last?.vermoegenMiete ?? 0,
  };
}
