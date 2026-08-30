"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRightIcon, CategoryIcon, CloseIcon, SearchIcon } from "@/components/icons";
import { searchTools } from "@/lib/search";
import { categories, type CategoryId, type Tool } from "@/lib/tools";

interface ToolFinderProps {
  tools: Tool[];
}

type Filter = CategoryId | "alle";

/**
 * The catalogue: search across all calculators, plus a filter by category.
 *
 * Two ways in rather than one, because they answer different questions. Search
 * matches the keywords, so someone thinking "ETF verkaufen Steuer" lands on the
 * Abgeltungssteuer-Rechner — a word they would have to already know to find it
 * by name. The category chips are for the reader who is browsing rather than
 * looking, and who would otherwise scroll past four headings to find out what
 * is even here.
 *
 * The unfiltered list is what renders on the server, so the static HTML still
 * carries every calculator for crawlers and for readers without JavaScript.
 */
export function ToolFinder({ tools }: ToolFinderProps) {
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");

  const treffer = useMemo(() => searchTools(tools, suche), [suche, tools]);
  const sichtbar = useMemo(
    () =>
      filter === "alle"
        ? treffer
        : treffer.filter((tool) => tool.category === filter),
    [treffer, filter],
  );

  const suchend = suche.trim() !== "";
  // While searching, the ranking is the point — regrouping by category would
  // throw it away. Browsing, the grouping is the structure.
  const gruppiert = !suchend && filter === "alle";

  const counts = useMemo(() => {
    const map = new Map<CategoryId, number>();
    for (const tool of treffer) {
      map.set(tool.category, (map.get(tool.category) ?? 0) + 1);
    }
    return map;
  }, [treffer]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            width={20}
            height={20}
          />
          <label htmlFor="tool-suche" className="sr-only">
            Rechner suchen
          </label>
          <input
            id="tool-suche"
            type="search"
            value={suche}
            onChange={(event) => setSuche(event.target.value)}
            placeholder="Wonach suchst du? z. B. ETF verkaufen, Miete, Erbe"
            autoComplete="off"
            className="field-input py-3.5 pl-12 pr-11 text-base [&::-webkit-search-cancel-button]:appearance-none"
          />
          {suchend ? (
            <button
              type="button"
              onClick={() => setSuche("")}
              aria-label="Suche zurücksetzen"
              className="absolute right-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <CloseIcon width={16} height={16} />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="chip"
            aria-pressed={filter === "alle"}
            onClick={() => setFilter("alle")}
          >
            Alle {treffer.length}
          </button>
          {categories.map((category) => {
            const anzahl = counts.get(category.id) ?? 0;
            return (
              <button
                key={category.id}
                type="button"
                className="chip"
                aria-pressed={filter === category.id}
                disabled={anzahl === 0}
                onClick={() => setFilter(category.id)}
                style={anzahl === 0 ? { opacity: 0.45, cursor: "default" } : undefined}
              >
                {category.navTitle} {anzahl}
              </button>
            );
          })}
        </div>

        <p aria-live="polite" className="text-sm text-muted">
          {sichtbar.length === 0
            ? "Kein Rechner passt dazu — versuch es mit einem anderen Wort."
            : suchend || filter !== "alle"
              ? `${sichtbar.length} von ${tools.length} Rechnern`
              : `${tools.length} Rechner, alle kostenlos und ohne Anmeldung`}
        </p>
      </div>

      {gruppiert
        ? categories.map((category) => {
            const passend = sichtbar.filter(
              (tool) => tool.category === category.id,
            );
            if (passend.length === 0) return null;

            return (
              <section key={category.id} className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"
                  >
                    <CategoryIcon category={category.id} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold tracking-tight">
                      <Link
                        href={`/kategorie/${category.id}/`}
                        className="rounded transition-colors hover:text-accent"
                      >
                        {category.title}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted">{category.description}</p>
                  </div>
                </div>
                <ToolGrid tools={passend} />
              </section>
            );
          })
        : sichtbar.length > 0 && <ToolGrid tools={sichtbar} />}
    </div>
  );
}

function ToolGrid({ tools }: { tools: Tool[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <li key={tool.slug}>
          <Link href={`/${tool.slug}/`} className="card-link group">
            <span className="flex items-center gap-2">
              <span className="text-accent" aria-hidden="true">
                <CategoryIcon category={tool.category} width={18} height={18} />
              </span>
              <span className="min-w-0 flex-1 font-medium">{tool.title}</span>
              <ArrowRightIcon
                width={18}
                height={18}
                className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
              />
            </span>
            {/* The first clause of the description is the promise; the rest
                lists the details and belongs on the calculator's own page. */}
            <span className="text-sm text-muted">
              {tool.description.split(" — ")[0]}
            </span>
            {tool.stand ? (
              <span className="badge mt-auto w-fit">Stand {tool.stand}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
