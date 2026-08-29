import { ToolFinder } from "@/components/ToolFinder";
import { siteName, siteTagline, tools } from "@/lib/tools";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {siteName}
        </h1>
        <p className="max-w-2xl text-lg text-muted">{siteTagline}</p>
      </section>

      <ToolFinder tools={tools} />
    </div>
  );
}
