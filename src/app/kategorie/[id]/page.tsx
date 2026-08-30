import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  CategoryIcon,
  ChevronRightIcon,
} from "@/components/icons";
import {
  categories,
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
  const andere = categories.filter(
    (other) => other.id !== category.id && toolsByCategory(other.id).length > 0,
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <nav aria-label="Brotkrumen">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            <li>
              <Link href="/" className="rounded transition-colors hover:text-accent">
                Start
              </Link>
            </li>
            <li aria-hidden="true" className="text-faint">
              <ChevronRightIcon width={14} height={14} />
            </li>
            <li aria-current="page">{category.title}</li>
          </ol>
        </nav>

        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"
          >
            <CategoryIcon category={category.id as CategoryId} width={22} height={22} />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight hyphens-auto sm:text-4xl">
            {category.title}
          </h1>
        </div>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          {category.description}
        </p>
        <p className="text-sm text-muted">
          {tools.length} {tools.length === 1 ? "Rechner" : "Rechner"} in dieser
          Kategorie
        </p>
      </header>

      {tools.length === 0 ? (
        <p className="text-muted">
          Hier entsteht noch etwas. Die anderen Kategorien sind schon gefüllt.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <li key={tool.slug}>
              <Link href={`/${tool.slug}/`} className="card-link group">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 font-medium">{tool.title}</span>
                  <ArrowRightIcon
                    width={18}
                    height={18}
                    className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                </span>
                <span className="text-sm text-muted">{tool.description}</span>
                {tool.stand ? (
                  <span className="badge mt-auto w-fit">Stand {tool.stand}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Where to go next, rather than a dead end at the bottom of a category. */}
      <nav
        aria-labelledby="andere-kategorien"
        className="flex flex-col gap-4 border-t border-border pt-8"
      >
        <h2 id="andere-kategorien" className="text-lg font-semibold tracking-tight">
          Andere Kategorien
        </h2>
        <ul className="flex flex-wrap gap-2">
          {andere.map((other) => (
            <li key={other.id}>
              <Link
                href={`/kategorie/${other.id}/`}
                className="chip inline-flex items-center gap-2"
              >
                <CategoryIcon category={other.id} width={16} height={16} />
                {other.title}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/" className="chip inline-flex items-center gap-2">
              Alle Rechner
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
