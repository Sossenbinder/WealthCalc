/**
 * Sozialversicherung figures for 2026.
 *
 * Source: GKV-Spitzenverband, "Rechengrößen und Grenzwerte im Versicherungs-
 * und Beitragsrecht für das Jahr 2026", Pressestelle, 1. Januar 2026.
 * https://www.gkv-spitzenverband.de/media/dokumente/presse/zahlen_und_grafiken/20260101_Faktenblatt_Rechengroessen_Beitragsrecht.pdf
 *
 * Every figure below is read off that sheet. None of it is recalled — these
 * change annually, and a contribution calculator that is a year stale is worse
 * than none. Add a new file per year rather than editing this one.
 */

/** Monthly Beitragsbemessungsgrenzen, in cents. */
export const BBG_KV_PV_MONAT = 5_812_50;
export const BBG_RV_AV_MONAT = 8_450_00;

/** Yearly Beitragsbemessungsgrenzen, in cents. */
export const BBG_KV_PV_JAHR = 69_750_00;
export const BBG_RV_AV_JAHR = 101_400_00;

/**
 * Minimum basis for voluntary members — the self-employed pay at least this
 * much however little they earn. Same GKV-Spitzenverband sheet.
 */
export const MINDESTBEMESSUNG_MONAT = 1_318_33;

/** Jahresarbeitsentgeltgrenze — above this, private cover becomes possible. */
export const VERSICHERUNGSPFLICHTGRENZE_JAHR = 77_400_00;

/** Contribution rates as decimals. */
export const KV_ALLGEMEIN = 0.146;
export const KV_ERMAESSIGT = 0.14;
/** Average Zusatzbeitrag; the actual rate depends on the Krankenkasse. */
export const KV_ZUSATZBEITRAG_DURCHSCHNITT = 0.029;
export const PV_SATZ = 0.036;
/** Borne by the employee alone, from age 23 without children. */
export const PV_KINDERLOSENZUSCHLAG = 0.006;
/** Employee-only discount per child, second through fifth. */
export const PV_ABSCHLAG_JE_KIND = 0.0025;
export const RV_SATZ = 0.186;
export const AV_SATZ = 0.026;

export const STAND = 2026;
export const QUELLE =
  "GKV-Spitzenverband, Rechengrößen und Grenzwerte 2026 (Stand 1. Januar 2026)";
