import { ToolFinder } from "@/components/ToolFinder";
import { BoltIcon, PrintIcon, ShieldIcon } from "@/components/icons";
import { siteName, tools } from "@/lib/tools";

/**
 * What the reader gets, stated once at the top.
 *
 * These are the three questions a finance calculator raises before anyone
 * types a number into it — where does my data go, do I have to sign up, can I
 * take the result with me — and answering them beside the search costs one row.
 */
const versprechen = [
  {
    icon: ShieldIcon,
    title: "Nichts verlässt den Browser",
    text: "Jede Berechnung läuft lokal. Keine Eingabe wird an einen Server gesendet.",
  },
  {
    icon: BoltIcon,
    title: "Ergebnis beim Tippen",
    text: "Kein Absenden, kein Warten — die Zahlen aktualisieren sich sofort.",
  },
  {
    icon: PrintIcon,
    title: "Teilen und drucken",
    text: "Der Link enthält deine Eingaben. Tabellen sind druckfertig formatiert.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="animate-fade-up flex flex-col items-start gap-5">
        <p className="badge badge-accent">
          <ShieldIcon width={14} height={14} />
          {tools.length} Rechner · ohne Anmeldung
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Rechne nach, was dein Geld{" "}
          <span className="text-accent">wirklich</span> macht.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          {siteName} beantwortet die Geldfragen, bei denen es auf die Details
          ankommt — Zinseszins und Sparplan, Steuern auf Kapitalerträge,
          Sozialabgaben, Kredit und Immobilie. Nach deutschem Recht gerechnet
          und Schritt für Schritt nachvollziehbar.
        </p>
      </section>

      <ToolFinder tools={tools} />

      <section
        aria-labelledby="versprechen"
        className="border-t border-border pt-10"
      >
        <h2 id="versprechen" className="sr-only">
          Wie WealthCalc arbeitet
        </h2>
        <ul className="grid gap-6 sm:grid-cols-3">
          {versprechen.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
              >
                <Icon width={18} height={18} />
              </span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-sm text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
