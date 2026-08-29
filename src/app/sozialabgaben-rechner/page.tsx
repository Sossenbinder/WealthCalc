import type { Metadata } from "next";
import { CalculatorShell } from "@/components/CalculatorShell";
import { getTool, siteName } from "@/lib/tools";
import { SozialabgabenRechner } from "./SozialabgabenRechner";

const tool = getTool("sozialabgaben-rechner")!;

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

export default function SozialabgabenRechnerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CalculatorShell tool={tool}>
        <SozialabgabenRechner />
      </CalculatorShell>
    </>
  );
}
