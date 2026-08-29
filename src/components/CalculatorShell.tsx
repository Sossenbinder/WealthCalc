import Link from "next/link";
import type { ReactNode } from "react";
import { relatedTools, type Tool } from "@/lib/tools";

interface CalculatorShellProps {
  tool: Tool;
  children: ReactNode;
}

export function CalculatorShell({ tool, children }: CalculatorShellProps) {
  const weitere = relatedTools(tool.slug);

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        {/* German compounds like "Sparplanrechner" have no break opportunity and
            widen the page at large text sizes; lang="de" on <html> lets the
            browser hyphenate them properly. */}
        <h1 className="text-2xl font-semibold tracking-tight hyphens-auto sm:text-3xl">
          {tool.title}
        </h1>
        <p className="max-w-2xl text-muted">{tool.description}</p>
        {tool.stand ? (
          <p className="text-xs text-muted">Stand: {tool.stand}</p>
        ) : null}
      </header>

      {children}

      {weitere.length === 0 ? null : (
        <nav
          aria-labelledby="weitere-rechner"
          className="flex flex-col gap-3 border-t border-border pt-6 print:hidden"
        >
          <h2 id="weitere-rechner" className="text-sm font-medium">
            Passt dazu
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {weitere.map((andere) => (
              <li key={andere.slug}>
                <Link
                  href={`/${andere.slug}/`}
                  className="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-4 hover:border-accent"
                >
                  <span className="text-sm font-medium">{andere.title}</span>
                  <span className="text-xs text-muted">
                    {andere.description.split(" — ")[0]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  );
}
