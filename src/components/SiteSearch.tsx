"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useClientValue } from "@/lib/useClientValue";
import { CategoryIcon, SearchIcon } from "@/components/icons";
import { searchTools } from "@/lib/search";
import { categories, type Tool } from "@/lib/tools";

interface SiteSearchProps {
  tools: Tool[];
}

const categoryTitle = new Map(categories.map((c) => [c.id, c.title]));

/** ⌘ on Apple hardware, Strg everywhere else. */
const istMac = () =>
  /mac|iphone|ipad|ipod/i.test(navigator.userAgent) ? "⌘K" : "Strg K";

/**
 * Find any calculator from any page, without going back to the start page.
 *
 * The portal has 21 calculators behind a four-entry navigation, so getting from
 * one to another meant home → search → click. This is the same search, one
 * keystroke away from wherever you are: ⌘K / Strg+K, or "/" — the shortcut
 * people already try — with the header button as the discoverable equivalent
 * for anyone who does not know either.
 *
 * The dialog is a combobox over a listbox: the input keeps focus throughout and
 * `aria-activedescendant` moves the selection, so arrow keys read out the
 * highlighted calculator instead of silently moving a visual bar.
 */
export function SiteSearch({ tools }: SiteSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  // The label has to name the key the reader actually has, and only the browser
  // knows which that is — the static HTML must not promise ⌘ to a Windows
  // machine.
  const shortcutLabel = useClientValue(istMac, null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;

  const treffer = useMemo(() => searchTools(tools, query), [tools, query]);

  const close = useCallback(() => {
    setOpen(false);
    // Returning focus to the button is what makes the dialog dismissible
    // without losing your place in the page behind it.
    triggerRef.current?.focus();
  }, []);

  const go = useCallback(
    (tool: Tool) => {
      setOpen(false);
      setQuery("");
      router.push(`/${tool.slug}/`);
    },
    [router],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActive(0);
        setOpen((current) => !current);
        return;
      }
      // "/" is a shortcut only where it is not also a character being typed.
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setActive(0);
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    // The page behind a modal must not scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `#${CSS.escape(optionId(active))}`,
    );
    node?.scrollIntoView({ block: "nearest" });
    // optionId is derived from listId, which is stable for the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open, listId]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (treffer.length === 0 ? 0 : (current + 1) % treffer.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) =>
        treffer.length === 0 ? 0 : (current - 1 + treffer.length) % treffer.length,
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(treffer.length - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const tool = treffer[active];
      if (tool) go(tool);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setActive(0);
          setOpen(true);
        }}
        className="group flex items-center gap-2 rounded-full border border-transparent p-2 text-sm text-muted transition-colors hover:text-foreground sm:w-56 sm:border-border sm:bg-surface-2 sm:py-1.5 sm:pl-3 sm:pr-1.5 sm:hover:border-accent md:w-64"
        aria-haspopup="dialog"
      >
        <SearchIcon width={16} height={16} className="shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Rechner suchen</span>
        <span className="sr-only sm:hidden">Rechner suchen</span>
        {shortcutLabel ? (
          <kbd className="kbd hidden sm:inline-flex">{shortcutLabel}</kbd>
        ) : null}
      </button>

      {!open ? null : (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            className="animate-fade-in absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Rechner suchen"
            className="animate-scale-in card relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <SearchIcon className="shrink-0 text-muted" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  treffer.length > 0 ? optionId(active) : undefined
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  // A new query means a new best match, so the highlight goes
                  // back to the top of the list.
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="z. B. ETF verkaufen, Miete, Erbe, Sparplan"
                autoComplete="off"
                spellCheck={false}
                aria-label="Rechner suchen"
                className="w-full bg-transparent py-4 text-base outline-none focus-visible:outline-none placeholder:text-faint"
              />
              <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
            </div>

            <p className="sr-only" aria-live="polite">
              {treffer.length === 0
                ? "Kein Rechner gefunden"
                : `${treffer.length} Rechner gefunden`}
            </p>

            {treffer.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                Kein Rechner passt zu „{query}“ — versuch es mit einem anderen
                Wort.
              </p>
            ) : (
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label="Rechner"
                className="flex-1 overflow-y-auto p-2"
              >
                {treffer.map((tool, index) => (
                  // A listbox may only own options, so the <li> that carries
                  // the list semantics for everyone else steps out of the way.
                  <li key={tool.slug} role="presentation">
                    <button
                      type="button"
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === active}
                      tabIndex={-1}
                      onMouseMove={() => setActive(index)}
                      onClick={() => go(tool)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        index === active ? "bg-accent-soft" : ""
                      }`}
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg border border-border ${
                          index === active
                            ? "border-accent/40 text-accent"
                            : "text-muted"
                        }`}
                      >
                        <CategoryIcon
                          category={tool.category}
                          width={18}
                          height={18}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {tool.navTitle}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {tool.description.split(" — ")[0]}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-xs text-faint sm:block">
                        {categoryTitle.get(tool.category)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted sm:flex">
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">↑</kbd>
                <kbd className="kbd">↓</kbd> blättern
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">↵</kbd> öffnen
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">Esc</kbd> schließen
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
