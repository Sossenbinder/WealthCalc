import { applyRateToEven, type Money } from "../money";
import * as K from "./constants/2026";

export interface SozialversicherungInput {
  /** Gross salary per month. */
  bruttoMonat: Money;
  /** The Krankenkasse's Zusatzbeitrag as a percentage, e.g. 2.9. */
  zusatzbeitrag: number;
  /** Childless and at least 23 — triggers the Pflegeversicherung surcharge. */
  kinderlos: boolean;
  /** Children under 25, which reduce the employee's Pflege contribution. */
  kinderUnter25: number;
}

export interface Beitrag {
  arbeitnehmer: Money;
  arbeitgeber: Money;
  gesamt: Money;
}

export interface SozialversicherungResult {
  kranken: Beitrag;
  pflege: Beitrag;
  rente: Beitrag;
  arbeitslos: Beitrag;
  gesamt: Beitrag;
  /** Gross less the employee's share — before any Lohnsteuer. */
  nettoVorSteuer: Money;
  /** Income actually charged, once the ceilings bite. */
  bemessungKvPv: Money;
  bemessungRvAv: Money;
  /** True when the ceiling capped the contribution. */
  bbgErreichtKvPv: boolean;
  bbgErreichtRvAv: boolean;
}

const halb = (gesamt: Money): Beitrag => {
  const arbeitnehmer = applyRateToEven(gesamt, 0.5);
  return { arbeitnehmer, arbeitgeber: gesamt - arbeitnehmer, gesamt };
};

/**
 * Employee and employer contributions to the four branches of German social
 * insurance, for one month of gross pay.
 *
 * Kranken-, Renten- and Arbeitslosenversicherung are shared equally, the
 * Zusatzbeitrag included. Pflegeversicherung is shared equally too, but its
 * childless surcharge falls on the employee alone, as does the discount for
 * the second through fifth child — so that branch is built from the split
 * base plus the employee-only adjustments.
 *
 * Figures are the 2026 ones; see `constants/2026.ts` for the source.
 */
export function berechneSozialversicherung(
  input: SozialversicherungInput,
): SozialversicherungResult {
  const bemessungKvPv = Math.min(input.bruttoMonat, K.BBG_KV_PV_MONAT);
  const bemessungRvAv = Math.min(input.bruttoMonat, K.BBG_RV_AV_MONAT);

  const kranken = halb(
    applyRateToEven(bemessungKvPv, K.KV_ALLGEMEIN + input.zusatzbeitrag / 100),
  );

  const pflegeBasis = halb(applyRateToEven(bemessungKvPv, K.PV_SATZ));
  // Second through fifth child each cut the employee's rate; the sixth does not.
  const abschlagKinder = Math.min(Math.max(input.kinderUnter25 - 1, 0), 4);
  const zuschlag = input.kinderlos
    ? applyRateToEven(bemessungKvPv, K.PV_KINDERLOSENZUSCHLAG)
    : 0;
  const abschlag = applyRateToEven(
    bemessungKvPv,
    abschlagKinder * K.PV_ABSCHLAG_JE_KIND,
  );
  const pflegeArbeitnehmer = Math.max(
    pflegeBasis.arbeitnehmer + zuschlag - abschlag,
    0,
  );
  const pflege: Beitrag = {
    arbeitnehmer: pflegeArbeitnehmer,
    arbeitgeber: pflegeBasis.arbeitgeber,
    gesamt: pflegeArbeitnehmer + pflegeBasis.arbeitgeber,
  };

  const rente = halb(applyRateToEven(bemessungRvAv, K.RV_SATZ));
  const arbeitslos = halb(applyRateToEven(bemessungRvAv, K.AV_SATZ));

  const zweige = [kranken, pflege, rente, arbeitslos];
  const gesamt: Beitrag = {
    arbeitnehmer: zweige.reduce((s, z) => s + z.arbeitnehmer, 0),
    arbeitgeber: zweige.reduce((s, z) => s + z.arbeitgeber, 0),
    gesamt: zweige.reduce((s, z) => s + z.gesamt, 0),
  };

  return {
    kranken,
    pflege,
    rente,
    arbeitslos,
    gesamt,
    nettoVorSteuer: input.bruttoMonat - gesamt.arbeitnehmer,
    bemessungKvPv,
    bemessungRvAv,
    bbgErreichtKvPv: input.bruttoMonat > K.BBG_KV_PV_MONAT,
    bbgErreichtRvAv: input.bruttoMonat > K.BBG_RV_AV_MONAT,
  };
}
