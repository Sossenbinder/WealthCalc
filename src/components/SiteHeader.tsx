"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SiteSearch } from "@/components/SiteSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CategoryIcon, CloseIcon, MenuIcon } from "@/components/icons";
import { categories, siteName, tools, toolsByCategory } from "@/lib/tools";

const gefuellt = categories.filter(
  (category) => toolsByCategory(category.id).length > 0,
);

/**
 * The site chrome.
 *
 * It knows the current route so the navigation can mark where you are —
 * including on a calculator page, where the matching category lights up even
 * though the URL is the calculator's own. Without that the four links looked
 * identical on every one of 21 pages.
 */
export function SiteHeader() {
  const pathname = usePathname();
  // Which route the menu was opened on, rather than a plain boolean: a route
  // change then closes it by itself — including a back button press, which no
  // click handler would catch.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const menuOpen = openedOn === pathname;

  const slug = pathname.replace(/^\/|\/$/g, "");
  const currentTool = tools.find((tool) => tool.slug === slug);
  const currentCategory = pathname.startsWith("/kategorie/")
    ? slug.split("/")[1]
    : currentTool?.category;

  return (
    <header className="site-header print:hidden">
      <div className="mx-auto flex h-15 max-w-6xl items-center gap-3 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg font-semibold tracking-tight"
          aria-label={`${siteName} — Startseite`}
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-accent text-[0.9375rem] font-bold text-accent-on"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            W
          </span>
          <span className="text-base">{siteName}</span>
        </Link>

        <nav aria-label="Kategorien" className="hidden md:flex md:items-center md:gap-1">
          {gefuellt.map((category) => (
            <Link
              key={category.id}
              href={`/kategorie/${category.id}/`}
              className="nav-link"
              aria-current={currentCategory === category.id ? "page" : undefined}
            >
              {category.navTitle}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <SiteSearch tools={tools} />
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-ghost btn-icon md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
            onClick={() => setOpenedOn(menuOpen ? null : pathname)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-nav"
          aria-label="Kategorien"
          className="animate-fade-in border-t border-border bg-surface md:hidden"
        >
          <ul className="mx-auto max-w-6xl px-2 py-2">
            {gefuellt.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/kategorie/${category.id}/`}
                  aria-current={
                    currentCategory === category.id ? "page" : undefined
                  }
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent"
                >
                  <CategoryIcon
                    category={category.id}
                    width={18}
                    height={18}
                    className="text-muted"
                  />
                  <span className="font-medium">{category.title}</span>
                  <span className="ml-auto text-xs text-faint">
                    {toolsByCategory(category.id).length}
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted"
              >
                Alle {tools.length} Rechner
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
