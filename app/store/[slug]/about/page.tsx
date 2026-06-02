import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublicStoreAbout } from "@/lib/store-about-public";

export const dynamic = "force-dynamic";

type StoreAboutPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params
}: StoreAboutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { about, preview } = await loadPublicStoreAbout(slug);

  if (!preview || !about) {
    return {
      title: "About not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const description = about.subtitle || about.companyStory?.slice(0, 160) || `About ${preview.store.title}.`;

  return {
    description,
    title: `${about.title} | ${preview.store.title}`,
    openGraph: {
      description,
      images: about.coverImageUrl ? [{ url: about.coverImageUrl }] : undefined,
      title: `${about.title} | ${preview.store.title}`,
      type: "website"
    },
    twitter: {
      card: about.coverImageUrl ? "summary_large_image" : "summary",
      description,
      images: about.coverImageUrl ? [about.coverImageUrl] : undefined,
      title: `${about.title} | ${preview.store.title}`
    }
  };
}

export default async function StoreAboutPage({
  params
}: StoreAboutPageProps) {
  const { slug } = await params;
  const { about, preview } = await loadPublicStoreAbout(slug);

  if (!preview || !about) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink sm:px-6 lg:px-8">
      <article className="mx-auto max-w-6xl">
        <Link
          className="text-sm font-black text-muted transition hover:text-ink"
          href={`/store/${preview.store.slug}`}
        >
          Back to {preview.store.title}
        </Link>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          {about.coverImageUrl ? (
            <img
              alt={about.title}
              className="aspect-[16/7] w-full object-cover"
              src={about.coverImageUrl}
            />
          ) : null}
          <div className="p-6 sm:p-8 lg:p-10">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              About {preview.store.title}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
              {about.title}
            </h1>
            {about.subtitle ? (
              <p className="mt-4 max-w-3xl text-base font-semibold leading-8 text-muted">
                {about.subtitle}
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <AboutBlock className="lg:col-span-2" content={about.companyStory} label="Company Story" />
          <AboutBlock content={about.mission} label="Mission" />
          <AboutBlock content={about.vision} label="Vision" />
          <AboutBlock content={about.founderMessage} label="Founder Message" />
          <AboutBlock content={about.teamIntro} label="Team Introduction" />
        </section>

        {about.galleryImages.length ? (
          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
              Gallery
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {about.galleryImages.map((imageUrl) => (
                <img
                  alt=""
                  className="aspect-square rounded-[1.5rem] object-cover"
                  key={imageUrl}
                  src={imageUrl}
                />
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}

function AboutBlock({
  className = "",
  content,
  label
}: {
  className?: string;
  content: string | null;
  label: string;
}) {
  if (!content) {
    return null;
  }

  return (
    <section className={`rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-7 text-muted">
        {content}
      </p>
    </section>
  );
}
