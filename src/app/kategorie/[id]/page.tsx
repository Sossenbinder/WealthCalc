import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  categories,
  siteName,
  toolsByCategory,
  type CategoryId,
} from "@/lib/tools";

export function generateStaticParams() {
  return categories.map((category) => ({ id: category.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const category = categories.find((c) => c.id === id);
  if (!category) return {};
  return {
    title: category.title,
    description: category.description,
    alternates: { canonical: `/kategorie/${category.id}/` },
  };
}

export default async function KategoriePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = categories.find((c) => c.id === id);
  if (!category) notFound();

  const tools = toolsByCategory(category.id as CategoryId);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted">{siteName}</p>
        <h1 className="text-2xl font-semibold tracking-tight hyphens-auto sm:text-3xl">
          {category.title}
        </h1>
        <p className="max-w-2xl text-muted">{category.description}</p>
      </header>

      {tools.length === 0 ? (
        <p className="text-muted">
          Hier entsteht noch etwas. Die anderen Kategorien sind schon gefüllt.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={`/${tool.slug}/`}
                className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-5 hover:border-accent"
              >
                <span className="font-medium">{tool.title}</span>
                <span className="text-sm text-muted">{tool.description}</span>
                {tool.stand ? (
                  <span className="text-xs text-muted">Stand: {tool.stand}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p>
        <Link href="/" className="text-sm text-accent hover:underline">
          Alle Rechner
        </Link>
      </p>
    </div>
  );
}
