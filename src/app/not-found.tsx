import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">404</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Seite nicht gefunden
        </h1>
        <p className="max-w-2xl text-muted">
          Diese Adresse gibt es nicht. Vermutlich ist der Link veraltet oder es
          hat sich ein Tippfehler eingeschlichen.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Wonach suchst du?</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {gefuellt.map((category) => (
            <li key={category.id}>
              <Link
                href={`/kategorie/${category.id}/`}
                className="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-5 hover:border-accent"
              >
                <span className="font-medium">{category.title}</span>
                <span className="text-sm text-muted">
                  {category.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-muted">
        Oder{" "}
        <Link href="/" className="text-accent hover:underline">
          alle {tools.length} Rechner durchsuchen
        </Link>
        .
      </p>
    </div>
  );
}
