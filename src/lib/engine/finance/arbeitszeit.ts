import { roundHalfAwayFromZero, type Money } from "../money";

export interface ArbeitszeitInput {
  monatsgehalt: Money;
  wochenstunden: number;
  /** Paid holiday, in working days per year. */
  urlaubstage: number;
  /** Public holidays falling on working days. */
  feiertage: number;
  /** Extra monthly salaries: 13th, 14th, Urlaubsgeld. */
  sonderzahlungen: number;
}

export interface ArbeitszeitResult {
  jahresgehalt: Money;
  /** Salary divided by contracted hours, counting paid leave as worked. */
  stundenlohnNominal: Money;
  /** Salary divided by hours actually at work. */
  stundenlohnEffektiv: Money;
  arbeitstage: number;
  gearbeiteteStunden: number;
  vertraglicheStunden: number;
  /** Days off that are paid, and what they are worth. */
  bezahlteFreieTage: number;
  wertDerFreienTage: Money;
  /** How much higher the effective rate is than the nominal one. */
  aufschlagProzent: number;
}

const WOCHEN_PRO_JAHR = 52;
const ARBEITSTAGE_PRO_WOCHE = 5;

/**
 * Turn a salary into an hourly rate — twice, because the two differ.
 *
 * Dividing by contracted hours treats paid holiday as if it were worked. The
 * rate for hours actually at the desk is higher, and by more than people
 * expect: thirty days of leave plus public holidays is around a sixth of the
 * working year.
 *
 * A five-day week is assumed, which is what leave in Arbeitstage presumes.
 */
export function berechneArbeitszeit(
  input: ArbeitszeitInput,
): ArbeitszeitResult {
  const jahresgehalt = input.monatsgehalt * (12 + input.sonderzahlungen);
  const stundenProTag = input.wochenstunden / ARBEITSTAGE_PRO_WOCHE;

  const arbeitstageBrutto = WOCHEN_PRO_JAHR * ARBEITSTAGE_PRO_WOCHE;
  const bezahlteFreieTage = input.urlaubstage + input.feiertage;
  const arbeitstage = Math.max(arbeitstageBrutto - bezahlteFreieTage, 0);

  const vertraglicheStunden = WOCHEN_PRO_JAHR * input.wochenstunden;
  const gearbeiteteStunden = arbeitstage * stundenProTag;

  const stundenlohnNominal =
    vertraglicheStunden > 0
      ? roundHalfAwayFromZero(jahresgehalt / vertraglicheStunden)
      : 0;
  const stundenlohnEffektiv =
    gearbeiteteStunden > 0
      ? roundHalfAwayFromZero(jahresgehalt / gearbeiteteStunden)
      : 0;

  return {
    jahresgehalt,
    stundenlohnNominal,
    stundenlohnEffektiv,
    arbeitstage,
    gearbeiteteStunden,
    vertraglicheStunden,
    bezahlteFreieTage,
    wertDerFreienTage: roundHalfAwayFromZero(
      stundenlohnEffektiv * bezahlteFreieTage * stundenProTag,
    ),
    aufschlagProzent:
      stundenlohnNominal > 0
        ? (stundenlohnEffektiv / stundenlohnNominal - 1) * 100
        : 0,
  };
}
