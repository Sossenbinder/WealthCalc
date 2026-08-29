import type { MetadataRoute } from "next";
import { categories, siteUrl, tools, toolsByCategory } from "@/lib/tools";

/**
 * Driven by the tool registry, like the nav and the related links — a new
 * calculator appears here without anyone remembering to add it.
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    ...categories
      .filter((category) => toolsByCategory(category.id).length > 0)
      .map((category) => ({
        url: `${siteUrl}/kategorie/${category.id}/`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ...tools.map((tool) => ({
      url: `${siteUrl}/${tool.slug}/`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
