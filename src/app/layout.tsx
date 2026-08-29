import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  categories,
  siteName,
  siteTagline,
  siteUrl,
  toolsByCategory,
} from "@/lib/tools";

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
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="font-sans min-h-full flex flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              {siteName}
            </Link>
            {/* Categories rather than every tool: the flat list grew a row of
                its own with each calculator and had reached four rows and a
                third of a small phone's screen. This stays four entries. */}
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {categories
                .filter((category) => toolsByCategory(category.id).length > 0)
                .map((category) => (
                  <Link
                    key={category.id}
                    href={`/kategorie/${category.id}/`}
                    className="hover:text-accent"
                  >
                    {category.title}
                  </Link>
                ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs leading-relaxed text-muted">
            <p>
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
