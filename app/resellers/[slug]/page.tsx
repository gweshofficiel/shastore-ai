import Link from "next/link";
import type { Metadata } from "next";
import { TemplateHeroThumbnail } from "@/components/templates/demo-store-preview";
import {
  buildResellerPreviewUrl,
  getPublicResellerProfile,
  isPreviewEnabledForPublicItem
} from "@/lib/reseller-showcase/data";
import { getResellerShowcaseTheme } from "@/lib/reseller-showcase/themes";
import { getStoreTemplate } from "@/lib/template-studio/library";
import type { ResellerShowcaseItem } from "@/lib/reseller-showcase/types";

export const dynamic = "force-dynamic";

type PublicResellerProfilePageProps = {
  params: Promise<{ slug: string }>;
};

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function socialLinks(profile: NonNullable<Awaited<ReturnType<typeof getPublicResellerProfile>>["showcase"]>["profile"]) {
  return [
    profile.website_url ? { href: profile.website_url, label: "Website" } : null,
    profile.instagram_url ? { href: profile.instagram_url, label: "Instagram" } : null,
    profile.tiktok_url ? { href: profile.tiktok_url, label: "TikTok" } : null
  ].filter(Boolean) as Array<{ href: string; label: string }>;
}

function UnavailableProfile({ slug }: { slug: string }) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-[0_30px_120px_-70px_rgba(15,23,42,0.9)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-white/50">
          Reseller profile
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.05em]">Profile not available</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm font-semibold leading-7 text-white/65">
          This reseller profile is not published, is hidden, or does not exist. Draft reseller profiles
          and private listings are never shown publicly.
        </p>
        <p className="mt-5 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/60">
          Requested slug: {slug}
        </p>
      </section>
    </main>
  );
}

function EmptyState({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_20px_80px_-60px_rgba(15,23,42,0.7)]">
      <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-950">{label}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">{note}</p>
    </div>
  );
}

function ListingCard({
  item,
  profileSlug,
  type
}: {
  item: ResellerShowcaseItem;
  profileSlug: string;
  type: "store" | "template";
}) {
  const features = stringList(item.features);
  const previewImages = stringList(item.preview_images);
  const templatePreviewId = previewImages
    .find((image) => image.startsWith("template:"))
    ?.replace("template:", "");
  const templatePreview = templatePreviewId ? getStoreTemplate(templatePreviewId) : null;
  const canPreview = isPreviewEnabledForPublicItem(item);
  const previewUrl = buildResellerPreviewUrl(profileSlug, item.slug);

  return (
    <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-60px_rgba(15,23,42,0.8)]">
      {templatePreview ? (
        <div className="p-3">
          <TemplateHeroThumbnail template={templatePreview} />
        </div>
      ) : (
        <div
          className="flex h-52 items-center justify-center bg-slate-100 bg-cover bg-center"
          style={item.thumbnail_url ? { backgroundImage: `url(${item.thumbnail_url})` } : undefined}
        >
          {!item.thumbnail_url ? (
            <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              {type === "template" ? "Template preview" : "Store preview"}
            </span>
          ) : null}
        </div>
      )}
      <div className="grid gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              {item.category ?? (type === "template" ? "Template listing" : "Store listing")}
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{item.title}</h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            Published
          </span>
        </div>
        <p className="text-sm font-semibold leading-6 text-slate-500">
          {item.description ?? "A reseller-published public listing placeholder."}
        </p>
        {features.length ? (
          <div className="flex flex-wrap gap-2">
            {features.slice(0, 4).map((feature) => (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600" key={feature}>
                {feature}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {canPreview ? (
            <Link className="inline-flex h-10 items-center rounded-full bg-slate-950 px-4 text-sm font-black text-white" href={previewUrl}>
              Preview
            </Link>
          ) : null}
          <span className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-600">
            {item.price_label ?? "Contact reseller"}
          </span>
        </div>
      </div>
    </article>
  );
}

export async function generateMetadata({ params }: PublicResellerProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicResellerProfile(slug);
  const displayName = profile.showcase?.profile.display_name ?? "Reseller profile";
  const description =
    profile.showcase?.profile.bio ??
    "Public reseller profile for SHASTORE marketplace identity, stores, templates, and trust signals.";

  return {
    title: `${displayName} | SHASTORE Reseller Profile`,
    description,
    alternates: {
      canonical: profile.canonicalPath
    },
    openGraph: {
      title: displayName,
      description,
      images: profile.showcase?.profile.banner_url ? [profile.showcase.profile.banner_url] : undefined,
      type: "profile"
    }
  };
}

export default async function PublicResellerProfilePage({ params }: PublicResellerProfilePageProps) {
  const { slug } = await params;
  const profileData = await getPublicResellerProfile(slug);
  const showcase = profileData.showcase;

  if (!showcase) {
    return <UnavailableProfile slug={slug} />;
  }

  const { profile } = showcase;
  const theme = getResellerShowcaseTheme(profile.theme_id);
  const links = socialLinks(profile);

  return (
    <main className="min-h-screen bg-slate-50">
      <section className={`px-4 py-8 sm:px-6 lg:px-8 ${theme.heroClass}`}>
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950 text-white">
          <div
            className="min-h-[24rem] bg-cover bg-center p-6 lg:p-10"
            style={
              profile.banner_url
                ? { backgroundImage: `linear-gradient(rgba(15,23,42,.62), rgba(15,23,42,.72)), url(${profile.banner_url})` }
                : undefined
            }
          >
            <div className="flex min-h-[20rem] flex-col justify-between gap-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/70">
                  Public reseller profile
                </p>
                <p className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/70">
                  {profileData.publicAccountCode}
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="max-w-3xl">
                  {profile.logo_url ? (
                    <div
                      aria-label={`${profile.display_name} logo`}
                      className="mb-6 h-20 w-20 rounded-3xl border border-white/20 bg-white/10 bg-cover bg-center"
                      role="img"
                      style={{ backgroundImage: `url(${profile.logo_url})` }}
                    />
                  ) : null}
                  <h1 className="text-5xl font-black tracking-[-0.07em] lg:text-7xl">{profile.display_name}</h1>
                  <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-white/75">
                    {profile.bio ?? "A public reseller marketplace identity for SHASTORE stores and templates."}
                  </p>
                </div>
                <div className="grid gap-2 rounded-[2rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/50">Trust signals</p>
                  <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-bold text-white">
                    {profileData.reputation.currentLevel} level
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-bold text-white">
                    {profileData.reputation.trustScore} trust
                  </span>
                  {profileData.verification.publicBadges.map((badge) => (
                    <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/80" key={badge.kind}>
                      {badge.label}: {badge.status}
                    </span>
                  ))}
                  {profileData.trustBadges.map((badge) => (
                    <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/80" key={badge}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Level</p>
            <p className="mt-3 text-2xl font-black text-slate-950">{profileData.reputation.currentLevel}</p>
            <p className="mt-2 text-sm font-semibold text-slate-500">Next: {profileData.reputation.nextLevel}</p>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Rating</p>
            <p className="mt-3 text-2xl font-black text-slate-950">{profileData.ratingPlaceholder}</p>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Stores</p>
            <p className="mt-3 text-2xl font-black text-slate-950">{profileData.storeListings.length}</p>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Templates</p>
            <p className="mt-3 text-2xl font-black text-slate-950">{profileData.templateListings.length}</p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 rounded-[2rem] border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Reputation foundation</p>
              <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-950">
                {profileData.reputation.currentLevel} reseller · {profileData.reputation.trustScore} trust
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-slate-500">
                {profileData.reputation.friendlyExplanation} Sales, response, completion, and dispute metrics are future placeholders.
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4 text-sm font-black text-slate-700">
              {profileData.reputation.progress}% toward {profileData.reputation.nextLevel}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {profileData.reputation.metrics.slice(0, 9).map((metric) => (
              <div className="rounded-3xl bg-slate-50 p-4" key={metric.key}>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
                <p className="mt-2 text-xl font-black text-slate-950">{metric.value}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{metric.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_0.75fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Bio</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">About this reseller</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">
              {profile.bio ?? "This reseller has not added a detailed bio yet."}
            </p>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Public details</p>
            <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
              <p>Country: {profileData.country}</p>
              <p>Languages: {profileData.languages.join(", ")}</p>
              <p>Status: {profileData.profileStatus}</p>
              <p>WhatsApp/contact: contact link placeholder</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {links.length ? (
                links.map((link) => (
                  <Link
                    className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
                    href={link.href}
                    key={link.label}
                    target="_blank"
                  >
                    {link.label}
                  </Link>
                ))
              ) : (
                <span className="text-sm font-semibold text-slate-500">No public social links yet.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">Public store listings</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-slate-950">Published stores</h2>
          </div>
          {profileData.storeListings.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {profileData.storeListings.map((item) => (
                <ListingCard item={item} key={item.id} profileSlug={profile.slug} type="store" />
              ))}
            </div>
          ) : (
            <EmptyState label="No listings yet" note="This reseller has not published public store listings yet." />
          )}
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">Public template listings</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-slate-950">Published templates</h2>
          </div>
          {profileData.templateListings.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {profileData.templateListings.map((item) => (
                <ListingCard item={item} key={item.id} profileSlug={profile.slug} type="template" />
              ))}
            </div>
          ) : (
            <EmptyState label="No templates yet" note="This reseller has not published public template listings yet." />
          )}
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 rounded-[2rem] border border-slate-200 bg-white p-6" id="reseller-contact">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Reviews and contact</p>
              <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-950">
                {profileData.reviewsSummary.averageRating
                  ? `${profileData.reviewsSummary.averageRating}/5 average rating`
                  : "No reviews yet"}
              </h2>
            </div>
            <p className="text-sm font-black text-slate-500">
              {profileData.reviewsSummary.reviewCount} approved review{profileData.reviewsSummary.reviewCount === 1 ? "" : "s"}
            </p>
          </div>
          {profileData.reviews.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {profileData.reviews.slice(0, 4).map((review) => (
                <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={review.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{review.buyerDisplayName}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        Approved review
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                      {review.rating}/5
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{review.reviewText}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="max-w-2xl rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-500">
              No reviews yet. Only approved reseller reviews will appear publicly. Buyer email,
              phone, internal review IDs, checkout data, wallet, payout, and withdrawal details are never shown here.
            </p>
          )}
        </div>
      </section>

      <section className="px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">Future hooks</p>
          <div className="flex flex-wrap gap-2">
            {profileData.futureHooks.map((hook) => (
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/70" key={hook}>
                {hook}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
