import type { Tool } from "@/lib/tools";

/** Fold umlauts so "Kaufergaenzung" finds "Kaufergänzung" and vice versa. */
export function normalisieren(text: string): string {
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
 * Every whitespace-separated part has to match somewhere, so typing more words
 * always narrows — which is what a reader expects from a search box even when,
 * as here, the words come from different fields.
 *
 * Results are ordered by where the match landed: a title hit outranks a hit
 * buried in the keyword list, so "miete" leads with the Mietrendite-Rechner
 * rather than with whichever calculator happens to be first in the registry.
 */
export function searchTools(tools: Tool[], query: string): Tool[] {
  const begriff = normalisieren(query.trim());
  if (begriff === "") return tools;
  const teile = begriff.split(/\s+/);

  const scored: { tool: Tool; rank: number }[] = [];
  for (const tool of tools) {
    const title = normalisieren(tool.title);
    const description = normalisieren(tool.description);
    const keywords = normalisieren(tool.keywords.join(" "));
    const haystack = `${title} ${description} ${keywords}`;

    if (!teile.every((teil) => haystack.includes(teil))) continue;

    const rank = teile.every((teil) => title.startsWith(teil))
      ? 0
      : teile.every((teil) => title.includes(teil))
        ? 1
        : teile.every((teil) => `${title} ${description}`.includes(teil))
          ? 2
          : 3;
    scored.push({ tool, rank });
  }

  // Stable within a rank, so the registry order still decides ties.
  return scored
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.tool);
}
