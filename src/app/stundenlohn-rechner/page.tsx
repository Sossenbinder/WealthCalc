import type { Metadata } from "next";
import { CalculatorShell } from "@/components/CalculatorShell";
import { getTool, siteName } from "@/lib/tools";
import { StundenlohnRechner } from "./StundenlohnRechner";

const tool = getTool("stundenlohn-rechner")!;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  keywords: tool.keywords,
  alternates: { canonical: `/${tool.slug}/` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: tool.title,
  description: tool.description,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  publisher: { "@type": "Organization", name: siteName },
};

export default function StundenlohnRechnerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CalculatorShell tool={tool}>
        <StundenlohnRechner />
      </CalculatorShell>
    </>
  );
}
