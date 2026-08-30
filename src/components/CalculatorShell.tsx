import Link from "next/link";
import type { ReactNode } from "react";
import { StickyResult } from "@/components/StickyResult";
import { ArrowRightIcon, CategoryIcon, ChevronRightIcon } from "@/components/icons";
import { getCategory, relatedTools, type Tool } from "@/lib/tools";

interface CalculatorShellProps {
  tool: Tool;
  children: ReactNode;
}

export function CalculatorShell({ tool, children }: CalculatorShellProps) {
  const weitere = relatedTools(tool.slug);
  const category = getCategory(tool.category);

  return (
    // The bottom padding is for the sticky result bar on small screens, which
    // would otherwise cover the last row of whatever is at the end of the page.
    <article className="flex flex-col gap-8 pb-16 lg:pb-0">
      <header className="flex flex-col gap-3">
        <nav aria-label="Brotkrumen" className="print:hidden">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            <li>
              <Link href="/" className="rounded transition-colors hover:text-accent">
                Start
              </Link>
            </li>
            <li aria-hidden="true" className="text-faint">
              <ChevronRightIcon width={14} height={14} />
            </li>
            <li>
              <Link
                href={`/kategorie/${category.id}/`}
                className="rounded transition-colors hover:text-accent"
              >
                {category.title}
              </Link>
            </li>
          </ol>
        </nav>

        {/* German compounds like "Sparplanrechner" have no break opportunity and
            widen the page at large text sizes; lang="de" on <html> lets the
            browser hyphenate them properly. */}
        <h1 className="text-3xl font-semibold tracking-tight text-balance hyphens-auto sm:text-4xl">
          {tool.title}
        </h1>
        <p className="max-w-3xl text-lg leading-relaxed text-muted">
          {tool.description}
        </p>
        {tool.stand ? (
          <p className="badge w-fit">
            Rechtsstand {tool.stand}
          </p>
        ) : null}
      </header>

      {children}

      {weitere.length === 0 ? null : (
        <nav
          aria-labelledby="weitere-rechner"
          className="flex flex-col gap-4 border-t border-border pt-8 print:hidden"
        >
          <h2 id="weitere-rechner" className="text-lg font-semibold tracking-tight">
            Die nächste Frage
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {weitere.map((andere) => (
              <li key={andere.slug}>
                <Link href={`/${andere.slug}/`} className="card-link group">
                  <span className="flex items-center gap-2">
                    <span className="text-accent" aria-hidden="true">
                      <CategoryIcon
                        category={andere.category}
                        width={16}
                        height={16}
                      />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {andere.title}
                    </span>
                    <ArrowRightIcon
                      width={16}
                      height={16}
                      className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                    />
                  </span>
                  <span className="text-xs text-muted">
                    {andere.description.split(" — ")[0]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <StickyResult />
    </article>
  );
}
