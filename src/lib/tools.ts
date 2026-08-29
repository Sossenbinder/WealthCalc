/**
 * The tool registry is the single source of truth for the portal spine:
 * navigation, the home page, the sitemap, related-tool links and JSON-LD all
 * derive from this list. Adding a calculator means one entry here, one engine
 * module and one route — never a cross-cutting edit.
 */

export type CategoryId = "geldanlage" | "steuern" | "einkommen" | "kredit";

export interface Category {
  id: CategoryId;
  title: string;
  description: string;
}

export interface Tool {
  slug: string;
  category: CategoryId;
  title: string;
  /** Short label for navigation, where the full title is too long. */
  navTitle: string;
  description: string;
  keywords: string[];
  /** Tax/legal year the constants and rules are pinned to, if any. */
  stand?: number;
  /**
   * Calculators that answer the next question this one raises, in order.
   * Cross-category on purpose — a Sparplan leads to its taxation, a purchase
   * to its financing. Same-category tools fill any remaining slots.
   */
  related?: string[];
}

/**
 * The ids are what URLs are built from, so they stay put; the titles describe
 * what each category actually holds today. They were written for four
 * calculators and had drifted: "Kapitalertragsteuer" had come to include
 * inheritance tax, "Kredit" held tools needing no loan at all, and "Einkommen"
 * promised a Lohnsteuer-Rechner that deliberately does not exist yet.
 */
export const categories: Category[] = [
  {
    id: "geldanlage",
    title: "Geldanlage",
    description:
      "Vermögen aufbauen, wieder entnehmen, Rendite und Kaufkraft nachrechnen.",
  },
  {
    id: "steuern",
    title: "Steuern auf Vermögen",
    description:
      "Kapitalerträge, Fondsbesteuerung sowie Erbschaft und Schenkung.",
  },
  {
    id: "einkommen",
    title: "Einkommen",
    description:
      "Was vom Verdienst bleibt — Steuern und Sozialabgaben, angestellt wie selbstständig.",
  },
  {
    id: "kredit",
    title: "Immobilien und Kredit",
    description:
      "Finanzieren, kaufen oder mieten, vermieten und leasen.",
  },
];

export const tools: Tool[] = [
  {
    slug: "zinseszins-rechner",
    related: ["etf-sparplan-nach-steuern", "entnahmeplan-rechner", "rendite-rechner"],
    category: "geldanlage",
    title: "Zinseszins- und Sparplanrechner",
    navTitle: "Zinseszinsrechner",
    description:
      "Berechne das Endkapital aus Einmalanlage und monatlicher Sparrate — oder umgekehrt, welche Sparrate und welche Anlagedauer dein Ziel erfordert. Nominal und inflationsbereinigt, mit Jahr-für-Jahr-Tabelle.",
    keywords: [
      "Zinseszinsrechner",
      "Sparplanrechner",
      "ETF Sparplan",
      "Vermögensaufbau",
      "Zinseszins berechnen",
      "Zinsrechner",
      "Geld anlegen",
      "Vermögen aufbauen",
      "Sparrate berechnen",
      "Anlagedauer berechnen",
      "Zielkapital erreichen",
      "wie lange bis 100.000 Euro",
    ],
  },
  {
    slug: "vorabpauschale-rechner",
    related: ["etf-sparplan-nach-steuern", "abgeltungssteuer-rechner"],
    category: "steuern",
    title: "Vorabpauschale-Rechner",
    navTitle: "Vorabpauschale",
    description:
      "Berechne die Vorabpauschale nach § 18 InvStG für thesaurierende Fonds — mit Basisertrag, Zwölftelung, Teilfreistellung, Sparerpauschbetrag und der Steuer aus KESt, Soli und Kirchensteuer.",
    keywords: [
      "Vorabpauschale",
      "Vorabpauschale berechnen",
      "thesaurierende ETF Steuer",
      "Basisertrag",
      "Teilfreistellung",
      "InvStG",
    ],
    stand: 2026,
  },
  {
    slug: "kreditrechner",
    related: ["kaufnebenkosten-rechner", "kaufen-oder-mieten"],
    category: "kredit",
    title: "Kredit- und Tilgungsrechner",
    navTitle: "Kreditrechner",
    description:
      "Berechne Monatsrate, Laufzeit und Gesamtzinsen eines Annuitätendarlehens — mit vollständigem Tilgungsplan und der Restschuld am Ende der Zinsbindung.",
    keywords: [
      "Kreditrechner",
      "Annuitätendarlehen",
      "Tilgungsrechner",
      "Tilgungsplan",
      "Restschuld Zinsbindung",
      "Baufinanzierung",
      "Hypothek",
      "Immobilienkredit",
      "Darlehen berechnen",
      "Ratenkredit",
    ],
  },
  {
    slug: "kaufen-oder-mieten",
    related: ["kaufnebenkosten-rechner", "kreditrechner", "mietrendite-rechner"],
    category: "kredit",
    title: "Kaufen oder Mieten",
    navTitle: "Kaufen oder Mieten",
    description:
      "Vergleiche Kaufen und Mieten über die Jahre — Immobilienwert und Restschuld auf der einen Seite, angelegtes Eigenkapital und die monatliche Differenz auf der anderen, samt Break-even.",
    keywords: [
      "Kaufen oder Mieten",
      "Immobilie kaufen oder mieten",
      "Mietrendite",
      "Break-even Immobilie",
      "Eigenheim rechnen",
    ],
  },
  {
    slug: "sozialabgaben-rechner",
    related: ["einkommensteuer-rechner"],
    category: "einkommen",
    title: "Sozialabgaben-Rechner",
    navTitle: "Sozialabgaben",
    description:
      "Berechne Kranken-, Pflege-, Renten- und Arbeitslosenversicherung aus deinem Brutto — Arbeitnehmer- und Arbeitgeberanteil getrennt, mit Beitragsbemessungsgrenzen, Kinderlosenzuschlag und Kinderabschlag.",
    keywords: [
      "Sozialabgaben berechnen",
      "Sozialversicherung Beitrag",
      "Arbeitgeberanteil",
      "Beitragsbemessungsgrenze",
      "Krankenversicherung Beitrag",
      "Pflegeversicherung kinderlos",
    ],
    stand: 2026,
  },
  {
    slug: "entnahmeplan-rechner",
    related: ["zinseszins-rechner", "rendite-rechner"],
    category: "geldanlage",
    title: "Entnahmeplan-Rechner",
    navTitle: "Entnahmeplan",
    description:
      "Berechne, wie lange dein Kapital eine monatliche Entnahme trägt — oder umgekehrt, wie viel du dauerhaft entnehmen kannst. Mit jährlich steigender Entnahme und Jahr-für-Jahr-Tabelle.",
    keywords: [
      "Entnahmeplan",
      "Kapitalverzehr",
      "wie lange reicht mein Geld",
      "sichere Entnahmerate",
      "Rente aus Depot",
      "Privatier rechnen",
      "Rente berechnen",
      "vom Kapital leben",
    ],
  },
  {
    slug: "abgeltungssteuer-rechner",
    related: ["vorabpauschale-rechner", "etf-sparplan-nach-steuern"],
    category: "steuern",
    title: "Abgeltungssteuer-Rechner",
    navTitle: "Abgeltungssteuer",
    description:
      "Berechne, was nach Steuern von einem Verkauf übrig bleibt — mit Teilfreistellung, Sparerpauschbetrag, bereits versteuerten Vorabpauschalen und Kirchensteuer.",
    keywords: [
      "Abgeltungssteuer",
      "Kapitalertragsteuer berechnen",
      "ETF verkaufen Steuer",
      "Sparerpauschbetrag",
      "Teilfreistellung",
      "Kursgewinn versteuern",
      "Aktien verkaufen Steuer",
      "Kapitalertragssteuer",
    ],
  },
  {
    slug: "rendite-rechner",
    related: ["zinseszins-rechner", "etf-sparplan-nach-steuern"],
    category: "geldanlage",
    title: "Rendite-Rechner",
    navTitle: "Rendite",
    description:
      "Berechne, welche Rendite dein Depot tatsächlich erzielt hat — auch wenn du laufend eingezahlt hast, denn dann taugt der blosse Vergleich von Anfangs- und Endwert nicht.",
    keywords: [
      "Rendite berechnen",
      "Depot Rendite",
      "jährliche Rendite",
      "Wertentwicklung berechnen",
      "Rendite mit Einzahlungen",
      "Performance berechnen",
      "Wertentwicklung Depot",
    ],
  },
  {
    slug: "kaufnebenkosten-rechner",
    related: ["kreditrechner", "kaufen-oder-mieten", "mietrendite-rechner"],
    category: "kredit",
    title: "Kaufnebenkosten-Rechner",
    navTitle: "Kaufnebenkosten",
    description:
      "Berechne, was ein Immobilienkauf über den Kaufpreis hinaus kostet — Grunderwerbsteuer nach Bundesland, Notar und Grundbuch, Maklerprovision — und wie viel Eigenkapital danach für die Finanzierung übrig bleibt.",
    keywords: [
      "Kaufnebenkosten",
      "Grunderwerbsteuer Bundesland",
      "Notarkosten Immobilie",
      "Maklerprovision",
      "Eigenkapital Immobilienkauf",
    ],
    stand: 2026,
  },
  {
    slug: "mietrendite-rechner",
    related: ["kaufnebenkosten-rechner", "kreditrechner"],
    category: "kredit",
    title: "Mietrendite-Rechner",
    navTitle: "Mietrendite",
    description:
      "Berechne Brutto- und Nettomietrendite einer vermieteten Immobilie samt monatlichem Cashflow — mit Kaufnebenkosten, nicht umlagefähigen Kosten und Finanzierung.",
    keywords: [
      "Mietrendite berechnen",
      "Bruttomietrendite",
      "Nettomietrendite",
      "Kaufpreisfaktor",
      "Cashflow Immobilie",
      "Vermieten lohnt sich",
      "Rendite Wohnung",
      "Vermietung Rendite",
    ],
  },
  {
    slug: "einkommensteuer-rechner",
    related: ["sozialabgaben-rechner", "abgeltungssteuer-rechner"],
    category: "einkommen",
    title: "Einkommensteuer-Rechner",
    navTitle: "Einkommensteuer",
    description:
      "Berechne die Einkommensteuer auf ein zu versteuerndes Einkommen nach § 32a EStG — mit Grund- und Splittingtarif, Solidaritätszuschlag samt Milderungszone, Kirchensteuer sowie Durchschnitts- und Grenzsteuersatz.",
    keywords: [
      "Einkommensteuer berechnen",
      "Steuertarif 32a EStG",
      "Splittingtarif",
      "Grenzsteuersatz",
      "Durchschnittssteuersatz",
      "Solidaritätszuschlag Freigrenze",
    ],
    stand: 2026,
  },
  {
    slug: "etf-sparplan-nach-steuern",
    related: ["zinseszins-rechner", "vorabpauschale-rechner", "abgeltungssteuer-rechner"],
    category: "steuern",
    title: "ETF-Sparplan nach Steuern",
    navTitle: "Sparplan nach Steuern",
    description:
      "Berechne, was von einem ETF-Sparplan wirklich übrig bleibt — jährliche Vorabpauschale während der Ansparphase, Abgeltungssteuer beim Verkauf und die Anrechnung der bereits versteuerten Beträge.",
    keywords: [
      "ETF Sparplan Steuern",
      "Vorabpauschale Sparplan",
      "ETF nach Steuern",
      "Endkapital netto",
      "Abgeltungssteuer ETF",
    ],
    stand: 2026,
  },
  {
    slug: "erbschaftsteuer-rechner",
    category: "steuern",
    title: "Erbschaft- und Schenkungsteuer",
    navTitle: "Erbschaftsteuer",
    description:
      "Berechne die Steuer auf ein Erbe oder eine Schenkung — mit dem Freibetrag des Verwandtschaftsgrads, der Steuerklasse nach § 15 ErbStG und dem Härteausgleich an den Stufengrenzen.",
    keywords: [
      "Erbschaftsteuer berechnen",
      "Schenkungsteuer",
      "Freibetrag Erbschaft",
      "Steuerklasse ErbStG",
      "Härteausgleich",
      "Erbe versteuern",
      "Erbschaftssteuer",
      "Nachlass",
      "vererben",
    ],
    related: ["abgeltungssteuer-rechner", "einkommensteuer-rechner"],
  },
  {
    slug: "inflationsrechner",
    category: "geldanlage",
    title: "Inflationsrechner",
    navTitle: "Inflation",
    description:
      "Berechne, was aus einem Betrag über die Jahre wird — wie viel Kaufkraft er verliert und welche Summe du später bräuchtest, um dasselbe zu kaufen.",
    keywords: [
      "Inflationsrechner",
      "Kaufkraft berechnen",
      "Kaufkraftverlust",
      "Geldentwertung",
      "Inflation Auswirkung",
    ],
    related: ["zinseszins-rechner", "entnahmeplan-rechner", "rendite-rechner"],
  },
  {
    slug: "stundenlohn-rechner",
    category: "einkommen",
    title: "Stundenlohn-Rechner",
    navTitle: "Stundenlohn",
    description:
      "Rechne dein Gehalt in einen Stundenlohn um — einmal auf die vertraglichen Stunden und einmal auf die tatsächlich gearbeiteten, denn Urlaub und Feiertage werden bezahlt, aber nicht gearbeitet.",
    keywords: [
      "Stundenlohn berechnen",
      "Gehalt in Stundenlohn",
      "Jahresgehalt",
      "Teilzeit Stundenlohn",
      "Urlaubstage Wert",
      "Gehalt umrechnen",
      "Lohn pro Stunde",
      "Teilzeit",
    ],
    related: ["sozialabgaben-rechner", "einkommensteuer-rechner"],
  },
  {
    slug: "leasing-oder-kaufen",
    category: "kredit",
    title: "Leasing oder Kaufen",
    navTitle: "Leasing oder Kaufen",
    description:
      "Vergleiche Leasing und finanzierten Kauf über dieselbe Laufzeit — mit Restwert, Zinsen und der Rendite auf das Geld, das nicht im Auto steckt.",
    keywords: [
      "Leasing oder Kaufen",
      "Autoleasing Vergleich",
      "Restwert Auto",
      "Autofinanzierung",
      "Leasingrate rechnen",
    ],
    related: ["kreditrechner", "kaufen-oder-mieten"],
  },
  {
    slug: "sondertilgung-rechner",
    category: "kredit",
    title: "Sondertilgungs-Rechner",
    navTitle: "Sondertilgung",
    description:
      "Berechne, was eine jährliche Sondertilgung bringt — wie viele Zinsen sie spart und um wie viele Jahre sie das Darlehen verkürzt.",
    keywords: [
      "Sondertilgung",
      "Sondertilgung berechnen",
      "Darlehen schneller abzahlen",
      "Zinsen sparen Kredit",
      "Restschuld senken",
      "Tilgung erhöhen",
    ],
    related: ["kreditrechner", "kaufnebenkosten-rechner", "kaufen-oder-mieten"],
  },
  {
    slug: "abfindung-rechner",
    category: "einkommen",
    title: "Abfindungsrechner",
    navTitle: "Abfindung",
    description:
      "Berechne, was von einer Abfindung nach Steuern bleibt — mit der Fünftelregelung nach § 34 EStG und dem Vergleich zur Besteuerung als normales Einkommen.",
    keywords: [
      "Abfindung berechnen",
      "Fünftelregelung",
      "Abfindung Steuer",
      "Abfindung netto",
      "Aufhebungsvertrag",
      "Kündigung Abfindung",
    ],
    related: ["einkommensteuer-rechner", "sozialabgaben-rechner", "stundenlohn-rechner"],
    stand: 2026,
  },
  {
    slug: "selbststaendige-krankenversicherung",
    category: "einkommen",
    title: "Krankenversicherung für Selbstständige",
    navTitle: "KV Selbstständige",
    description:
      "Berechne Kranken- und Pflegeversicherung als freiwillig versicherte selbstständige Person — ohne Arbeitgeberanteil, mit Mindestbemessungsgrundlage und Beitragsbemessungsgrenze.",
    keywords: [
      "Krankenversicherung Selbstständige",
      "freiwillig versichert",
      "Mindestbeitrag GKV",
      "Freiberufler Krankenkasse",
      "Beitrag ohne Arbeitgeber",
      "Selbstständigkeit Sozialabgaben",
    ],
    related: ["sozialabgaben-rechner", "einkommensteuer-rechner", "stundenlohn-rechner"],
    stand: 2026,
  },
  {
    slug: "immobilien-budget",
    category: "kredit",
    title: "Wie viel Haus kann ich mir leisten?",
    navTitle: "Immobilienbudget",
    description:
      "Berechne aus deiner monatlichen Rate und deinem Eigenkapital, wie teuer die Immobilie höchstens sein darf — die Kaufnebenkosten gehen dabei vom Eigenkapital ab, nicht ins Darlehen.",
    keywords: [
      "wie viel Haus kann ich mir leisten",
      "Immobilienbudget",
      "Maximaler Kaufpreis",
      "Baufinanzierung Rate",
      "Eigenkapital Immobilie",
      "Hauskauf Budget",
    ],
    related: ["kreditrechner", "kaufnebenkosten-rechner", "kaufen-oder-mieten"],
  },
  {
    slug: "kirchensteuer-rechner",
    category: "einkommen",
    title: "Kirchensteuer-Rechner",
    navTitle: "Kirchensteuer",
    description:
      "Berechne, was die Kirchensteuer im Jahr kostet — und was davon der Sonderausgabenabzug zurückholt, denn der Nettobetrag liegt deutlich unter den 8 oder 9 Prozent der Einkommensteuer.",
    keywords: [
      "Kirchensteuer berechnen",
      "Kirchensteuer sparen",
      "Kirchenaustritt",
      "Sonderausgabenabzug",
      "Kirchensteuer 8 oder 9 Prozent",
    ],
    related: ["einkommensteuer-rechner", "abfindung-rechner", "sozialabgaben-rechner"],
    stand: 2026,
  },
];

export function getTool(slug: string): Tool | undefined {
  return tools.find((tool) => tool.slug === slug);
}

/**
 * Tools worth offering next, explicit ones first, then others from the same
 * category. Capped so the list stays a suggestion rather than a second menu.
 */
export function relatedTools(slug: string, limit = 3): Tool[] {
  const tool = getTool(slug);
  if (!tool) return [];

  const chosen: Tool[] = [];
  for (const candidate of tool.related ?? []) {
    const found = getTool(candidate);
    if (found && found.slug !== slug) chosen.push(found);
  }
  for (const sibling of tools) {
    if (chosen.length >= limit) break;
    if (sibling.slug === slug) continue;
    if (sibling.category !== tool.category) continue;
    if (chosen.some((c) => c.slug === sibling.slug)) continue;
    chosen.push(sibling);
  }
  return chosen.slice(0, limit);
}

export function toolsByCategory(category: CategoryId): Tool[] {
  return tools.filter((tool) => tool.category === category);
}

export function getCategory(id: CategoryId): Category {
  const category = categories.find((entry) => entry.id === id);
  if (!category) throw new Error(`Unknown category: ${id}`);
  return category;
}

/**
 * Absolute base for canonical URLs and the sitemap.
 *
 * The domain is still an open question in the outline, so it is not baked in:
 * set NEXT_PUBLIC_SITE_URL at build time. The fallback is deliberately an
 * .example host — a wrong real domain in a sitemap is worse than an obviously
 * placeholder one.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://wealthcalc.example"
).replace(/\/$/, "");

export const siteName = "WealthCalc";
/**
 * Names all four categories. The previous wording listed three and quietly
 * left out Einkommen, which by then held five calculators — and it is the
 * default <title> on every page.
 */
export const siteTagline =
  "Rechner für Geldanlage, Steuern, Einkommen und Immobilien";
