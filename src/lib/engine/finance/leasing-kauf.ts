import { applyRate, roundHalfAwayFromZero, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";
import { annuitaetFuerLaufzeit } from "./annuitaet";

export interface LeasingKaufInput {
  listenpreis: Money;
  laufzeitMonate: number;
  /** Leasing: Sonderzahlung up front and the monthly rate. */
  leasingSonderzahlung: Money;
  leasingRate: Money;
  /** Buying: what is paid up front, the rest financed. */
  kaufAnzahlung: Money;
  kaufSollzins: Percent;
  /** Yearly loss in value, which is what the car is still worth at the end. */
  wertverlustProJahr: Percent;
  /** Return on money not tied up in the car. */
  kapitalrendite: Percent;
}

export interface LeasingKaufResult {
  leasingGesamt: Money;
  kaufRate: Money;
  kaufDarlehen: Money;
  kaufZinsen: Money;
  restwert: Money;
  /** Everything paid, less what the car is still worth. */
  kaufGesamt: Money;
  /** Positive means leasing costs more. */
  differenz: Money;
  leasingGuenstiger: boolean;
  /** Interest earned on whichever side tied up less money. */
  zinsvorteil: Money;
  /** Cost after crediting that return — what the verdict compares. */
  leasingEffektiv: Money;
  kaufEffektiv: Money;
  monatlicheDifferenz: Money;
}

/**
 * Leasing against buying the same car on credit.
 *
 * The comparison only works if both sides are counted whole. Leasing looks
 * cheaper per month because nothing is being bought; buying ends with an asset
 * that is still worth something, so its true cost is everything paid less that
 * residual value. And whichever side ties up less money earns a return on the
 * difference, which is credited rather than ignored.
 */
export function vergleicheLeasingKauf(
  input: LeasingKaufInput,
): LeasingKaufResult {
  const monate = input.laufzeitMonate;
  const jahre = monate / 12;

  const leasingGesamt =
    input.leasingSonderzahlung + input.leasingRate * monate;

  const kaufDarlehen = Math.max(input.listenpreis - input.kaufAnzahlung, 0);
  const kaufRate = annuitaetFuerLaufzeit(
    kaufDarlehen,
    input.kaufSollzins,
    monate,
  );
  const kaufZahlungen = input.kaufAnzahlung + kaufRate * monate;
  const kaufZinsen = kaufRate * monate - kaufDarlehen;

  const restwert = roundHalfAwayFromZero(
    input.listenpreis *
      Math.pow(1 - toDecimal(input.wertverlustProJahr), jahre),
  );
  const kaufGesamt = kaufZahlungen - restwert;

  // Whoever pays less up front and per month earns a return on the difference.
  const monatsrendite =
    Math.pow(1 + toDecimal(input.kapitalrendite), 1 / 12) - 1;
  const vorschussDifferenz =
    input.kaufAnzahlung - input.leasingSonderzahlung;
  const monatlicheDifferenz = kaufRate - input.leasingRate;

  let depot = Math.max(vorschussDifferenz, 0);
  let depotKauf = Math.max(-vorschussDifferenz, 0);
  for (let m = 0; m < monate; m += 1) {
    depot += applyRate(depot, monatsrendite);
    depotKauf += applyRate(depotKauf, monatsrendite);
    if (monatlicheDifferenz > 0) depot += monatlicheDifferenz;
    else depotKauf += -monatlicheDifferenz;
  }
  const zinsvorteil =
    depot -
    Math.max(vorschussDifferenz, 0) -
    Math.max(monatlicheDifferenz, 0) * monate -
    (depotKauf -
      Math.max(-vorschussDifferenz, 0) -
      Math.max(-monatlicheDifferenz, 0) * monate);

  const leasingEffektiv = leasingGesamt - Math.max(zinsvorteil, 0);
  const kaufEffektiv = kaufGesamt + Math.min(zinsvorteil, 0);

  return {
    leasingGesamt,
    kaufRate,
    kaufDarlehen,
    kaufZinsen,
    restwert,
    kaufGesamt,
    leasingEffektiv,
    kaufEffektiv,
    differenz: leasingEffektiv - kaufEffektiv,
    leasingGuenstiger: leasingEffektiv < kaufEffektiv,
    zinsvorteil,
    monatlicheDifferenz,
  };
}
