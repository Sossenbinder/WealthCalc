import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { themeInitScript } from "@/components/ThemeToggle";
import { ShieldIcon } from "@/components/icons";
import { categories, siteName, siteTagline, siteUrl, toolsByCategory } from "@/lib/tools";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  // Without a base, the per-page `alternates.canonical` stays relative, which
  // search engines treat as ambiguous.
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — ${siteTagline}`,
    template: `%s | ${siteName}`,
  },
  description:
    "Kostenlose Rechner für Geldanlage, Steuern, Einkommen und Immobilienfinanzierung. Alle Berechnungen laufen direkt im Browser — es werden keine Daten an einen Server gesendet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const gefuellt = categories.filter(
    (category) => toolsByCategory(category.id).length > 0,
  );

  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before the first paint so a stored dark choice never flashes
            white. See themeInitScript. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans min-h-full flex flex-col">
        <a href="#inhalt" className="skip-link">
          Zum Inhalt springen
        </a>

        <SiteHeader />

        <main id="inhalt" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
          {children}
        </main>

        <footer className="site-footer mt-8 border-t border-border bg-surface print:hidden">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1">
              <Link
                href="/"
                className="flex w-fit items-center gap-2 font-semibold tracking-tight"
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-lg bg-accent text-[0.9375rem] font-bold text-accent-on"
                >
                  W
                </span>
                {siteName}
              </Link>
              <p className="max-w-xs text-sm text-muted">{siteTagline}</p>
              <p className="badge badge-accent w-fit">
                <ShieldIcon width={14} height={14} />
                Rechnet im Browser
              </p>
            </div>

            {gefuellt.map((category) => (
              <nav key={category.id} aria-labelledby={`footer-${category.id}`}>
                <h2
                  id={`footer-${category.id}`}
                  className="mb-3 text-sm font-medium"
                >
                  {category.title}
                </h2>
                <ul className="flex flex-col gap-2">
                  {toolsByCategory(category.id).map((tool) => (
                    <li key={tool.slug}>
                      <Link
                        href={`/${tool.slug}/`}
                        className="text-sm text-muted transition-colors hover:text-accent"
                      >
                        {tool.navTitle}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="border-t border-border">
            <p className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted">
              {siteName} liefert unverbindliche Berechnungen und ersetzt keine
              Steuer- oder Anlageberatung. Alle Eingaben bleiben in deinem
              Browser — es werden keine Daten an einen Server gesendet.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
