import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StorefrontLanguageSwitcher } from "@/components/storefront/language-switcher";
import { loadPublicStoreFaqs } from "@/lib/store-faq-public";

export const dynamic = "force-dynamic";

type StoreFaqPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params
}: StoreFaqPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { preview } = await loadPublicStoreFaqs(slug);

  if (!preview) {
    return {
      title: "FAQ not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const description = `Frequently asked questions from ${preview.store.title}.`;

  return {
    title: `FAQ | ${preview.store.title}`,
    description,
    openGraph: {
      description,
      title: `FAQ | ${preview.store.title}`,
      type: "website"
    },
    twitter: {
      card: "summary",
      description,
      title: `FAQ | ${preview.store.title}`
    }
  };
}

export default async function StoreFaqPage({
  params
}: StoreFaqPageProps) {
  const { slug } = await params;
  const { faqs, preview } = await loadPublicStoreFaqs(slug);

  if (!preview) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink sm:px-6 lg:px-8">
      <div className="fixed right-4 top-4 z-50">
        <StorefrontLanguageSwitcher settings={preview.store.languageSettings} />
      </div>
      <section className="mx-auto max-w-5xl">
        <Link
          className="text-sm font-black text-muted transition hover:text-ink"
          href={`/store/${preview.store.slug}`}
        >
          Back to {preview.store.title}
        </Link>
        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Store FAQ
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">
            Frequently asked questions
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-muted">
            Answers published by {preview.store.title}. Draft FAQs are not shown here.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          {faqs.length ? (
            faqs.map((faq) => (
              <details
                className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"
                key={faq.id}
              >
                <summary className="cursor-pointer text-base font-black tracking-[-0.02em] text-ink">
                  {faq.question}
                </summary>
                <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-7 text-muted">
                  {faq.answer}
                </p>
              </details>
            ))
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-ink">
                No published FAQs yet
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-muted">
                Published FAQs from this store will appear here.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
