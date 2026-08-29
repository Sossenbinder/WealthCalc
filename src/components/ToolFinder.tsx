"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { categories, type Tool } from "@/lib/tools";

interface ToolFinderProps {
  tools: Tool[];
}

/** Fold umlauts so "Kaufergaenzung" finds "Kaufergänzung" and vice versa. */
function normalisieren(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ß", "ss");
}

/**
 * Filter the calculators by what the reader is trying to do.
 *
 * Searching the keywords matters more than the titles: someone asking about
 * "ETF verkaufen Steuer" is looking for the Abgeltungssteuer-Rechner, a word
 * they would have to already know to find it by name.
 *
 * The unfiltered list is what renders on the server, so the static HTML still
 * carries every calculator for crawlers and for readers without JavaScript.
 */
export function ToolFinder({ tools }: ToolFinderProps) {
  const [suche, setSuche] = useState("");

  const treffer = useMemo(() => {
    const begriff = normalisieren(suche.trim());
    if (begriff === "") return tools;
    const teile = begriff.split(/\s+/);
    return tools.filter((tool) => {
      const heuhaufen = normalisieren(
        [tool.title, tool.description, ...tool.keywords].join(" "),
      );
      return teile.every((teil) => heuhaufen.includes(teil));
    });
  }, [suche, tools]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <label htmlFor="tool-suche" className="text-sm font-medium">
          Rechner suchen
        </label>
        <input
          id="tool-suche"
          type="search"
          value={suche}
          onChange={(event) => setSuche(event.target.value)}
          placeholder="z. B. ETF verkaufen, Miete, Erbe, Sparplan"
          autoComplete="off"
          className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <p aria-live="polite" className="text-xs text-muted">
          {suche.trim() === ""
            ? `${tools.length} Rechner`
            : treffer.length === 0
              ? "Kein Rechner passt dazu — versuch es mit einem anderen Wort."
              : `${treffer.length} von ${tools.length} Rechnern`}
        </p>
      </div>

      {categories.map((category) => {
        const passend = treffer.filter((tool) => tool.category === category.id);
        if (passend.length === 0) return null;

        return (
          <section key={category.id} className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              {category.title}
            </h2>
            <p className="text-muted">{category.description}</p>
            <ul className="grid gap-4 sm:grid-cols-2">
              {passend.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    href={`/${tool.slug}/`}
                    className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-5 hover:border-accent"
                  >
                    <span className="font-medium">{tool.title}</span>
                    <span className="text-sm text-muted">{tool.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
