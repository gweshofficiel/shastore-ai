import { FeatureGrid } from "@/components/marketing/feature-grid";
import { Hero } from "@/components/marketing/hero";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { ButtonLink } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
      <MarketingNavbar />
      <main>
        <Hero />
        <FeatureGrid />
        <section className="bg-white py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-ink sm:text-5xl">
              AI writes the words. Templates ship the page.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">
              No dynamic website generation, video rendering, or complex
              orchestration. Just reusable React templates filled with great
              product copy.
            </p>
            <div className="mt-8">
              <ButtonLink href="/register">Launch SHASTORE AI</ButtonLink>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
