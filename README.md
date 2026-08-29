# WealthCalc

Rechner für Geldanlage, Steuern und Kredit. Deutschsprachig, vollständig statisch,
jede Berechnung läuft im Browser — kein Backend, keine Datenübertragung.

Design: `../specs/outlines/wealthcalc-german-finance-portal.md`

## Stack

Next.js 16 (`output: 'export'`), React 19, Tailwind 4, Vitest.

## Deployment

`NEXT_PUBLIC_SITE_URL` vor dem Build setzen — daraus entstehen die absoluten
Canonicals, die Sitemap und der Sitemap-Verweis in der robots.txt:

```bash
NEXT_PUBLIC_SITE_URL=https://deine-domain.de npm run build
```

Ohne die Variable wird bewusst `https://wealthcalc.example` eingetragen: eine
erkennbare Platzhalter-Domain ist harmloser als eine falsche echte.

## Entwicklung

```bash
npm run dev        # Dev-Server
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run build      # statischer Export nach out/
```

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/lib/engine/` | Rechenkern: `Money` in ganzen Cent, deutsche Zahlenein-/ausgabe |
| `src/lib/engine/finance/` | Finanzmathematik (Zinseszins, später Annuität) |
| `src/lib/tools.ts` | Tool-Registry — speist Navigation, Startseite, Sitemap |
| `src/app/<slug>/` | Ein Rechner: `page.tsx`, Client-Komponente, `scenario-url.ts` |
| `tests/` | Vitest, spiegelt die Struktur des Rechenkerns |

Geldbeträge sind durchgängig ganzzahlige Cent, jede Zinsanwendung rundet explizit.
Szenarien stehen in der URL und sind damit teilbar.

## Status

Live:

| Rechner | Kategorie | Pfad |
| --- | --- | --- |
| Zinseszins- und Sparplanrechner | Geldanlage | `/zinseszins-rechner/` |
| Entnahmeplan-Rechner | Geldanlage | `/entnahmeplan-rechner/` |
| Rendite-Rechner | Geldanlage | `/rendite-rechner/` |
| Inflationsrechner | Geldanlage | `/inflationsrechner/` |
| Vorabpauschale-Rechner | Steuern auf Vermögen | `/vorabpauschale-rechner/` |
| Abgeltungssteuer-Rechner | Steuern auf Vermögen | `/abgeltungssteuer-rechner/` |
| ETF-Sparplan nach Steuern | Steuern auf Vermögen | `/etf-sparplan-nach-steuern/` |
| Erbschaft- und Schenkungsteuer | Steuern auf Vermögen | `/erbschaftsteuer-rechner/` |
| Sozialabgaben-Rechner | Einkommen | `/sozialabgaben-rechner/` |
| Einkommensteuer-Rechner | Einkommen | `/einkommensteuer-rechner/` |
| Stundenlohn-Rechner | Einkommen | `/stundenlohn-rechner/` |
| Abfindungsrechner | Einkommen | `/abfindung-rechner/` |
| Krankenversicherung für Selbstständige | Einkommen | `/selbststaendige-krankenversicherung/` |
| Kredit- und Tilgungsrechner | Immobilien und Kredit | `/kreditrechner/` |
| Kaufen oder Mieten | Immobilien und Kredit | `/kaufen-oder-mieten/` |
| Kaufnebenkosten-Rechner | Immobilien und Kredit | `/kaufnebenkosten-rechner/` |
| Mietrendite-Rechner | Immobilien und Kredit | `/mietrendite-rechner/` |
| Leasing oder Kaufen | Immobilien und Kredit | `/leasing-oder-kaufen/` |
| Sondertilgungs-Rechner | Immobilien und Kredit | `/sondertilgung-rechner/` |

Offen: **Brutto-Netto-Rechner**. Sozialversicherung und veranlagte
Einkommensteuer sind beide da, jeweils mit Quelle gepinnt. Was fehlt, ist die
monatliche *Lohnsteuer* — und die ist nicht der §-32a-Tarif, sondern der
amtliche „Programmablaufplan für die maschinelle Berechnung der Lohnsteuer"
samt Steuerklassen und Vorsorgepauschale. Erst den Ablaufplan beschaffen, dann
rechnen; geschätzte Lohnsteuer ist schlimmer als keine.

Der Vorabpauschale-Rechner ist eine Portierung der C#-`TaxEngine` aus
`../EntnahmeplanSuite`, inklusive ihrer Testvektoren und ihres Rundungsmodus
(kaufmännisch zur geraden Zahl). Ändert sich dort die Logik, driften beide.
