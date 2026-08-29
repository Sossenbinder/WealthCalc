import { applyRate, type Money } from "../money";
import { toDecimal, type Percent } from "../percent";

export interface KaufnebenkostenInput {
  kaufpreis: Money;
  /** Set by the Bundesland; see `tax/grunderwerbsteuer.ts`. */
  grunderwerbsteuerSatz: Percent;
  /** Notary and land registry together — a convention, not a fixed rate. */
  notarUndGrundbuch: Percent;
  /** The buyer's share of the agent's fee, including VAT. */
  maklerprovision: Percent;
  eigenkapital: Money;
}

export interface KaufnebenkostenResult {
  grunderwerbsteuer: Money;
  notarUndGrundbuch: Money;
  maklerprovision: Money;
  nebenkostenGesamt: Money;
  /** Purchase price plus every incidental cost. */
  gesamtkosten: Money;
  /** Incidental costs as a share of the purchase price. */
  nebenkostenAnteil: number;
  /** What is left of the equity once the incidental costs are paid. */
  eigenkapitalNachNebenkosten: Money;
  /** The loan needed, assuming the bank finances only the price itself. */
  finanzierungsbedarf: Money;
  /** True when the equity does not even cover the incidental costs. */
  eigenkapitalReichtNicht: boolean;
}

/**
 * What buying a property costs beyond the asking price.
 *
 * Banks generally lend against the property, not against the fees, so the
 * incidental costs have to come out of equity. That is the number this exists
 * to surface: equity minus costs is what is actually left as a deposit.
 */
export function berechneKaufnebenkosten(
  input: KaufnebenkostenInput,
): KaufnebenkostenResult {
  const grunderwerbsteuer = applyRate(
    input.kaufpreis,
    toDecimal(input.grunderwerbsteuerSatz),
  );
  const notarUndGrundbuch = applyRate(
    input.kaufpreis,
    toDecimal(input.notarUndGrundbuch),
  );
  const maklerprovision = applyRate(
    input.kaufpreis,
    toDecimal(input.maklerprovision),
  );

  const nebenkostenGesamt =
    grunderwerbsteuer + notarUndGrundbuch + maklerprovision;
  const eigenkapitalNachNebenkosten = input.eigenkapital - nebenkostenGesamt;

  return {
    grunderwerbsteuer,
    notarUndGrundbuch,
    maklerprovision,
    nebenkostenGesamt,
    gesamtkosten: input.kaufpreis + nebenkostenGesamt,
    nebenkostenAnteil:
      input.kaufpreis > 0 ? (nebenkostenGesamt / input.kaufpreis) * 100 : 0,
    eigenkapitalNachNebenkosten,
    finanzierungsbedarf: Math.max(
      input.kaufpreis - Math.max(eigenkapitalNachNebenkosten, 0),
      0,
    ),
    eigenkapitalReichtNicht: eigenkapitalNachNebenkosten < 0,
  };
}
