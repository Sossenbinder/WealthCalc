import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CategoryIcon, SearchIcon } from "@/components/icons";
import { categories, tools, toolsByCategory } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
};

/**
 * A 404 is a way out, not a catalogue.
 *
 * This used to list every calculator, which was reasonable when there was one
 * of them and became four screens of tiles on a phone once there were sixteen.
 * The categories stay four however many calculators exist, and the search on
 * the start page handles the rest.
 */
export default function NotFound() {
  const gefuellt = categories.filter(
    (category) => toolsByCategory(category.id).length > 0,
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-start gap-3">
        <p className="badge">404</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Seite nicht gefunden
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          Diese Adresse gibt es nicht. Vermutlich ist der Link veraltet oder es
          hat sich ein Tippfehler eingeschlichen.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <Link href="/" className="btn btn-primary">
            <SearchIcon width={16} height={16} />
            Alle {tools.length} Rechner durchsuchen
          </Link>
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Wonach suchst du?</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {gefuellt.map((category) => (
            <li key={category.id}>
              <Link href={`/kategorie/${category.id}/`} className="card-link group">
                <span className="flex items-center gap-2">
                  <span className="text-accent" aria-hidden="true">
                    <CategoryIcon category={category.id} width={18} height={18} />
                  </span>
                  <span className="min-w-0 flex-1 font-medium">
                    {category.title}
                  </span>
                  <ArrowRightIcon
                    width={18}
                    height={18}
                    className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                </span>
                <span className="text-sm text-muted">{category.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
